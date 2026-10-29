import http from 'k6/http';
import { check } from 'k6';
const mode = __ENV.TARGET_MODE || 'ai';
const base = __ENV.BASE_URL || 'http://127.0.0.1:8300';
const fixture = JSON.parse(open('../../data/sample/decisions/retail.json'));
export const options = {
  scenarios: {
    bounded: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '1s',
      duration: __ENV.DURATION || '20s',
      preAllocatedVUs: 2,
      maxVUs: 4,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'max'],
};
export default function () {
  if (mode === 'ai') {
    if (!__ENV.LOCAL_API_TOKEN) throw new Error('Set the service token in the environment');
    const response = http.post(`${base}/v1/decisions/evaluate`, JSON.stringify(fixture), {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${__ENV.LOCAL_API_TOKEN}`,
        'X-Tenant-ID': '00000000-0000-0000-0000-000000000001',
      },
      tags: { operation: 'synthetic-decision' },
      timeout: '25s',
    });
    check(response, {
      'optimal synthetic decision': (r) =>
        r.status === 200 && r.json('optimization.status') === 'optimal',
    });
  } else {
    const path = mode === 'api' ? '/api/v1/cities' : '/api/health';
    const response = http.get(`${base}${path}`, {
      headers: mode === 'api' ? { Authorization: `Bearer ${__ENV.LOCAL_API_TOKEN}` } : {},
      tags: { operation: mode === 'api' ? 'registry-read' : 'web-health' },
      timeout: '5s',
    });
    check(response, { 'HTTP 200': (r) => r.status === 200 });
  }
}
export function handleSummary(data) {
  return {
    [__ENV.SUMMARY_PATH || '.build/k6-summary.json']: JSON.stringify(
      {
        dataMode: 'synthetic',
        mode,
        ratePerSecond: 1,
        duration: __ENV.DURATION || '20s',
        note: 'Bounded smoke workload, not a production capacity or SLO claim',
        measured: data,
      },
      null,
      2,
    ),
  };
}
