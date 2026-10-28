"""Generate the checked-in project report from repository documentation.

Run with Python containing reportlab and pymupdf. Authoring-only dependencies
are supplied by the Codex workspace runtime; application installs do not need them.
"""
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/reports/CityPulse-Technical-Report.pdf"
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverTitle", fontName="Helvetica", fontSize=38, leading=43, textColor=colors.HexColor("#1e382c"), spaceAfter=24))
styles.add(ParagraphStyle(name="ReportBody", fontName="Helvetica", fontSize=10, leading=15, textColor=colors.HexColor("#263b36"), spaceAfter=10, alignment=TA_LEFT))
styles.add(ParagraphStyle(name="ReportHeading", fontName="Helvetica-Bold", fontSize=21, leading=26, textColor=colors.HexColor("#1e382c"), spaceAfter=20))
sections = [
    ("Product and actors", [
        "CityPulse supports urban supply and demand analysis using geospatial context, AI baselines, and traceable data provenance. The current release is a local development foundation with synthetic observations. It does not claim production readiness or real city partnerships.",
        "Citizens inspect public aggregates. Analysts compare districts. City planners investigate service gaps. Business owners review authorized supply information. Data providers submit licensed records. Administrators govern membership and source policy.",
        "The workspace implements responsive navigation, filtering, accessible tables, charts, local reports, planning scenarios, and explicit sample-data disclosures. OIDC web sign-in, provider connectors and an LLM analyst remain separate future integrations."]),
    ("System topology", [
        "Next.js App Router serves marketing and workspace routes. A modular Java 21 Spring Boot API owns tenant-scoped operations. FastAPI isolates the Python inference libraries. PostgreSQL with PostGIS stores authoritative geography and observations. Redis provides short-lived city caching and authenticated request limits.",
        "The API separates DTO/controller boundaries, application operations, domain models, and JPA/JDBC adapters. Spring Security validates OIDC tokens outside the explicit local development profile. Database memberships narrow signed scopes rather than grant new scopes.",
        "Docker Compose defines loopback-bound services, health checks, persistent data volumes, and non-root application images. Kubernetes, Terraform and Redpanda remain planned. Introduce bounded workers and an outbox only when replay or independent consumers justify events."]),
    ("Canonical geospatial data", [
        "Cities and zones use valid WGS84 MultiPolygons. Business Points use longitude before latitude and must be inside their zone. GiST indexes support spatial access. Geographic areas distinguish regions, districts and neighborhoods. Parent boundary edits require controlled descendant revalidation.",
        "Supply and demand observations share a schema with kind, commodity, controlled unit, source, event interval, ingestion timestamp, payload digest, quality score and provenance. Inventories are snapshots. Never combine incompatible units, commodities or temporal windows.",
        "Tenant and composite reference constraints protect storage. Protected queries include tenant scope. Unique source/external IDs and transactionally stored idempotency receipts make retries explicit. The JSON importer validates at most 500 records and 1 MB before atomic persistence."]),
    ("Decision support and verification", [
        "Imbalance sums demand minus supply within a compatible commodity, unit and time window. Opportunity scoring reports positive gap as a share of demand. These heuristics require source completeness and real-world validation before decisions.",
        "Optimization computes a proportional allocation to positive gaps and explicitly does not dispatch resources. Forecast orchestration calls the real FastAPI linear-trend baseline, persists the result and returns the named model. The baseline has no seasonality or calibrated uncertainty.",
        "Browser SHA-256 fingerprints and backend digest receipts are distinct from on-chain verification. The local Solidity registry records submitter-scoped nonzero digests. Wallet submission, canonical payload policy and transaction workers remain future work. A chain digest cannot establish data truth."]),
    ("Security and lifecycle", [
        "The API requires bearer authentication, signed tenant identity, enabled database membership, and least-privilege scopes. Redis abuse limits fail closed. Parameters bind SQL values and sorting is allowlisted. Sensitive writes include audit records in the same transaction. No passwords are stored by the application.",
        "The web preview uses a local development service token. Public hosting requires per-user OIDC sessions, secure cookies, CSRF protection for cookie flows, tenant authorization, TLS and quotas. Demo persona selection only changes navigation.",
        "PII is minimized to subject and display name. Proposed retention is 30 days for raw imports, 24 months for detail, five years for anonymous aggregates and twelve months for audit, subject to source law and legal holds. Automated deletion, backup expiry and legal-hold workflows remain incomplete."]),
    ("Validation and next release", [
        "Repository validation covers file targets, JSON parsing and SVG safety. Web validation includes strict typing, linting, component tests, desktop/mobile browser flows and automated accessibility checks. Java tests cover domain validation, HTTP security, tenant isolation, idempotency and PostGIS constraints. Testcontainers requires a running Docker engine.",
        "Actual executed results and environmental blockers are recorded in docs/validation.md. A test skipped because Docker is unavailable is not evidence of integration success. Performance targets require representative data and repeatable load testing before any production claim.",
        "The next pilot should add real OIDC web sessions, licensed provider connectors, completeness checks, model backtesting, and operational restore drills. Expand asynchronous infrastructure only after measured need. The owner has not selected a repository license."]),
]

story = [Spacer(1, inch), Paragraph("CityPulse", styles["CoverTitle"]), Paragraph("Technical report", styles["ReportHeading"]), Paragraph("Urban intelligence, geospatial evidence, and accountable decisions", styles["ReportBody"]), Spacer(1, 0.4*inch), Paragraph("Local development foundation / 29 October 2026", styles["ReportBody"]), Paragraph("Source of truth: repository PRD, architecture decisions, API behavior and validation report. Synthetic data throughout.", styles["ReportBody"])]
for title, paragraphs in sections:
    story.extend([PageBreak(), Paragraph(escape(title), styles["ReportHeading"])])
    for paragraph in paragraphs:
        story.append(Paragraph(escape(paragraph), styles["ReportBody"]))

def page(canvas, doc):
    canvas.setFillColor(colors.HexColor("#f5efdf"))
    canvas.rect(0, 0, doc.pagesize[0], doc.pagesize[1], fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#637669"))
    canvas.setFont("Helvetica", 8)
    canvas.drawString(54, 30, "CITYPULSE / TECHNICAL FOUNDATION")
    canvas.drawRightString(doc.pagesize[0]-54, 30, str(doc.page))

SimpleDocTemplate(str(OUT), title="CityPulse Technical Report", author="CityPulse contributors", pagesize=(595,842), leftMargin=54, rightMargin=54, topMargin=60, bottomMargin=55).build(story,onFirstPage=page,onLaterPages=page)
print(f"Created {OUT}")
