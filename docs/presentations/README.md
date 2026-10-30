# Project presentation

The [33-slide PowerPoint](CityPulse-Project-Presentation.pptx) uses a dark 16:9 CityPulse design, editable architecture nodes, three native measured-data charts, actual screenshots, a repository QR code and source-linked speaker notes on every slide. It documents inspected application snapshot `370e60164da719fc506bd69c2796fb59823cc4ba`; synthetic forecasts, experiments, planned cloud deployment and operational limitations are labeled.

Install the pinned document dependencies and regenerate from the repository root:

```sh
python -m pip install -r docs/reports/source/requirements.txt -r docs/presentations/source/requirements.txt
python scripts/build-presentation.py
python scripts/check_documents.py
python scripts/test_documents.py
```

[source/slides.json](source/slides.json) contains editable narrative, source references and speaker notes. [source/build.py](source/build.py) generates editable Python-pptx objects; native chart workbooks are embedded. Architecture labels share the report's [diagram definitions](../reports/source/diagrams.json). [source/evidence.json](source/evidence.json) fingerprints inputs and the output. The [forecast response](source/evidence/forecast-demo.json) is an actual local FastAPI call over synthetic observations, not measured future accuracy. The map screenshot honestly retains the unavailable basemap notice; sample district overlays remain visible.

Arial is a design choice and an installed system font, not a supplied font asset. Fade transitions are optional presentation effects. There are no macros, online media dependencies or external data-linked charts. QR code target: <https://github.com/manikantbindass/CityPulse>.

On Windows with Microsoft PowerPoint installed:

```powershell
powershell -NoProfile -File scripts/render-presentation.ps1
```

This opens the deck read-only and exports all 33 PNG previews plus a preview PDF under ignored `.build/deck-render/`. It closes only the presentation it opened and avoids quitting an application with other open decks. PowerPoint rendering is a local QA step; Linux CI validates OOXML, shape bounds, fonts, notes, charts, evidence hashes and regeneration but cannot assert native PowerPoint rendering. Source hashes normalize text line endings; PowerPoint ZIP timestamps can differ between builds.
