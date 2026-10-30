"""Reproducible daily segment benchmark. Writes actual metrics, never fixture scores."""

import argparse
import json
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/ai-engine"))
from citypulse_ai.modeling import train_dataset  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path)
    parser.add_argument("--out", type=Path, default=ROOT / ".models")
    parser.add_argument("--report", type=Path, default=ROOT / "docs/reports/model-evaluation.json")
    args = parser.parse_args()
    if args.data:
        rows = json.loads(args.data.read_text())
    else:
        rng = random.Random(42)
        rows = []
        for city in ["bengaluru", "amsterdam"]:
            for district in ["central", "north"]:
                for category in ["groceries", "mobility"]:
                    for day in range(182):
                        date = datetime(2025, 7, 1, tzinfo=timezone.utc) + timedelta(
                            days=day
                        )
                        demand = (
                            100
                            + day * 0.13
                            + [0, 8, 12, 8, 18, 30, 20][date.weekday()]
                            + rng.gauss(0, 4)
                        )
                        rows.append(
                            {
                                "city": city,
                                "district": district,
                                "category": category,
                                "time": date.isoformat(),
                                "demand": round(demand, 4),
                                "supply": round(demand * 0.87, 4),
                                "dataMode": "synthetic",
                            }
                        )
        (ROOT / "data/sample/ml").mkdir(parents=True, exist_ok=True)
        (ROOT / "data/sample/ml/daily-segments.json").write_text(
            json.dumps(rows, indent=2) + "\n"
        )
    report = train_dataset(rows, args.out)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(report, indent=2) + "\n"
    )
    print(
        json.dumps(
            {
                "version": report["id"],
                "segments": len(report["segments"]),
                "dataMode": report["dataMode"],
            }
        )
    )


if __name__ == "__main__":
    main()
