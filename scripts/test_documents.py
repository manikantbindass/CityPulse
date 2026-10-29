"""Regression checks for document evidence boundaries, not application behavior."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


report = module('report_build', 'docs/reports/source/build.py')
deck = module('deck_build', 'docs/presentations/source/build.py')


class EvidenceTests(unittest.TestCase):
    def test_report_rejects_path_escape(self):
        with self.assertRaises(ValueError):
            report.source_file('../outside.txt')

    def test_deck_rejects_path_escape(self):
        with self.assertRaises(ValueError):
            deck.asset('../outside.txt')

    def test_missing_evidence_is_not_silently_skipped(self):
        with self.assertRaises(ValueError):
            deck.asset('docs/nonexistent-evidence.json')

    def test_full_snapshot_required(self):
        with patch.dict(report.CONFIG, snapshot='main'):
            with self.assertRaisesRegex(ValueError, 'full inspected'):
                report.verify_application_snapshot()

    def test_stale_application_snapshot_rejected(self):
        with patch.object(report.subprocess, 'run') as command:
            command.return_value.stdout = b'changed application code'
            with self.assertRaisesRegex(ValueError, 'snapshot is stale'):
                report.verify_application_snapshot()

    def test_expected_diagrams_exist(self):
        specs = report.load('docs/reports/source/diagrams.json')
        for key in ['context', 'containers', 'erd', 'ml', 'blockchain', 'deployment']:
            ids = {row[0] for row in specs[key]['nodes']}
            for start, end, _ in specs[key]['edges']:
                self.assertIn(start, ids)
                self.assertIn(end, ids)


if __name__ == '__main__':
    unittest.main()
