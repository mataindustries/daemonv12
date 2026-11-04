#!/usr/bin/env python3
"""Offline alternative using installed PyYAML/jsonschema plus shared JS checks.
Does not replace the Ajv/YAML mutation suite or claim observed agent behavior.
"""
import json
from pathlib import Path
import re
import subprocess
import sys

try:
    import yaml
    from jsonschema import Draft202012Validator
except ImportError as error:
    sys.exit(f"BLOCKED: offline validation requires installed PyYAML and jsonschema: {error}")

package = Path(__file__).resolve().parent.parent
schema = json.loads((package / 'evals/fixtures/plugin.schema.json').read_text())
manifest = json.loads((package / 'plugin.json').read_text())
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema)
validator.validate(manifest)
assert manifest['version'] == '0.4.0'
assert manifest['name'] == 'daemonv12-composer'
for mutated in [dict(manifest, version=3), dict(manifest, invented=True), dict(manifest, name='bad..name')]:
    assert list(validator.iter_errors(mutated)), 'Schema failed to reject malformed manifest'

class UniqueLoader(yaml.SafeLoader):
    pass

def mapping(loader, node):
    keys = [loader.construct_object(key) for key, _ in node.value]
    if len(keys) != len(set(keys)):
        raise ValueError('Duplicate YAML key')
    return yaml.SafeLoader.construct_mapping(loader, node)

UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, mapping)
skill = (package / 'skills/daemonv12-composer/SKILL.md').read_text()
match = re.match(r'^---\n([\s\S]*?)\n---(?:\n|$)', skill)
assert match, 'Skill must start with closed YAML frontmatter.'
frontmatter = yaml.load(match[1], Loader=UniqueLoader)
assert isinstance(frontmatter, dict), 'Frontmatter must be a mapping.'
assert frontmatter['name'] == manifest['name']
description = frontmatter['description']
assert isinstance(description, str), 'Description must be a string.'
assert description.strip() and len(description) <= 1024, 'Description must contain 1–1024 characters.'
try:
    yaml.load('name: first\nname: second\n', Loader=UniqueLoader)
    raise AssertionError('Duplicate YAML accepted')
except ValueError:
    pass

# Use the package's actual text/link/fixture/isolation checks. No substitute parser.
checks = r'''
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkText, checkLinks, checkFixtureCases, checkIsolation } from './evals/validate-package.mjs';
const packageDir = process.cwd();
function walk(dir) {
  for (const entry of readdirSync(dir, {withFileTypes:true})) {
    const file = resolve(dir,entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(md|json|mjs|py)$/.test(file)) {
      const text = checkText(readFileSync(file), file);
      if (file.endsWith('.md')) checkLinks(text,file,packageDir);
      if (file.endsWith('.json')) JSON.parse(text);
    }
  }
}
walk(packageDir);
const activation=JSON.parse(readFileSync('evals/activation-cases.json'));
const behavior=JSON.parse(readFileSync('evals/behavioral-cases.json'));
assert.equal(checkFixtureCases(activation,'activation').size,16);
assert.equal(activation.cases.filter(c=>c.shouldActivate).length,10);
assert.deepEqual([...checkFixtureCases(behavior,'behavior')],Array.from({length:14},(_,i)=>`B${i+11}`));
assert.deepEqual([...readFileSync('evals/README.md','utf8').matchAll(/^\| (B\d+) /gm)].map(m=>m[1]),Array.from({length:24},(_,i)=>`B${String(i+1).padStart(2,'0')}`));
assert.throws(()=>checkText(Buffer.from('bad \n'),'x.md'));
assert.throws(()=>checkText(Buffer.from('```\nunclosed\n'),'x.md'));
assert.throws(()=>checkLinks('[bad](absent.md)',resolve('README.md'),packageDir));
checkIsolation(['plugins/daemonv12-composer/plugin.json']);
assert.throws(()=>checkIsolation(['src/pipeline.ts']));
'''
subprocess.run(['node', '--input-type=module', '-e', checks], cwd=package, check=True)
base = sys.argv[1] if len(sys.argv) > 1 else '17468e7ee1df11b8cef361cf4e49601d5f671589'
paths = subprocess.check_output(['git', 'diff', '--name-only', base, '--'], cwd=package, text=True).splitlines()
assert all(path.startswith('plugins/daemonv12-composer/') for path in paths), paths
print(json.dumps({'status':'passed', 'version':manifest['version'], 'schema':'Draft2020-12/jsonschema', 'frontmatter':'PyYAML unique keys', 'sharedChecks':'text, links, fixtures, isolation', 'base':base, 'limits':'Offline alternative; Ajv/YAML suite and host behavioral runs remain separate.'}, indent=2))
