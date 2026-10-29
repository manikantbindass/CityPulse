"""Cross-platform local lifecycle; invokes tools without a shell or deleting volumes."""
import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def run(command):
    subprocess.run(command, cwd=ROOT, check=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["up", "down", "status", "smoke"])
    parser.add_argument("--observability", action="store_true")
    parser.add_argument("--chain", action="store_true")
    args = parser.parse_args()
    command = ["docker", "compose", "-f", "compose.yaml"]
    if args.observability:
        command += ["-f", "infrastructure/monitoring/compose.yaml"]
    if args.chain:
        command += ["--profile", "chain"]
    try:
        if args.action == "up":
            if not (ROOT / ".env").exists():
                run([sys.executable, "scripts/setup-env.py"])
            run(["docker", "info", "--format", "{{.ServerVersion}}"])
            run(command + ["up", "--build", "-d", "--wait", "--wait-timeout", "300"])
            run([sys.executable, "scripts/smoke.py"])
        elif args.action == "down":
            run(command + ["down"])
        elif args.action == "status":
            run(command + ["ps"])
        else:
            run([sys.executable, "scripts/smoke.py"])
    except (subprocess.CalledProcessError, FileNotFoundError) as error:
        print(f"Local operation failed: {error}. Check Docker engine and prerequisites; no success is assumed.", file=sys.stderr)
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
