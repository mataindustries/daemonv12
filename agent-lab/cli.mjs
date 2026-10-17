#!/usr/bin/env node
import { pin, run, evaluate } from './runner.mjs';
import { LabError } from './schema.mjs';
try {
  const [command, ...args] = process.argv.slice(2);
  if (!({ pin: 2, run: 3, evaluate: 3 })[command] || args.length !== ({ pin: 2, run: 3, evaluate: 3 })[command])
    throw new LabError('USAGE', 'Usage: node agent-lab/cli.mjs pin EXPERIMENT LOCK | run EXPERIMENT LOCK OUTPUT | evaluate BUNDLE SCORES REPORT', 'See agent-lab/README.md.');
  const result = await ({ pin, run, evaluate })[command](...args);
  process.stdout.write(JSON.stringify(result) + '\n');
} catch (e) {
  process.stderr.write(JSON.stringify({ ok: false, code: e.code || 'IO_ERROR', message: e.message, repair: e.repair || 'Check readable inputs and a fresh writable output path.', ...(e.details ? { details: e.details } : {}) }) + '\n');
  process.exitCode = 1;
}
