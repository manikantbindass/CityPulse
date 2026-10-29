# Technical report

The [79-page PDF](CityPulse-Technical-Report.pdf) covers the implemented application at commit `723bb901411f84815f48acf1d5e6cef0a51f112d`, with 37 numbered chapters, a linked table of contents, architecture diagrams, real screenshots, measured synthetic results and source appendices. Evidence was gathered on 30 October 2026. Future infrastructure and operational targets are explicitly distinguished from demonstrated behavior.

From the repository root, using Python 3.12 or later:

```sh
python -m venv .build/documents-venv
# Activate this environment using your shell's standard command.
python -m pip install -r docs/reports/source/requirements.txt -r docs/presentations/source/requirements.txt
python scripts/build-report.py
python scripts/build-presentation.py
python scripts/check_documents.py
python scripts/test_documents.py
```

Editable material is in [source/report.json](source/report.json), [source/chapters](source/chapters), [source/diagrams.json](source/diagrams.json) and [source/references.json](source/references.json). `narrative.md` retains the initial authoring synthesis; the chapter files are the build inputs. The build extracts route declarations and migration columns from code; this is an implementation inventory, not proof that every route was exercised. [source/evidence.json](source/evidence.json) fingerprints the inspected inputs (text uses normalized LF endings) and output. Full Git history is needed for the application snapshot guard; changed inspected application files fail regeneration until the evidence is reviewed.

The offline ReportLab build embeds Bitstream Vera fonts distributed with ReportLab; no font files are copied into this repository. See ReportLab's bundled font license for redistribution terms. SVG figures are generated from local editable node/edge definitions, with no scripts or external references. Photographs are not fabricated: screenshots come from the running synthetic workspace. Measured charts derive from the committed model, solver and k6 JSON artifacts.

Local visual QA used PyMuPDF to render representative pages and check text boundaries. Optional rendering requires `pymupdf==2.0.0`; it is not an application or CI dependency. The Documents workflow validates source hashes, rebuilds both artifacts and checks links/package structure. These checks do not constitute a security audit or model certification.
