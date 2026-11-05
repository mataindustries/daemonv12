#!/usr/bin/env node
// Explicit experimental path; Composer and the normal engine render command are unchanged.
import { renderProduction24 } from '../src/precision-render.ts';
const [project, out, ...extra] = process.argv.slice(2);
if (!project || !out || extra.length) {
  process.stderr.write('Usage: node scripts/render-production24.ts <project.json> <new-output-directory>\n');
  process.exitCode = 2;
} else {
  try { process.stdout.write(JSON.stringify(await renderProduction24(project, out), null, 2) + '\n'); }
  catch (error) { process.stderr.write(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }) + '\n'); process.exitCode = 1; }
}
