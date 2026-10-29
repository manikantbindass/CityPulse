"""Create a local .env once, using cryptographically random development secrets."""
import secrets
from pathlib import Path

path = Path(".env")
if path.exists():
    raise SystemExit(".env already exists; edit it manually to preserve existing configuration")
content = Path(".env.example").read_text()
for placeholder in ["replace-with-distinct-grafana-password", "replace-with-distinct-runtime-database-password", "replace-with-a-long-random-local-password", "replace-with-another-long-random-local-password", "replace-with-a-random-token-of-at-least-32-characters"]:
    content = content.replace(placeholder, secrets.token_urlsafe(36))
path.write_text(content)
print("Created .env with random local secrets. Values were not printed.")
