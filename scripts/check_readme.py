"""Validate README targets, GitHub-style anchors, image text and local SVG fallbacks."""
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

root = Path(__file__).resolve().parents[1]
text = (root / "README.md").read_text(encoding="utf-8")
errors = []
headings = [re.sub(r"[^\w\s-]", "", h.lower()).replace(" ", "-") for h in re.findall(r"^#{1,6} (.+)$", text, re.M)]
for target in re.findall(r"\]\(([^)\s]+)\)", text):
    if target.startswith("#"):
        if target[1:] not in headings:
            errors.append(f"Missing anchor {target}")
    elif not target.startswith(("https://", "http://", "mailto:")):
        if not (root / target.split("#")[0]).is_file():
            errors.append(f"Missing target {target}")
for tag in re.findall(r"<img\b[^>]*>", text):
    if not re.search(r'alt="[^"\s][^"]*"', tag):
        errors.append("Image has no meaningful alt text")
for path in re.findall(r'(?:src|srcset)="([^" ]+)"', text):
    if not path.startswith("https://") and not (root / path).is_file():
        errors.append(f"Missing HTML image {path}")
for name in ["header", "footer"]:
    path = root / f"docs/assets/citypulse-{name}.svg"
    svg = path.read_text(encoding="utf-8")
    parsed = ET.fromstring(svg)
    if len(svg.encode()) > 20000 or not parsed.get("viewBox"):
        errors.append(f"Invalid size/viewBox {path.name}")
    if "prefers-reduced-motion" not in svg:
        errors.append(f"Missing reduced-motion policy {path.name}")
    static = root / f"docs/assets/citypulse-{name}-static.svg"
    ET.parse(static)
    if "animation:" in static.read_text(encoding="utf-8"):
        errors.append(f"Animated static fallback {static.name}")
if not (root / "docs/reports/CityPulse-Technical-Report.pdf").read_bytes().startswith(b"%PDF-"):
    errors.append("Invalid PDF")
with zipfile.ZipFile(root / "docs/presentations/CityPulse-Project-Presentation.pptx") as deck:
    if "ppt/presentation.xml" not in deck.namelist():
        errors.append("Invalid presentation")
if errors:
    sys.exit("\n".join(errors))
print("README anchors, image alternatives, local targets, SVG/static motion policy and document downloads passed")
