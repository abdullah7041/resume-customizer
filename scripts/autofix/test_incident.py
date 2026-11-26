import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import incident
from patch import split_paths


class RepairTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.out = Path(folder.name) / "output"
        settings = patch.dict(os.environ, {
            "ISSUE": "42", "SIGNAL": "pdf_raster_only", "KIND": "Error", "RELEASE": "a" * 40,
            "GITHUB_REPOSITORY": "owner/repo", "GITHUB_SHA": "b" * 40, "GITHUB_RUN_ID": "1234",
            "GITHUB_RUN_ATTEMPT": "1", "GITHUB_OUTPUT": str(self.out),
        })
        settings.start()
        self.addCleanup(settings.stop)

    def test_consecutive_alerts_share_one_claim(self):
        refs = []
        def github(*args):
            if "--paginate" in args:
                return "[[]]"
            if "--method" in args:
                refs.append({"ref": next(a[4:] for a in args if a.startswith("ref="))})
            return json.dumps(refs)
        with patch.object(incident, "gh", side_effect=github):
            incident.claim()
            incident.claim()
        self.assertEqual(self.out.read_text().splitlines(), ["new=true", "new=false"])
        self.assertEqual(len(refs), 1)

    def test_open_pr_suppresses_new_release(self):
        pulls = [[{"head": {"ref": "codex/autofix-42-older", "repo": {"full_name": "owner/repo"}}}]]
        with patch.object(incident, "gh", return_value=json.dumps(pulls)) as github:
            incident.claim()
        self.assertEqual(github.call_count, 1)
        self.assertEqual(self.out.read_text().strip(), "new=false")

    def test_funding_and_exhaustion(self):
        key = dict(limit=5, limit_reset="monthly", include_byok_in_limit=True, limit_remaining=1)
        self.assertEqual(incident.budget_status(key), "ready")
        self.assertEqual(incident.budget_status(dict(key, limit_remaining=0)), "budget_exhausted")
        for bad in [dict(limit=100), dict(limit_reset=None), dict(limit_remaining=None),
                    dict(include_byok_in_limit=False), dict(limit=True)]:
            self.assertEqual(incident.budget_status(dict(key, **bad)), "budget_unconfirmed")
        with patch.dict(os.environ, STATUS="budget_exhausted", PR_URL=""), patch.object(incident, "send_report") as send:
            incident.report()
            self.assertIn("monthly repair budget is exhausted", send.call_args.args[0])

    def test_patch_scope(self):
        test = "?? src/__tests__/autofix-42.test.ts"
        self.assertEqual(split_paths([test, " M src/sum.ts"], "42"), (test[3:], ["src/sum.ts"]))
        for change in [" M .github/workflows/ci.yml", " M src/__tests__/existing.test.ts",
                       " M src/../tools.ts", " M netlify/functions/autofix-alert.ts"]:
            with self.assertRaises(ValueError):
                split_paths([test, change], "42")

    def test_phone_report_only_links_to_verified_repository(self):
        with patch.dict(os.environ, PR_URL="https://github.com/owner/repo/pull/42"), patch.object(incident, "send_report") as send:
            incident.report()
            self.assertIn("Review and merge on your phone", send.call_args.args[0])
            self.assertIn("https://github.com/owner/repo/pull/42", send.call_args.args[0])
        with patch.dict(os.environ, PR_URL="https://example.com"), patch.object(incident, "send_report") as send:
            incident.report()
            self.assertNotIn("example.com", send.call_args.args[0])


if __name__ == "__main__":
    unittest.main()
