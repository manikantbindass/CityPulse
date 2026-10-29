"""Dependency-free integrity checks for repository assets and local Markdown links."""
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXCLUDE = {".terraform", "node_modules", ".git", ".next", ".venv", "target", "artifacts", "cache", "__pycache__", ".build", ".pytest_cache", ".ruff_cache", "test-results", "playwright-report"}
errors = []
count = 0
for directory, folders, filenames in os.walk(ROOT):
    folders[:] = [name for name in folders if name not in EXCLUDE]
    for filename in filenames:
        path = Path(directory) / filename
        if not path.is_file() or EXCLUDE.intersection(path.relative_to(ROOT).parts):
            continue
        count += 1
        try:
            if path.suffix in {".json", ".geojson"}:
                json.loads(path.read_text(encoding="utf-8-sig"))
            if path.suffix == ".svg":
                tree = ET.parse(path)
                for node in tree.iter():
                    tag = node.tag.split("}")[-1]
                    if tag in {"script", "foreignObject", "iframe"}:
                        errors.append(f"Unsafe SVG element: {path}:{tag}")
                    for key, value in node.attrib.items():
                        if key.lower().startswith("on") or ("href" in key and not value.startswith("#")):
                            errors.append(f"Unsafe SVG attribute: {path}:{key}")
            if path.suffix == ".md":
                content = path.read_text(encoding="utf-8-sig")
                for href in re.findall(r"\]\(([^\s)]+)(?:\s+[^)]*)?\)", content):
                    if href.startswith(("https:", "http:", "mailto:", "#")):
                        continue
                    target = (path.parent / href.split("#")[0]).resolve()
                    if not target.exists():
                        errors.append(f"Missing Markdown link: {path.relative_to(ROOT)} -> {href}")
        except (ValueError, ET.ParseError) as error:
            errors.append(f"{path}: {error}")
if errors:
    sys.exit("\n".join(errors))
print(f"Repository integrity passed: {count} files; JSON, SVG safety, local Markdown targets")
