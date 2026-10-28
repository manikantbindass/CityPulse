"""Inspect and explicitly activate/roll back locally stored model versions."""

import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("command", choices=["list", "activate"])
parser.add_argument("--root", type=Path, default=Path(".models"))
parser.add_argument("--version")
args = parser.parse_args()
if args.command == "list":
    for registry in sorted(args.root.glob("daily-v1-*/registry.json")):
        value = json.loads(registry.read_text())
        print(value["id"], value["dataMode"], len(value["segments"]))
else:
    if (
        not args.version
        or not args.version.startswith("daily-v1-")
        or not args.version.replace("-", "").isalnum()
    ):
        raise SystemExit("Provide a validated daily-v1 version identifier")
    report = args.root / args.version / "registry.json"
    if not report.exists():
        raise SystemExit("Version artifact not found")
    json.loads(report.read_text())
    pointer = args.root / "active.json"
    if pointer.exists():
        (args.root / "previous.json").write_text(pointer.read_text())
    temporary = args.root / "active.tmp"
    temporary.write_text(json.dumps({"id": args.version}))
    temporary.replace(pointer)
    print(
        "Activated",
        args.version,
        "(use the same command with a prior version to roll back)",
    )
