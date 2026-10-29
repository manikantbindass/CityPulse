"""Deterministic, offline technical-report build from editable text and measured artifacts."""
from __future__ import annotations

import ast
import hashlib
import json
import math
import re
import subprocess
import textwrap
import runpy
from pathlib import Path
from xml.sax.saxutils import escape

import reportlab
from reportlab.graphics import renderSVG
from reportlab.graphics.shapes import Drawing, Rect, Line, Polygon, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak,
    LongTable, TableStyle, Image, KeepTogether, CondPageBreak,
)
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path(__file__).resolve().parent
OUTPUT = ROOT / "docs/reports/CityPulse-Technical-Report.pdf"
DIAGRAMS = ROOT / "docs/reports/diagrams"
CONFIG = json.loads((SOURCE / "report.json").read_text(encoding="utf-8"))
INK = colors.HexColor("#182b44")
MUTED = colors.HexColor("#526276")
CYAN = colors.HexColor("#087f91")
RULE = colors.HexColor("#d8e1ea")
PALE = colors.HexColor("#f1f5fa")
W, H = 595.276, 841.89
WIDTH = W - 104
MANIFEST: dict[str, str] = {}
route_edge = runpy.run_path(str(SOURCE / 'routing.py'))['route_edge']


def source_file(name: str) -> Path:
    path = (ROOT / name).resolve()
    if not path.is_relative_to(ROOT) or not path.is_file():
        raise ValueError(f"Missing or out-of-repository source: {name}")
    content=path.read_bytes()
    if path.suffix not in {'.png','.jpg','.pdf','.pptx'}:content=content.replace(b'\r\n',b'\n')
    MANIFEST[path.relative_to(ROOT).as_posix()] = hashlib.sha256(content).hexdigest()
    return path


def load(name: str):
    return json.loads(source_file(name).read_text(encoding="utf-8"))


def register_fonts():
    folder = Path(reportlab.__file__).parent / "fonts"
    for name, file in [("Vera", "Vera.ttf"), ("VeraBold", "VeraBd.ttf"),
                       ("VeraItalic", "VeraIt.ttf"), ("VeraBI", "VeraBI.ttf")]:
        pdfmetrics.registerFont(TTFont(name, str(folder / file)))
    pdfmetrics.registerFontFamily("Vera", normal="Vera", bold="VeraBold", italic="VeraItalic", boldItalic="VeraBI")


def verify_application_snapshot():
    """Never label changed application code with an old inspected revision."""
    revision=CONFIG['snapshot']
    if not re.fullmatch(r'[a-f0-9]{40}',revision):
        raise ValueError('A full inspected application commit is required')
    for name in load('docs/reports/source/inspected.json'):
        if name.startswith(('apps/','services/','blockchain/','infrastructure/')) or name=='compose.yaml':
            current=source_file(name).read_bytes().replace(b'\r\n',b'\n')
            recorded=subprocess.run(['git','show',f'{revision}:{name}'],cwd=ROOT,capture_output=True,check=True).stdout.replace(b'\r\n',b'\n')
            if current!=recorded:
                raise ValueError(f'Inspected application snapshot is stale: {name}; review and update report.json')


register_fonts()
STYLES = {
    "body": ParagraphStyle("body", fontName="Vera", fontSize=10, leading=14.2,
                           textColor=INK, spaceAfter=8, allowWidows=0, allowOrphans=0),
    "small": ParagraphStyle("small", fontName="Vera", fontSize=8.1, leading=12,
                            textColor=MUTED, spaceAfter=8),
    "table": ParagraphStyle("table", fontName="Vera", fontSize=8.2, leading=11.7,
                            textColor=INK, spaceAfter=0, splitLongWords=1),
    "th": ParagraphStyle("th", fontName="VeraBold", fontSize=8.2, leading=11.7,
                         textColor=colors.white),
    "h1": ParagraphStyle("h1", fontName="VeraBold", fontSize=22, leading=28,
                         textColor=INK, spaceAfter=18, keepWithNext=True),
    "h2": ParagraphStyle("h2", fontName="VeraBold", fontSize=13, leading=18,
                         textColor=CYAN, spaceBefore=13, spaceAfter=9, keepWithNext=True),
    "cover": ParagraphStyle("cover", fontName="VeraBold", fontSize=48, leading=55,
                            textColor=colors.white, spaceAfter=25),
    "subtitle": ParagraphStyle("subtitle", fontName="Vera", fontSize=20, leading=29,
                               textColor=colors.HexColor("#9feaf0"), spaceAfter=26),
    "code": ParagraphStyle("code", fontName="Vera", fontSize=8.1, leading=12,
                           backColor=PALE, borderPadding=10, spaceAfter=12,
                           textColor=INK, splitLongWords=1),
}


def inline(text: str) -> str:
    text = text.replace('\u25b8', ' / ').replace('\u2192', ' to ')
    text = text.replace("\u2011", "-").replace("\u2013", "-").replace("\u2014", " - ")
    text = re.sub(r"!\[([^]]*)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\[([^]]+)\]\([^)]+\)", r"\1", text)
    text = escape(text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`([^`]+)`", r'<font color="#087f91">\1</font>', text)
    return text


def p(text, kind="body"):
    return Paragraph(inline(str(text)), STYLES[kind])


def table(headers, rows, widths=None):
    count = len(headers)
    widths = widths or [WIDTH / count] * count
    data = [[Paragraph(inline(str(v)), STYLES["th"]) for v in headers]]
    data += [[p(v, "table") for v in row] for row in rows]
    result = LongTable(data, colWidths=widths, repeatRows=1, hAlign="LEFT", spaceAfter=15,
                       splitByRow=1)
    result.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
        ("LINEBELOW", (0, 0), (-1, 0), .7, CYAN),
        ("LINEBELOW", (0, 1), (-1, -1), .3, RULE),
    ]))
    return result


def markdown(text: str, chapter: int):
    result, paragraph, sub = [], [], 0
    lines = text.splitlines()

    def flush():
        if paragraph:
            result.append(p(" ".join(paragraph)))
            paragraph.clear()

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if line.startswith("```"):
            flush(); code = []; language = line[3:]; i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code.append(lines[i]); i += 1
            if language not in {"mermaid", "plantuml"}:
                # Source listings are explanatory snippets, not pages of copied code.
                content = "\n".join(code)
                if len(content) > 1600:
                    content = content[:1600] + "\n[Listing shortened; see cited source.]"
                result.append(Paragraph(escape(content).replace("\n", "<br/>"), STYLES["code"]))
        elif line.startswith("|"):
            flush(); rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                row = [cell.strip() for cell in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r"[: -]+", cell or "-") for cell in row): rows.append(row)
                i += 1
            i -= 1
            if rows:
                n = len(rows[0]); rows = [(r + [""] * n)[:n] for r in rows]
                result.append(table(rows[0], rows[1:]))
        elif re.match(r"^#{1,6} ", line):
            flush(); sub += 1
            result.append(Paragraph(f"{chapter}.{sub}  {inline(re.sub(r'^#+ ', '', line))}", STYLES["h2"]))
        elif not line:
            flush()
        elif line.startswith(("<", "![")):
            flush()
        elif re.match(r"^(?:[-*] |\d+\. )", line):
            flush(); result.append(p("• " + re.sub(r"^(?:[-*] |\d+\. )", "", line)))
        else:
            paragraph.append(line)
        i += 1
    flush()
    return result


class Report(BaseDocTemplate):
    def __init__(self, path):
        super().__init__(str(path), pagesize=(W, H), leftMargin=52, rightMargin=52,
                         topMargin=58, bottomMargin=55, title="CityPulse Technical Report",
                         author=CONFIG["owner"], subject=CONFIG["classification"],
                         invariant=1, pageCompression=1)
        self.current_heading = "CityPulse"
        frame = Frame(52, 55, WIDTH, H - 113, leftPadding=0, rightPadding=0,
                      topPadding=0, bottomPadding=0)
        self.addPageTemplates(PageTemplate(id="report", frames=frame, onPage=self.decorate))

    def decorate(self, canvas, doc):
        canvas.saveState()
        if doc.page == 1:
            canvas.setFillColor(INK); canvas.rect(0, 0, W, H, fill=1, stroke=0)
            canvas.setStrokeColor(colors.HexColor("#29445e"))
            for y in range(60, 850, 34): canvas.line(0, y, W, y)
            canvas.setStrokeColor(colors.HexColor("#64dce6")); canvas.setLineWidth(3)
            canvas.line(52, 745, 160, 745)
        else:
            canvas.setFont("Vera", 7.8); canvas.setFillColor(MUTED)
            canvas.drawString(52, H - 33, "CITYPULSE  /  TECHNICAL IMPLEMENTATION REPORT")
            canvas.setStrokeColor(RULE); canvas.setLineWidth(.5)
            canvas.line(52, H - 42, W - 52, H - 42)
            canvas.line(52, 42, W - 52, 42)
            canvas.drawString(52, 28, f"Synthetic demonstration | snapshot {CONFIG['snapshot'][:8]}")
            canvas.drawRightString(W - 52, 28, str(doc.page))
        canvas.restoreState()

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name == "h1" and re.match(r'^\d{2}\s', flowable.getPlainText()):
            text = flowable.getPlainText()
            key = "section-" + hashlib.sha256(text.encode()).hexdigest()[:12]
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, 0, False)
            self.notify("TOCEntry", (0, text, self.page, key))


def graph(spec):
    nodes = spec["nodes"]
    height = math.ceil(len(nodes)/3)*86+38
    drawing = Drawing(WIDTH, height)
    positions = {}
    for index, node in enumerate(nodes):
        x = 8 + (index % 3) * 164
        y = height-90 - (index // 3) * 86
        positions[node[0]] = (x, y, 146, 62)
    for start, end, label in spec["edges"]:
        top_positions={key:(x,height-y-h,w,h) for key,(x,y,w,h) in positions.items()}
        route=[(x,height-y) for x,y in route_edge(start,end,top_positions,7)]
        for (ax,ay),(bx,by) in zip(route,route[1:]):
            drawing.add(Line(ax, ay, bx, by, strokeColor=CYAN, strokeWidth=1.1))
        (ax,ay),(bx,by)=route[-2:]
        angle = math.atan2(by-ay, bx-ax)
        points = [bx, by, bx-6*math.cos(angle-.45), by-6*math.sin(angle-.45),
                  bx-6*math.cos(angle+.45), by-6*math.sin(angle+.45)]
        drawing.add(Polygon(points, fillColor=CYAN, strokeColor=CYAN))
        # Edge meanings are in the figure source/caption; labels in the narrow
        # inter-node gaps would be covered by the following node's rectangle.
    for ident, title, description in nodes:
        x,y,w,h = positions[ident]
        drawing.add(Rect(x,y,w,h,rx=7,ry=7,fillColor=PALE,strokeColor=RULE,strokeWidth=.7))
        for j,line in enumerate(textwrap.wrap(title, 24)):
            drawing.add(String(x+9,y+h-17-j*12,line,fontName="VeraBold",fontSize=8.1,fillColor=INK))
        for j,line in enumerate(textwrap.wrap(description, 28)[:2]):
            drawing.add(String(x+9,y+20-j*10,line,fontName="Vera",fontSize=7,fillColor=MUTED))
    return drawing


def bar_chart(title, labels, groups, legend, unit):
    drawing = Drawing(WIDTH, 280)
    left, bottom, chartw, charth = 45, 68, WIDTH-60, 175
    maximum = max(max(group) for group in groups) * 1.15 or 1
    for k in range(5):
        y = bottom + charth*k/4
        drawing.add(Line(left,y,left+chartw,y,strokeColor=RULE,strokeWidth=.6))
        drawing.add(String(left-7,y-3,f"{maximum*k/4:.1f}",fontName="Vera",fontSize=7,textAnchor="end",fillColor=MUTED))
    palette = [CYAN, colors.HexColor("#7564c1"), colors.HexColor("#4773b3"),colors.HexColor("#a77943")]
    slot=chartw/len(labels); width=min(34,slot*.78/len(groups))
    for i,label in enumerate(labels):
        for j, group in enumerate(groups):
            x=left+i*slot+(slot-width*len(groups))/2+j*width
            height=charth*group[i]/maximum
            drawing.add(Rect(x,bottom,width-1,height,fillColor=palette[j],strokeColor=None))
        for j,line in enumerate(textwrap.wrap(label, 12)[:3]):
            drawing.add(String(left+(i+.5)*slot,bottom-15-j*9,line,fontName="Vera",fontSize=6.5,textAnchor="middle",fillColor=MUTED))
    drawing.add(String(left,260,title,fontName="VeraBold",fontSize=11,fillColor=INK))
    drawing.add(String(4,245,unit,fontName="Vera",fontSize=7,fillColor=MUTED))
    for j,item in enumerate(legend):
        drawing.add(Rect(left+j*108,8,8,8,fillColor=palette[j],strokeColor=None))
        drawing.add(String(left+12+j*108,9,item,fontName="Vera",fontSize=7,fillColor=MUTED))
    return drawing


def save_svg(drawing, filename, title):
    svg = renderSVG.drawToString(drawing)
    svg = svg.replace('version="1.1"', 'version="1.1" role="img" aria-label="'+escape(title)+'"', 1)
    (DIAGRAMS/filename).write_text(svg,encoding="utf-8")


def api_inventory():
    rows=[]
    for path in sorted((ROOT/"services/api/src/main/java").rglob("*Controller.java")):
        name=path.relative_to(ROOT).as_posix(); text=source_file(name).read_text(encoding="utf-8")
        base=re.search(r'@RequestMapping\("([^"]+)"\)',text)
        prefix=base.group(1) if base else ""
        for match in re.finditer(r'@(Get|Post|Put|Patch|Delete)Mapping(?:\(([^)]*)\))?',text):
            quoted=re.search(r'"([^"]*)"',match.group(2) or "")
            suffix=quoted.group(1) if quoted else ""
            rows.append([match.group(1).upper(),prefix+suffix,path.name])
    for path in sorted((ROOT/"services/ai-engine/citypulse_ai").glob("*.py")):
        name=path.relative_to(ROOT).as_posix(); text=source_file(name).read_text(encoding="utf-8")
        prefix=re.search(r'APIRouter\([^)]*prefix="([^"]+)"',text)
        base=prefix.group(1) if prefix else ""
        tree=ast.parse(text)
        for node in ast.walk(tree):
            if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)):
                for deco in node.decorator_list:
                    if isinstance(deco,ast.Call) and isinstance(deco.func,ast.Attribute) and deco.func.attr in {'get','post','put','patch','delete'} and deco.args and isinstance(deco.args[0],ast.Constant):
                        rows.append([deco.func.attr.upper(),base+str(deco.args[0].value),path.name])
    return sorted(rows,key=lambda r:(r[2],r[1],r[0]))


def split_sql(value):
    chunks=[];start=depth=0;quote=False
    for i,char in enumerate(value):
        if char=="'": quote=not quote
        if not quote:
            if char=="(":depth+=1
            if char==")":depth-=1
            if char=="," and depth==0: chunks.append(value[start:i].strip());start=i+1
    chunks.append(value[start:].strip())
    return chunks


def schema_inventory():
    tables={}
    for path in sorted((ROOT/"services/api/src/main/resources/db/migration").glob("V*.sql")):
        text=source_file(path.relative_to(ROOT).as_posix()).read_text(encoding="utf-8")
        text=re.sub(r'--[^\n]*','',text)
        for match in re.finditer(r'CREATE TABLE\s+(\w+)\s*\((.*?)\);',text,re.S|re.I):
            columns=[]
            for item in split_sql(match.group(2)):
                if not re.match(r'^(?:PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b',item,re.I):
                    key,_,declaration=item.partition(' ')
                    columns.append([key,re.sub(r'\s+',' ',declaration).strip()])
            tables[match.group(1)]=columns
        for match in re.finditer(r'ALTER TABLE\s+(\w+)\s+ADD COLUMN\s+(\w+)\s+([^;]+);',text,re.I):
            tables.setdefault(match.group(1),[]).append([match.group(2),re.sub(r'\s+',' ',match.group(3))])
    return tables


def special(kind):
    result=[]
    if kind=="model-results":
        report=load("docs/reports/model-evaluation.json"); rows=[]
        selected=[item['candidates'][item['selectedModel']] for item in report['segments'].values()]
        maes=[item['test']['mae'] for item in selected]
        coverages=[item['oneStepTestIntervalCoverage'] for item in selected]
        different=sum(item['selectedModel']!=min(item['candidates'],key=lambda name:item['candidates'][name]['test']['mae']) for item in report['segments'].values())
        result.append(p(f"Measured interpretation: selected-model test MAE ranges from {min(maes):.3f} to {max(maes):.3f} synthetic target units. One-step empirical interval coverage ranges from {min(coverages):.1%} to {max(coverages):.1%}, which is not uniformly nominal 90% coverage. In {different} of {len(selected)} segments the validation-selected candidate is not the lowest-test-MAE candidate. This is evidence for transparent model comparison and separate calibration, not a real-city accuracy claim."))
        for segment,item in report['segments'].items():
            model=item['selectedModel'];metrics=item['candidates'][model]
            rows.append([segment,model,f"{metrics['test']['mae']:.3f}",f"{metrics['test']['rmse']:.3f}",f"{metrics['test']['smape_percent']:.2f}",f"{metrics['oneStepTestIntervalCoverage']:.3f}"])
        result.extend([Paragraph("Selected candidates: held-out one-step results",STYLES['h2']),table(['Synthetic segment','Selected','MAE','RMSE','sMAPE %','Coverage'],rows,[150,70,57,57,72,WIDTH-406])])
        labels=[key.replace('amsterdam','AMS').replace('bengaluru','BLR').replace('central','C').replace('north','N').replace('groceries','G').replace('mobility','M') for key in report['segments']]
        models=['seasonal-naive','moving-average','ridge','xgboost']
        groups=[[row['candidates'][model]['test']['mae'] for row in report['segments'].values()] for model in models]
        drawing=bar_chart('Synthetic held-out MAE by candidate',labels,groups,models,'Target units; lower is better')
        save_svg(drawing,'model-mae.svg','Synthetic candidate test MAE')
        result.extend([drawing,p('AMS/BLR label synthetic segments; C/N are central/north and G/M groceries/mobility. Compare within segment; this is not measured real-city accuracy.','small')])
        result.append(Paragraph('All candidate comparisons',STYLES['h2']))
        candidate_rows=[]
        for segment,item in report['segments'].items():
            for model,record in item['candidates'].items():
                if 'test' in record:candidate_rows.append([segment,model,f"{record['validation']['mae']:.3f}",f"{record['test']['mae']:.3f}",str(record['test']['samples'])])
        result.append(table(['Synthetic segment','Candidate','Validation MAE','Test MAE','Test n'],candidate_rows,[155,90,90,80,WIDTH-415]))
        result.append(p('Dataset fingerprint: '+report['datasetFingerprint'],'small'))
    elif kind=='decision-results':
        report=load('docs/reports/decision-evaluation.json')
        rows=[]
        for case in report['cases']:
            plan=case['plan'];rows.append([case['case'],plan.get('status',''),str(plan.get('totalAllocated','not reported')),str(plan.get('totalCost','not reported')),str(case.get('computeMs','not reported'))])
        result.append(table(['Synthetic case','Status','Allocated','Cost','Compute ms'],rows))
        benchmarks=report['benchmarks']
        result.append(table(['Groups','Sources','Candidate lanes','Repeats','Median ms','Max ms'],[[r['groups'],r['sources'],r['candidateLanes'],r['repeats'],r['medianWallMs'],r['maxWallMs']] for r in benchmarks]))
        drawing=bar_chart('Measured local solver wall time',[f"{r['groups']} groups" for r in benchmarks],[[r['medianWallMs'] for r in benchmarks],[r['maxWallMs'] for r in benchmarks]],['Median','Maximum'],'Milliseconds; three repeats per size')
        save_svg(drawing,'solver-wall-time.svg','Measured synthetic solver wall time')
        result.extend([drawing,p(report['interpretation'],'small')])
    elif kind=='load-results':
        report=load('docs/reports/operations/k6-local-ai.json');metrics=report['measured']['metrics']
        duration=metrics['http_req_duration']['values']
        rows=[['Requests',str(metrics['http_reqs']['values']['count'])],['HTTP failure rate',str(metrics['http_req_failed']['values']['rate'])],['Average duration ms',f"{duration['avg']:.3f}"],['Median duration ms',f"{duration['med']:.3f}"],['p95 duration ms',f"{duration['p(95)']:.3f}"],['Maximum duration ms',f"{duration['max']:.3f}"],['Mode / rate / duration',f"{report['mode']} / {report['ratePerSecond']} per second / {report['duration']}"]]
        result.append(table(['Measured k6 field','Actual result'],rows,[200,WIDTH-200]))
        result.append(p(report['note']+' Direct AI on a shared developer host; no Next, Java, DB or external-network latency is included.','small'))
        browser=load('docs/reports/web-performance.json')
        result.append(Paragraph('Historical browser observations',STYLES['h2']))
        result.append(p(browser['environment']))
        result.append(table(['Route','DOMContentLoaded ms','FCP ms','Transferred JS bytes'],[[r['route'],r['domContentLoadedMs'],r.get('firstContentfulPaintMs','n/a'),r['javascriptTransferBytes']] for r in browser['measurements']],[120,125,105,WIDTH-350]))
    elif kind=='screenshots':
        images=[('docs/assets/readme-dashboard.png','Actual local synthetic analytics dashboard; not live city intelligence.'),('docs/assets/readme-decision.png','Actual local synthetic SciPy allocation; a local run is unsaved and has no Java audit persistence.'),('docs/assets/readme-verification.png','Actual verification center evidence state; no public-chain deployment is implied.'),('docs/reports/diagrams/settings-dark.png','Corrected dark settings and success notification from the actual running application.'),('docs/reports/diagrams/settings-light.png','Corrected light settings; portal and notification theme is shared at document level.')]
        for image_index,(name,caption) in enumerate(images):
            from PIL import Image as PILImage
            path=source_file(name)
            with PILImage.open(path) as image:iw,ih=image.size
            height=min(540,WIDTH*ih/iw);width=height*iw/ih
            if image_index:result.append(PageBreak())
            result.extend([p('Application evidence','h2'),Image(str(path),width=width,height=height),Spacer(1,12),p(caption),p('Source: '+name+' | Actual Chromium capture. Synthetic data and unavailable states are preserved.','small')])
    elif kind=='test-results':
        result.append(table(['Check family','Recorded result','Evidence boundary'],[
            ['Java','29 passed, zero CI skips','Linux Testcontainers/PostGIS; local Docker tests skip'],
            ['AI','48 passed','Forecast, prompt-injection, solver and telemetry tests'],
            ['Web units','13 passed','Controls, sessions and streamed request limits'],
            ['Browser','18 passed','Desktop/mobile; includes issue #22 theme regression'],
            ['Ingestion','6 passed','Validation, deduplication, coordinates, time and calculations'],
            ['Solidity','4 passed','Local chain; no professional contract audit'],
            ['Terraform','2 mocked plans passed','No real AWS provisioning'],
            ['Runtime images','Zero gated fixable HIGH/CRITICAL','Lower/unfixed findings outside this gate'],
        ],[100,130,WIDTH-230]))
        result.append(p('Baseline CI: https://github.com/manikantbindass/CityPulse/actions/runs/40910819783. Theme CI: https://github.com/manikantbindass/CityPulse/actions/runs/40922082151. Security: https://github.com/manikantbindass/CityPulse/actions/runs/40922081880. These counts belong to recorded revisions, not future releases.','small'))
    elif kind=='api-inventory':
        result.append(table(['Method','Static route','Declaration'],api_inventory(),[50,265,WIDTH-315]))
        result.append(p('Next adapters: /api/auth/[action], /api/cities, /api/evidence, /api/chain, /api/ml, /api/forecast, /api/pulseai/[[...path]], /api/decisions/[[...path]]. Health/management routes are deployment boundaries; OpenAPI does not grant access.'))
    elif kind=='schema-inventory':
        for name,columns in schema_inventory().items():
            result.append(Paragraph(inline(name),STYLES['h2']))
            result.append(table(['Physical field','SQL declaration / constraints'],columns,[130,WIDTH-130]))
    elif kind=='adrs':
        rows=[]
        for path in sorted((ROOT/'docs/architecture/decisions').glob('0*.md')):
            text=source_file(path.relative_to(ROOT).as_posix()).read_text(encoding='utf-8')
            paragraphs=[line.strip() for line in text.split('\n\n') if line.strip() and not line.strip().startswith('#')]
            rows.append([path.name,' '.join(paragraphs[:3])])
        result.append(table(['Decision record','Context / recorded rationale'],rows,[160,WIDTH-160]))
        result.append(p('Historical ADRs record decisions at their original phase. Later implementation and ADR 009 supersede obsolete planned/implemented statements. Read the full editable ADRs in the repository for the historical context.'))
    elif kind=='commands':
        result.extend(markdown('''| Task | Command / prerequisite |
| --- | --- |
| Local stack | python scripts/dev_stack.py up --chain --observability; Docker/Compose and ignored .env |
| Safe stop | python scripts/dev_stack.py down --chain --observability; named volumes preserved |
| Web checks | npm ci; npm run lint; npm run typecheck; npm test --workspace apps/web |
| Browser suite | npm run build; npm run test:e2e --workspace apps/web; Chromium |
| API | mvn -f services/api/pom.xml verify; Java 21+; Docker for PostGIS tests |
| AI | python -m pytest services/ai-engine/tests; activated service environment |
| Ingestion | python scripts/data_pipeline.py demo; publish needs authorized API |
| Chain | npm run demo:ephemeral --workspace blockchain; public local fixture keys |
| Infrastructure | terraform init -backend=false; terraform validate; terraform test; no apply |
| Report | pip install -r docs/reports/source/requirements.txt; python scripts/build-report.py |
| Report checks | python scripts/check_report.py; optional PyMuPDF render inspection |
''',37))
        result.append(Paragraph('Configuration inventory',STYLES['h2']))
        names=[]
        for line in source_file('.env.example').read_text(encoding='utf-8').splitlines():
            if re.match(r'^[A-Z][A-Z0-9_]*=',line):names.append(line.split('=',1)[0])
        result.append(p('Declared names in .env.example: '+', '.join(names)+'. Values are deliberately omitted.'))
        result.append(table(['Configuration boundary','Handling'],[
            ['OIDC issuer/audience/client','Operator IdP registration; client secret injected, never exposed to browser'],
            ['Session Redis/encryption key','Private TLS store; random 32-byte base64 key; rotation invalidates sessions'],
            ['Database runtime/migrator','Separate restricted runtime and schema-owner migration credentials'],
            ['AI internal identity','Private service credential and server-derived tenant; no browser tenant trust'],
            ['Optional provider','Disabled by default; explicit model/key and conservative cost bounds'],
            ['Local flags/testnet','Never production defaults; public Hardhat test keys hold no real funds'],
        ],[155,WIDTH-155]))
        result.append(Paragraph('Glossary',STYLES['h2']))
        result.append(table(['Term','Meaning'],[
            ['Attestation','Authorized digest reference, not source truth'],['BFF','Server adapter boundary between browser and API'],['C4','Context/container/component/deployment abstraction levels'],['CRS/SRID','Coordinate reference system / stored reference identifier'],['Flow / stock','Quantity over an event interval / inventory snapshot'],['Idempotency','Same scoped operation key and digest returns its recorded result'],['Leakage','Information unavailable at prediction origin entering a model or evaluation'],['MAE / RMSE / sMAPE','Metrics defined in modeling.py; synthetic results are not field accuracy'],['OIDC / PKCE / ACR','Identity protocol / code-exchange protection / assurance claim'],['RPO / RTO','Unverified recovery-point / recovery-time objectives'],['SLI / SLO','Measured indicator / proposed objective'],['Tenant / subject','Server-validated organization scope / authenticated actor'],['LP / MILP','Continuous / mixed-integer linear optimization'],['Unknown','Absent evidence, not an established zero'],
        ],[110,WIDTH-110]))
        result.append(Paragraph('Directory boundaries',STYLES['h2']))
        result.append(table(['Root','Responsibility'],[['apps/','Web application and admin extraction boundary'],['services/','Java API, Python AI and ingestion CLI; reporting boundary'],['packages/','Typed contracts/UI/config boundaries'],['blockchain/','Contracts, deployment/demo/verification scripts and tests'],['data/','Synthetic examples and schemas'],['infrastructure/','Docker, AWS Terraform, monitoring; optional Kubernetes planned'],['docs/','PRD, ADRs, API/security/operations, assets and report sources'],['tests/ and scripts/','Integration guidance, bounded load workloads and developer commands']], [130,WIDTH-130]))
    elif kind=='references':
        refs=load('docs/reports/source/references.json')
        for index,ref in enumerate(refs,1):
            result.append(p(f"[{index}] {ref['title']}. {ref['url']}. Accessed {CONFIG['date']}.",'small'))
        result.append(Paragraph('Inspected repository evidence',STYLES['h2']))
        key_sources=load('docs/reports/source/inspected.json')
        result.append(p('Java source paths below abbreviate services/api/src/main/java/io/citypulse/ as api/. Full paths and hashes remain in evidence.json.','small'))
        result.append(table(['Inspected implementation source','Hash prefix'],[[name.replace('services/api/src/main/java/io/citypulse/','api/'),MANIFEST[name][:12]] for name in key_sources],[WIDTH-85,85]))
        result.append(p('Complete hashes are in source/evidence.json. Report generation is offline: no provider calls, cloud apply, signer operation or service mutation occurs.','small'))
    return result


def build():
    DIAGRAMS.mkdir(exist_ok=True)
    specs=load('docs/reports/source/diagrams.json')
    verify_application_snapshot()
    source_file('docs/reports/source/report.json')
    source_file('docs/reports/source/build.py')
    source_file('docs/reports/source/routing.py')
    # Preload inspected code, migrations and data so references are stable on all passes.
    for name in load('docs/reports/source/inspected.json'):source_file(name)
    story=[Spacer(1,95),Paragraph('CITYPULSE',STYLES['cover']),Paragraph(escape(CONFIG['subtitle']),STYLES['subtitle']),Spacer(1,26)]
    for text in [CONFIG['edition'],CONFIG['classification'],CONFIG['projectVersion'],CONFIG['owner'],CONFIG['repository'],f"Source snapshot: {CONFIG['snapshot'][:12]}",f"Evidence date: {CONFIG['date']}"]:
        style=ParagraphStyle('cover-info',parent=STYLES['small'],textColor=colors.HexColor('#d4e4f2'),fontSize=10,leading=16)
        story.append(Paragraph(escape(text),style))
    story.extend([PageBreak(),Paragraph('Contents',STYLES['h1'])])
    toc=TableOfContents();toc.levelStyles=[ParagraphStyle('toc',fontName='Vera',fontSize=9.2,leading=16,textColor=INK,leftIndent=0,firstLineIndent=0,spaceBefore=5)]
    story.append(toc)
    story.extend([PageBreak(),p('How to read this evidence report','h1'),p('IMPLEMENTED means code exists at the source snapshot. DEMONSTRATED means a cited local/CI experiment ran. PROPOSED means a future target or operational design, not achieved behavior. Synthetic measurements remain labeled throughout.'),p('The source hierarchy is code/migrations, measured JSON and revision-linked workflow evidence, then current operational documentation. Earlier project prose is historical where it contradicts inspected code. A source-hash manifest and editable Markdown/JSON support regeneration.'),p('No legal author name, institutional affiliation, student identity, production deployment, live feed, public explorer, guaranteed investment outcome, external audit or certification is inferred. Repository ownership is the verified GitHub account. No project license has been selected.'),p('Navigation: the table of contents and PDF bookmarks link to numbered chapters. Tables repeat headers; charts state units, scope and limitations. The appendices inventory actual route declarations and schema text rather than guessed endpoints.')])
    figure_number=0
    for number,chapter in enumerate(CONFIG['chapters'],1):
        story.extend([CondPageBreak(180),Paragraph(f"{number:02d}  {inline(chapter['title'])}",STYLES['h1'])])
        text=source_file(chapter['file']).read_text(encoding='utf-8')
        story.extend(markdown(text,number))
        for name in chapter.get('sources',[]):
            source_file(name)
        if chapter.get('sources'):story.append(p('Implementation sources: '+'; '.join(chapter['sources']),'small'))
        story.extend(special(chapter.get('kind','text')))
        for key in chapter.get('figures',[]):
            figure_number+=1
            spec=specs[key];drawing=graph(spec)
            save_svg(drawing,key+'.svg',spec['title'])
            story.append(KeepTogether([Paragraph(f"Figure {figure_number:02d} - {inline(spec['title'])}",STYLES['h2']),drawing,Spacer(1,10),p(spec['caption']),p('Generated from editable source/diagrams.json and the inspected implementation.','small')]))
    doc=Report(OUTPUT);doc.multiBuild(story,maxPasses=6)
    evidence={'snapshot':CONFIG['snapshot'],'date':CONFIG['date'],'owner':CONFIG['owner'],'sourceHashes':dict(sorted(MANIFEST.items())),'outputSha256':hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),'reportlab':reportlab.Version,'limitations':['No real IdP/MFA rollout, cloud apply, penetration test, contract audit or restore drill','Synthetic one-step model evaluation; residual intervals are diagnostic','SQLite AI persistence single-writer; optional queue/storage integration remains planned']}
    (SOURCE/'evidence.json').write_text(json.dumps(evidence,indent=2)+'\n',encoding='utf-8')
    print(f"Created {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")


if __name__=='__main__':build()
