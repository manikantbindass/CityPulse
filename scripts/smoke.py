"""Read-only HTTP smoke checks for a locally running Compose stack."""
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

env = {}
if Path(".env").exists():
    env = dict(line.split("=", 1) for line in Path(".env").read_text().splitlines() if "=" in line and not line.startswith("#"))
env.update(os.environ)
token = env["LOCAL_API_TOKEN"]

def check(url, body=None, authenticated=False):
    headers = {"Authorization": f"Bearer {token}"} if authenticated else {}
    if body is not None:
        headers["Content-Type"] = "application/json"
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
