import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from citypulse_ingestion.pipeline import ingest, normalize, metrics, haversine

CATALOG={"sourceUri":"urn:test:synthetic","licenseReference":"synthetic test","timezone":"Asia/Kolkata","currency":"INR","dataMode":"synthetic","bounds":[77,12,78,13]}
ROW={"cityId":"10000000-0000-0000-0000-000000000001","zoneId":"20000000-0000-0000-0000-000000000001","sourceId":"40000000-0000-0000-0000-000000000001","externalId":"row-1","kind":"demand","commodity":" Rice ","quantity":10,"unit":"kg","observedAt":"2026-01-01T05:30:00+05:30","periodEnd":"2026-01-02T05:30:00+05:30","longitude":77.5,"latitude":12.5}

class PipelineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        (Path(__file__).resolve().parents[3] / ".data").mkdir(parents=True, exist_ok=True)

    def test_cleaning_and_timezone(self):
        value=normalize(ROW,CATALOG)
        self.assertEqual(value["commodity"],"rice")
        self.assertEqual(value["observedAt"],"2026-01-01T00:00:00+00:00")
        self.assertEqual(value["qualityScore"],1)

    def test_invalid_rows(self):
        for changes in [{"quantity":-1},{"quantity":"NaN"},{"quantity":1.12345},{"unit":"unknown"},{"timezone":"No/Zone"},{"longitude":181},{"longitude":76},{"observedAt":"2026-01-01T00:00:00"},{"periodEnd":"2025-01-01T00:00:00Z"},{"email":"private@example.test"}]:
            with self.subTest(changes=changes),self.assertRaises(ValueError):normalize({**ROW,**changes},CATALOG)
        with self.assertRaises(ValueError):normalize({"quantity":1},CATALOG)

    def test_duplicates_conflicts_and_checkpoint(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[3] / ".data") as temp:
            path=Path(temp)/"rows.json";path.write_text(json.dumps([ROW,ROW,{**ROW,"quantity":20}]))
            result=ingest(path,CATALOG)
            self.assertEqual(len(result["accepted"]),1);self.assertEqual(result["duplicates"],1);self.assertEqual(len(result["deadLetters"]),1)
            path.write_text(json.dumps([ROW]));repeat=ingest(path,CATALOG,result["state"])
            self.assertEqual(repeat["duplicates"],1)

    def test_calculations_and_unit_isolation(self):
        a=normalize(ROW,CATALOG);b=normalize({**ROW,"kind":"supply","quantity":8,"externalId":"supply"},CATALOG)
        result=metrics([a,b])["groups"][0]
        self.assertEqual(result["ratio"],1.25);self.assertEqual(result["shortage"],2);self.assertEqual(result["surplus"],0)
        self.assertEqual(len(metrics([a,{**b,"unit":"litre"}])["groups"]),2)
        self.assertIsNone(metrics([a])["groups"][0]["ratio"])
        self.assertEqual(haversine((77,12),(77,12)),0)

    def test_geojson_and_unknown_geometry(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[3] / ".data") as temp:
            path=Path(temp)/"points.geojson";value={"type":"FeatureCollection","features":[{"type":"Feature","properties":{k:v for k,v in ROW.items() if k not in {"longitude","latitude"}},"geometry":{"type":"Point","coordinates":[77.5,12.5]}}]};path.write_text(json.dumps(value));self.assertEqual(len(ingest(path,CATALOG)["accepted"]),1)
            value["features"][0]["geometry"]["type"]="Polygon";path.write_text(json.dumps(value))
            with self.assertRaises(ValueError):ingest(path,CATALOG)

if __name__=="__main__":unittest.main()
