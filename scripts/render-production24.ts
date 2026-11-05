#!/usr/bin/env node
// Explicit experimental path; Composer and the normal engine render command are unchanged.
import { renderProduction24 } from '../src/precision-render.ts';
import { parseArgs } from 'node:util';
try {
  const {positionals, values} = parseArgs({options:{'reuse-voices':{type:'boolean'}},allowPositionals:true});
  const [project, out] = positionals;
  if (!project || !out || positionals.length !== 2) throw new Error('Usage: node scripts/render-production24.ts <project.json> <new-output-directory> [--reuse-voices]');
  process.stdout.write(JSON.stringify(await renderProduction24(project, out, {reuseVoices:values['reuse-voices']}), null, 2) + '\n');
} catch (error) {
  process.stderr.write(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }) + '\n'); process.exitCode = 1;
}
