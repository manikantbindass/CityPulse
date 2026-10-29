"""Reproduce synthetic evaluation cases and bounded optimization benchmarks."""

import json
import platform
import random
import statistics
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/ai-engine"))
from citypulse_ai.decisions import ENGINE, Scenario, evaluate  # noqa: E402


def main():
    reports = []
    for name in ["retail", "logistics", "public-service"]:
        payload = json.loads((ROOT / f"data/sample/decisions/{name}.json").read_text())
        result = evaluate(Scenario.model_validate(payload))
        reports.append({"case": name, "dataMode": "synthetic", "inputFingerprint": result["inputFingerprint"],
                        "resultFingerprint": result["resultFingerprint"], "plan": result["optimization"],
                        "tradeoffs": result["tradeoffs"], "computeMs": result["computeMs"]})
    rng = random.Random(417)
    benchmarks = []
    for count, sources in [(3, 1), (15, 5), (30, 10)]:
        payload = json.loads((ROOT / "data/sample/decisions/retail.json").read_text())
        payload.update(name=f"Synthetic benchmark {count} groups", budget=100000, includeTradeoffs=False, objective="throughput", minimumCoverage=0)
        payload["districts"] = [{"id": f"d{i}", "city": "bengaluru" if i % 2 else "pune", "name": f"Synthetic group {i}",
                                 "category": "rice", "demand": rng.randint(50, 200), "availability": rng.randint(0, 30)} for i in range(count)]
        payload["stocks"] = [{"id": f"s{i}", "name": f"Synthetic stock {i}", "category": "rice", "quantity": 500, "unitCost": i + 1} for i in range(sources)]
        durations, statuses = [], []
        for _ in range(3):
            start = time.perf_counter()
            result = evaluate(Scenario.model_validate(payload))
            durations.append(round((time.perf_counter() - start) * 1000, 3))
            statuses.append(result["optimization"]["status"])
        benchmarks.append({"groups": count, "sources": sources, "candidateLanes": count * sources,
                           "repeats": 3, "medianWallMs": statistics.median(durations), "maxWallMs": max(durations), "statuses": statuses})
    report = {"engineVersion": ENGINE, "dataMode": "synthetic", "environment": {"platform": platform.system(), "python": platform.python_version()},
              "interpretation": "Measured local examples; three warm/cold-mixed runs per benchmark, not production SLOs or investment outcomes.",
              "cases": reports, "benchmarks": benchmarks}
    (ROOT / "docs/reports/decision-evaluation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    schema = Scenario.model_json_schema()
    (ROOT / "packages/contracts/decision-scenario.schema.json").write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"cases": [{"name": r["case"], "status": r["plan"]["status"]} for r in reports], "benchmarks": benchmarks}, indent=2))


if __name__ == "__main__":
    main()
