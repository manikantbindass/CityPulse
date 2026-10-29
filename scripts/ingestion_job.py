"""Run the real CLI and optionally publish bounded job-status gauges to Pushgateway."""
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.request import Request, urlopen

result = subprocess.run([sys.executable, str(Path(__file__).with_name("data_pipeline.py")), *sys.argv[1:]], check=False)
endpoint = os.environ.get("PUSHGATEWAY_URL")
if endpoint:
    now = time.time()
    values = f"citypulse_ingestion_last_run_failed {int(result.returncode != 0)}\ncitypulse_ingestion_last_run_timestamp_seconds {now}\n"
    if result.returncode == 0:
        values += f"citypulse_ingestion_last_success_timestamp_seconds {now}\n"
    try:
        with urlopen(Request(endpoint.rstrip("/") + "/metrics/job/citypulse_ingestion", data=values.encode(), method="POST"), timeout=3):
            pass
    except OSError:
        print("Job metrics unavailable; original job status retained", file=sys.stderr)
sys.exit(result.returncode)
