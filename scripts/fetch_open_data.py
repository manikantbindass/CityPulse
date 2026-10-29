"""Fetch an explicitly licensed, public HTTPS source into a bounded raw snapshot.

No credentials or automatic discovery. Does not turn boundary/weather records
into demand observations. Mapping to the canonical domain is a separate step.
"""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen, HTTPRedirectHandler, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):
        raise ValueError("Redirects require a separately reviewed source URL")


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest",type=Path)
    parser.add_argument("--out",type=Path,default=Path(".data/public-source"))
    args=parser.parse_args();manifest=json.loads(args.manifest.read_text())
    for field in ["url","allowedHost","licenseReference","licenseUrl","dataMode"]:
        if not manifest.get(field):raise SystemExit(f"Source manifest requires {field}")
    if manifest.get("licenseStatus")!="verified":raise SystemExit("Source license must be verified before fetching")
    url=urlsplit(manifest["url"])
    if url.scheme!="https" or url.hostname!=manifest["allowedHost"] or url.username or url.password:
        raise SystemExit("Use a credential-free HTTPS URL on the exact reviewed host")
    args.out.mkdir(parents=True,exist_ok=True);meta_path=args.out/"metadata.json"
    prior=json.loads(meta_path.read_text()) if meta_path.exists() else {}
    headers={"Accept":"application/json, application/geo+json","User-Agent":"CityPulse-development-import/0.1"}
    if prior.get("etag"):headers["If-None-Match"]=prior["etag"]
    try:
        with build_opener(NoRedirect).open(Request(manifest["url"],headers=headers),timeout=20) as response:
            raw=response.read(10_000_001)
            if len(raw)>10_000_000:raise ValueError("Public source snapshot exceeds 10 MB")
            parsed=json.loads(raw)
            if isinstance(parsed,dict) and "error" in parsed:
                raise ValueError("Provider returned an error document, not a dataset")
            if manifest.get("schema", "").startswith("GeoJSON") and (not isinstance(parsed,dict) or parsed.get("type") != "FeatureCollection"):
                raise ValueError("Provider response does not match the reviewed GeoJSON contract")
            (args.out/"raw.json").write_text(json.dumps(parsed,indent=2)+"\n",encoding="utf-8")
            metadata={**manifest,"fetchedAt":datetime.now(timezone.utc).isoformat(),"sha256":hashlib.sha256(raw).hexdigest(),"etag":response.headers.get("ETag"),"contentType":response.headers.get("Content-Type"),"qualityStatus":"raw-unvalidated; schema mapping required"}
            meta_path.write_text(json.dumps(metadata,indent=2)+"\n",encoding="utf-8")
    except HTTPError as error:
        if error.code==304:print("Source unchanged (ETag)");return
        raise SystemExit(f"Source unavailable: HTTP {error.code}; no access is implied") from error
    print(f"Fetched public snapshot to {args.out}. This is not a live data feed.")

if __name__=="__main__":main()
