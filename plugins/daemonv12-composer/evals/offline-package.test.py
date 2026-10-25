#!/usr/bin/env python3
"""Exercise the real offline CLI using disposable plugin/git copies only."""
import hashlib
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

PACKAGE = Path(__file__).resolve().parent.parent
SKILL_PATH = Path('skills/daemonv12-composer/SKILL.md')


class OfflineFrontmatterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original_hash = hashlib.sha256((PACKAGE / SKILL_PATH).read_bytes()).digest()

    @classmethod
    def tearDownClass(cls):
        assert hashlib.sha256((PACKAGE / SKILL_PATH).read_bytes()).digest() == cls.original_hash

    def run_validator(self, skill=None):
        with tempfile.TemporaryDirectory(prefix='composer-offline-mutation-') as directory:
            root = Path(directory)
            package = root / 'plugins/daemonv12-composer'
            shutil.copytree(PACKAGE, package, ignore=shutil.ignore_patterns('__pycache__'))
            if skill is not None:
                (package / SKILL_PATH).write_text(skill)
            # HEAD supplies a valid baseline without borrowing the real checkout's Git state.
            subprocess.run(['git', 'init', '-q', str(root)], check=True)
            subprocess.run(['git', '-c', 'user.name=Composer Test', '-c',
                            'user.email=composer-test@example.invalid', 'commit',
                            '--allow-empty', '-qm', 'Temporary validation baseline'],
                           cwd=root, check=True)
            return subprocess.run([sys.executable, str(package / 'evals/validate-package-offline.py'),
                                   'HEAD'], cwd=root, capture_output=True, text=True)

    def assert_rejected(self, skill, message):
        result = self.run_validator(skill)
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn(message, result.stderr)
        self.assertNotIn('"status": "passed"', result.stdout)

    def test_real_package_passes_in_temporary_copy(self):
        result = self.run_validator()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('"status": "passed"', result.stdout)

    def test_closed_scalar_and_folded_headers_pass(self):
        for skill in [
            '---\nname: daemonv12-composer\ndescription: Compose music.\n---\nBody\n',
            '---\nname: daemonv12-composer\ndescription: >-\n  Compose music\n  with DaemonV12.\n---\n',
        ]:
            with self.subTest(skill=skill):
                result = self.run_validator(skill)
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_missing_closing_delimiter_is_rejected(self):
        self.assert_rejected('---\nname: daemonv12-composer\ndescription: Compose music.\n',
                             'closed YAML frontmatter')

    def test_whitespace_only_description_is_rejected(self):
        self.assert_rejected('---\nname: daemonv12-composer\ndescription: "   "\n---\n',
                             'Description must contain')

    def test_unclosed_whitespace_description_is_rejected(self):
        self.assert_rejected('---\nname: daemonv12-composer\ndescription: "   "\n',
                             'closed YAML frontmatter')

    def test_documented_release_baseline_validates_actual_branch(self):
        base = '17468e7ee1df11b8cef361cf4e49601d5f671589'
        instructions = (PACKAGE / 'evals/README.md').read_text()
        command = re.search(r'^node plugins/daemonv12-composer/evals/validate-package\.mjs '
                            r'--validators-dir /tmp/daemonv12-composer-validation-tools '
                            r'--base ([a-f0-9]{40})$', instructions, re.MULTILINE)
        self.assertIsNotNone(command)
        self.assertEqual(command[1], base)
        self.assertIn(f'validate-package-offline.py {base}\n', instructions)
        # The original validator's historical default is intentionally unchanged.
        self.assertIn("export const frozenBase = '56dbdff62bf78e70e898f0dbb49f8044cd561655';",
                      (PACKAGE / 'evals/validate-package.mjs').read_text())
        result = subprocess.run([sys.executable, str(PACKAGE / 'evals/validate-package-offline.py'),
                                 base], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(f'"base": "{base}"', result.stdout)

    def test_duplicate_yaml_keys_remain_rejected(self):
        self.assert_rejected('---\nname: daemonv12-composer\nname: daemonv12-composer\n'
                             'description: Compose music.\n---\n', 'Duplicate YAML key')


if __name__ == '__main__':
    unittest.main(verbosity=2)
