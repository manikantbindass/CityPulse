"""Real synthetic release journey against Compose; never mocks a service response."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from data_pipeline import generate, publish  # noqa: E402
sys.path.insert(0, str(ROOT / 'services/ingestion'))
from citypulse_ingestion.pipeline import ingest  # noqa: E402


def main():
    env = dict(line.split('=', 1) for line in (ROOT / '.env').read_text().splitlines()
               if '=' in line and not line.startswith('#'))
    env.update(os.environ)
    token = env['LOCAL_API_TOKEN']
    base = f"http://127.0.0.1:{env.get('API_PORT', '8080')}"
    out = ROOT / '.build/release-journey'
    out.mkdir(parents=True, exist_ok=True)

    def api(path, body=None, key=None):
        headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        if key:
            headers['Idempotency-Key'] = key
        request = Request(base + path, data=json.dumps(body).encode() if body is not None else None,
                          headers=headers)
        with urlopen(request, timeout=30) as response:
            assert response.status == 200
            return json.load(response)

    catalog = generate(out, 'bengaluru', seed=731)
    raw = out / 'observations.json'
    validated = ingest(raw, catalog, {})
    assert len(validated['accepted']) == 56 and not validated['deadLetters']
    replay = ingest(raw, catalog, validated['state'])
    assert not replay['accepted'], 'Duplicate input must not be ingested again'
    publication = publish(validated['accepted'], catalog, base, token)
    assert publication['createdOrReplayed'] == 56
    query = urlencode({'cityId': publication['cityId'], 'commodity': 'rice', 'unit': 'kg',
                       'from': '2026-01-01T00:00:00Z', 'to': '2026-01-29T00:00:00Z'})
    metrics = api('/api/v1/analytics/metrics?' + query)
    request = Request(base + '/api/v1/reports/export?' + query,
                      headers={'Authorization': f'Bearer {token}'})
    with urlopen(request, timeout=15) as response:
        csv = response.read()
        assert response.headers['X-Export-Limit'] == '100'
        assert csv.startswith(b'id,kind,commodity,quantity,unit,observed_at')
        assert len(csv.splitlines()) == 57
        (out / 'observations.csv').write_bytes(csv)
    summary = metrics['summary'][0]
    assert summary['observations'] == 56 and summary['supply'] > 0
    assert abs(summary['demand_supply_ratio'] - summary['demand']/summary['supply']) < .00001
    rows = json.loads(raw.read_text())
    paired = {}
    for row in rows:
        paired.setdefault(row['observedAt'], {'time': row['observedAt']})[row['kind']] = row['quantity']
    payload = {'city': 'bengaluru', 'district': 'central', 'category': 'groceries',
               'dataMode': 'synthetic', 'horizon': 7, 'observations': list(paired.values())}
    forecast = api('/api/v1/forecast-jobs', payload, 'release-forecast-731-v1')
    assert len(forecast['predictions']) == 7 and forecast['dataMode'] == 'synthetic'
    session = api('/api/v1/pulseai/sessions', {})
    explanation = api(f"/api/v1/pulseai/sessions/{session['id']}/messages", {
        'question': 'Explain observed supply and demand and cite source provenance',
        'cityId': publication['cityId'], 'commodity': 'rice', 'unit': 'kg',
        'from': '2026-01-01T00:00:00Z', 'to': '2026-01-29T00:00:00Z'})
    assert not explanation['empty'] and explanation['statements']
    assert all(fact['evidence'] for fact in explanation['statements'])
    report = {'dataMode': 'synthetic', 'publication': publication, 'metrics': metrics,
              'forecast': forecast, 'explanation': explanation}
    serialized = json.dumps(report, sort_keys=True, separators=(',', ':'))
    (out / 'analytical-report.json').write_text(serialized, encoding='utf-8')
    digest = hashlib.sha256(serialized.encode()).hexdigest()
    receipt = api('/api/v1/verifications', {'payload': serialized}, 'release-report-' + digest)
    # Deploy and attest this exact exported report on the Compose local EVM.
    compose = ['docker', 'compose', '-f', 'compose.yaml', '-f', 'infrastructure/monitoring/compose.yaml', '--profile', 'chain']
    subprocess.run(compose + ['cp', str(out / 'analytical-report.json'), 'chain:/tmp/release-report.json'], cwd=ROOT, check=True)
    subprocess.run(compose + ['exec', '-T', '-w', '/app/blockchain', '-e',
        'CITYPULSE_REPORT_PATH=/tmp/release-report.json', 'chain', 'node',
        '../node_modules/hardhat/dist/src/cli.js', 'run', 'scripts/local-demo.ts', '--network', 'localhost'], cwd=ROOT, check=True)
    subprocess.run(compose + ['cp', 'chain:/app/.data/blockchain/local-demo-result.json', str(out / 'chain.json')], cwd=ROOT, check=True)
    chain = json.loads((out / 'chain.json').read_text())
    assert chain['contentHash'] == '0x' + digest and chain['verified'] and not chain['tamperedVerified']
    override = {'services': {'api': {'environment': {
        'BLOCKCHAIN_RPC_URL': 'http://chain:8545', 'BLOCKCHAIN_CHAIN_ID': '31337',
        'ATTESTATION_CONTRACT_ADDRESS': chain['contracts']['DatasetAttestationRegistry'],
        'ATTESTATION_EVENT_TOPIC': chain['eventTopic']}}}}
    config = out / 'chain.compose.json'
    config.write_text(json.dumps(override), encoding='utf-8')
    subprocess.run(compose[:2] + ['-f', 'compose.yaml', '-f', str(config), '--profile', 'chain',
                   'up', '-d', '--no-deps', '--wait', '--wait-timeout', '180', 'api'], cwd=ROOT, check=True)
    confirmed = api(f"/api/v1/verifications/{receipt['id']}/receipt", {
        'transactionHash': chain['transactionHash'], 'attestationId': chain['attestationId']})
    assert confirmed['status'] == 'CHAIN_CONFIRMED', confirmed
    report['verification'] = confirmed
    (out / 'result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('PASS release journey: 56 validated/persisted rows, metrics, stored forecast, cited explanation, report, actual local-EVM proof and Java RPC confirmation')


if __name__ == '__main__':
    main()
