"""Validate the first line of a Conventional Commit message."""
import re
import sys
from pathlib import Path

subject = Path(sys.argv[1]).read_text(encoding="utf-8").splitlines()[0]
if not re.fullmatch(r"(feat|fix|refactor|perf|docs|test|chore|build|ci|style|revert)(\([a-z0-9-]+\))?!?: .{1,64}", subject):
    sys.exit("Use Conventional Commits: feat(scope): imperative summary (max 72 characters)")
