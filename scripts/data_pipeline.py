"""Reproducible offline demo, incremental ingestion, and bounded API publication."""
from __future__ import annotations
import argparse
import csv
import json
import random
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT / "services/ingestion"))
from citypulse_ingestion.pipeline import ingest, metrics, digest  # noqa: E402


def save(path: Path, value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,indent=2,allow_nan=False)+"\n",encoding="utf-8")


def generate(out: Path, city: str, seed: int = 42):
    profiles=json.loads((ROOT/"data/cities.json").read_text())
    profile=profiles[city]; rng=random.Random(seed)
    catalog={**profile,"sourceUri":f"urn:citypulse:synthetic:{city}:seed-{seed}","licenseReference":"synthetic development fixtures; repository license pending","dataMode":"synthetic","updateFrequency":"manual deterministic generation","schemaVersion":1,"qualityStatus":"not-yet-validated"}
    identifiers={key:str(uuid5(NAMESPACE_URL,f"citypulse:{city}:{key}")) for key in ["cityId","zoneId","sourceId"]}
    rows=[];west,south,east,north=profile["bounds"]
    for day in range(28):
        start=datetime(2026,1,1,tzinfo=timezone.utc)+timedelta(days=day)
        for kind in ["supply","demand"]:
            rows.append({**identifiers,"externalId":f"seed-{seed}-{city}-{day}-{kind}","kind":kind,"commodity":"rice","quantity":round((100 if kind=="demand" else 88)+day*.5+(day%7)*2+rng.uniform(-4,4),4),"unit":"kg","observedAt":start.isoformat(),"periodEnd":(start+timedelta(days=1)).isoformat(),"longitude":round(rng.uniform(west,east),6),"latitude":round(rng.uniform(south,north),6),"timezone":profile["timezone"],"currency":profile["currency"],"dataMode":"synthetic"})
    save(out/"catalog.json",catalog);save(out/"observations.json",rows)
    save(out/"observations.geojson",{"type":"FeatureCollection","features":[{"type":"Feature","properties":{k:v for k,v in row.items() if k not in {"longitude","latitude"}},"geometry":{"type":"Point","coordinates":[row["longitude"],row["latitude"]]}} for row in rows]})
    with (out/"observations.csv").open("w",encoding="utf-8",newline="") as stream:
        writer=csv.DictWriter(stream,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
    return catalog


def api_call(base, path, payload, token, key):
    request=Request(base+path,data=json.dumps(payload).encode(),headers={"Content-Type":"application/json","Authorization":f"Bearer {token}","Idempotency-Key":key})
    for attempt in range(3):
        try:
            with urlopen(request,timeout=15) as response:return json.load(response)
        except HTTPError as error:
            if error.code not in {429,502,503,504}:raise
            if attempt==2:raise
        except URLError:
            if attempt==2:raise
        time.sleep(min(2**attempt,4))


def publish(rows,catalog,base,token):
    west,south,east,north=catalog["bounds"]
    polygon=json.dumps({"type":"MultiPolygon","coordinates":[[[[west,south],[east,south],[east,north],[west,north],[west,south]]]]})
    prefix=digest(catalog)[:24]
    city=api_call(base,"/api/v1/cities",{"name":catalog["name"]+" (synthetic)","countryCode":catalog["countryCode"],"timezone":catalog["timezone"],"boundaryGeoJson":polygon},token,prefix+"-city")["id"]
    zone=api_call(base,"/api/v1/zones",{"cityId":city,"name":"Synthetic analysis zone","boundaryGeoJson":polygon},token,prefix+"-zone")["id"]
    source=api_call(base,"/api/v1/sources",{"provider":"CityPulse synthetic generator","datasetName":catalog["name"],"sourceUri":catalog["sourceUri"],"licenseReference":catalog["licenseReference"],"classification":"public","dataMode":"synthetic","timezone":catalog["timezone"],"currency":catalog["currency"],"updateFrequency":catalog["updateFrequency"]},token,prefix+"-source")["id"]
    outputs=[]
    keys=["externalId","kind","commodity","quantity","unit","observedAt","periodEnd","qualityScore","provenance"]
    for index in range(0,len(rows),50):
        batch=[{**{key:row[key] for key in keys},"cityId":city,"zoneId":zone,"sourceId":source} for row in rows[index:index+50]]
        for row in batch:
            result=api_call(base,"/api/v1/observations",row,token,digest(row))
            outputs.append(result)
    return {"cityId":city,"zoneId":zone,"sourceId":source,"createdOrReplayed":len(outputs),"synthetic":True}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command",choices=["demo","generate","ingest","publish"])
    parser.add_argument("--city",default="bengaluru")
    parser.add_argument("--seed",type=int,default=42)
    parser.add_argument("--out",type=Path,default=ROOT/".data/demo")
    parser.add_argument("--input",type=Path)
    parser.add_argument("--catalog",type=Path)
    parser.add_argument("--api",default="http://localhost:8080")
    args=parser.parse_args();out=args.out;out.mkdir(parents=True,exist_ok=True)
    if args.command in {"generate","demo"}:
        generate(out,args.city,args.seed)
        if args.command=="generate":return
    catalog=json.loads((args.catalog or out/"catalog.json").read_text())
    state_path=out/"state.json"
    state=json.loads(state_path.read_text()) if state_path.exists() else {}
    result=ingest(args.input or out/"observations.json",catalog,state)
    # State is checkpointed after local normalized output is durable. Publication
    # has separate server receipts; a failed upload never fakes a success result.
    existing=json.loads((out/"normalized.json").read_text()) if (out/"normalized.json").exists() else []
    all_rows=existing+result["accepted"]
    save(out/"normalized.json",all_rows);save(state_path,result.pop("state"));save(out/"ingestion-report.json",{k:v for k,v in result.items() if k!="accepted"});save(out/"dead-letters.json",result["deadLetters"]);save(out/"metrics.json",metrics(all_rows))
    if args.command=="publish":
        import os
        token=os.environ.get("LOCAL_API_TOKEN","")
        if not token and (ROOT/".env").exists():
            token=dict(line.split("=",1) for line in (ROOT/".env").read_text().splitlines() if "=" in line and not line.startswith("#")).get("LOCAL_API_TOKEN","")
        if not token:raise SystemExit("Set LOCAL_API_TOKEN or generate .env first")
        try:save(out/"publication.json",publish(all_rows,catalog,args.api,token))
        except (HTTPError,URLError) as error:
            save(out/"publication-dead-letter.json",{"reason":str(error),"retryable":True,"instruction":"Rerun publish. Server idempotency receipts prevent duplicate writes."});raise SystemExit("Publication failed after bounded retries; inspect publication-dead-letter.json")
    print(json.dumps(result["quality"]));print(f"Outputs: {out}")


if __name__=="__main__":main()
