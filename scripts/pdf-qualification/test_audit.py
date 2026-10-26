"""Run with: python -m unittest discover -s scripts/pdf-qualification -p 'test_*.py'."""
import subprocess
import unittest
from unittest.mock import patch

import audit


class BraveInventoryTests(unittest.TestCase):
    def test_missing_powershell_keeps_gui_unqualified_without_aborting_audit(self):
        with patch.object(audit.subprocess, 'run', side_effect=FileNotFoundError('powershell')):
            result = audit.brave_version()
        self.assertIsNone(result['productVersion'])
        self.assertFalse(result['uiQualified'])
        self.assertIn('powershell', result['error'])

    def test_version_inventory_does_not_qualify_gui_behavior(self):
        completed = subprocess.CompletedProcess([], 0, stdout='1.2.3\n', stderr='')
        with patch.object(audit.subprocess, 'run', return_value=completed):
            result = audit.brave_version()
        self.assertEqual(result['productVersion'], '1.2.3')
        self.assertFalse(result['uiQualified'])


if __name__ == '__main__':
    unittest.main()
