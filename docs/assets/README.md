# Branding and screenshot provenance

`citypulse-header.svg` and `citypulse-footer.svg` are local, script-free vectors with CSS-only motion, built-in `prefers-reduced-motion` handling and separate static SVGs. Text and geometry remain readable if styles/animation are stripped. No external fonts, images, JavaScript or foreignObject are embedded. Header and footer use the CityPulse cyan/violet/indigo identity; the narrative is evidence → forecast → constrained decision → verification.

`readme-*.png` are actual local Chromium captures on 2026-10-29, not generated mockups. The dashboard uses labeled synthetic seed data. The decision capture follows a real local Next→FastAPI→SciPy calculation with no response interception. The verification capture preserves actual backend-unavailable/empty status; it does not imply a public-chain deployment. Earlier screenshots are retained as historical UI evidence.

Validate SVG safety, dimensions, Markdown targets and anchors with `python scripts/check_repository.py` and `python scripts/check_readme.py`. GitHub may alter image caching/rendering; the static links remain available independently of animation support.
