"""Small tracked-source guard. Not a substitute for a dedicated secret scanner."""
import re
import subprocess
from pathlib import Path

patterns = [r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", r"gh[pousr]_[A-Za-z0-9]{30,}", r"AKIA[0-9A-Z]{16}"]
files = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard"], text=True).splitlines()
errors = []
for name in files:
    path = Path(name)
    if path.suffix.lower() in {".png", ".pdf", ".pptx", ".jpg"}:
        continue
    if name == ".env" or (path.name.startswith(".env.") and path.name != ".env.example"):
        errors.append(name)
    try:
        content = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        continue
    if any(re.search(pattern, content) for pattern in patterns):
        errors.append(name)
if errors:
    raise SystemExit("Potential secret material: " + ", ".join(errors))
print("Tracked-source secret guard passed (limited pattern coverage)")
