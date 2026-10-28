"""HTTP smoke checks for a locally running Compose stack using synthetic inputs."""
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

env = {}
if Path(".env").exists():
    env = dict(line.split("=", 1) for line in Path(".env").read_text().splitlines() if "=" in line and not line.startswith("#"))
env.update(os.environ)
token = env["LOCAL_API_TOKEN"]

def check(url, body=None, authenticated=False, key=None):
    headers = {"Authorization": f"Bearer {token}"} if authenticated else {}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if key:
        headers["Idempotency-Key"] = key
    request = Request(url, data=json.dumps(body).encode() if body is not None else None, headers=headers)
    with urlopen(request, timeout=15) as response:
        assert response.status == 200
        data = json.load(response)
    print(f"PASS {url}")
    return data

check(f"http://localhost:{env.get('WEB_PORT', '3000')}/api/health")
api = f"http://localhost:{env.get('API_PORT', '8080')}"
check(f"{api}/actuator/health/readiness")
cities = check(f"{api}/api/v1/cities", authenticated=True)
assert any(city["name"] == "Demo City" for city in cities["items"])
ai = f"http://localhost:{env.get('AI_PORT', '8000')}"
check(f"{ai}/health")
forecast = check(f"{ai}/api/v1/forecasts", {"values": [10, 20, 30], "horizon": 2}, True)
assert forecast["predictions"] == [40, 50]

# Exercise the actual Java orchestration and Next.js server adapter as well as
# direct service health. No sample response is substituted on service failure.
rows = json.loads(Path("data/sample/ml/daily-segments.json").read_text())
segment = [row for row in rows if row["city"] == "bengaluru"
           and row["district"] == "central" and row["category"] == "groceries"][:28]
payload = {
    "city": "bengaluru", "district": "central", "category": "groceries",
    "dataMode": "synthetic", "horizon": 3,
    "observations": [{field: row[field] for field in ["time", "demand", "supply"]}
                     for row in segment],
}
job = check(f"{api}/api/v1/forecast-jobs", payload, True, "citypulse-smoke-forecast-v1")
assert len(job["predictions"]) == 3 and job["trainingFingerprint"]
stored = check(f"{api}/api/v1/forecast-jobs/{job['id']}", authenticated=True)
assert stored["id"] == job["id"]
web = f"http://localhost:{env.get('WEB_PORT', '3000')}"
check(f"{web}/api/cities")
web_job = check(f"{web}/api/ml", payload)
assert len(web_job["predictions"]) == 3 and web_job["dataMode"] == "synthetic"
