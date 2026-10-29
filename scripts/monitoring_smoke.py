"""Verify real local telemetry; no synthetic success response or credential logging."""
import json
import time
from urllib.request import urlopen


def get(url):
    with urlopen(url, timeout=3) as response:
        return response.read()


def eventually(check, label):
    deadline = time.monotonic() + 45
    last = None
    while time.monotonic() < deadline:
        try:
            check()
            print("PASS", label)
            return
        except (OSError, ValueError, AssertionError) as error:
            last = type(error).__name__
            time.sleep(1)
    raise SystemExit(f"Telemetry check failed: {label} ({last}); no success inferred")


def targets():
    data = json.loads(get("http://127.0.0.1:9090/api/v1/targets"))
    jobs = {t["labels"]["job"]: t["health"] for t in data["data"]["activeTargets"]}
    assert jobs.get("api") == jobs.get("ai") == "up", jobs


def traces():
    data = json.loads(get("http://127.0.0.1:3200/api/search?limit=5"))
    assert data.get("traces"), "No traces ingested"


eventually(lambda: get("http://127.0.0.1:13133/"), "collector health")
eventually(lambda: get("http://127.0.0.1:3200/ready"), "trace storage readiness")
eventually(targets, "API and AI Prometheus scrape")
eventually(traces, "actual exported spans in Tempo")
