/**
 * THE CATHEDRAL EXPERIMENT · the complete verification, reproducible with one command (about 12 minutes):
 *
 *   PYTHON=/path/to/python-with-numpy-and-scipy node experiments/cathedral-experiment-001/verify.ts
 *
 *   1. build --pre-qa (the candidate exactly as measured before the QA/fix pass) and its QA  -> build/qa-before-fix-pass.json
 *   2. build (final), hash every WAV and MP3 under build/listen, build/rack and build/engine
 *   3. build again from scratch, hash again: every file must be byte-identical             -> build/determinism.json
 *   4. QA of the final build                                                               -> build/qa-final.json
 *   5. the rack's freeze check: the approved engines, scripts and auditions are untouched  -> build/freeze-check.txt
 * Every build first proves that the V2 backing is bit-identical to the delivered Concrete Gospel V2 (backing.ts).
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { HERE, REPO } from './backing.ts';

const BUILD = join(HERE, 'build'), PY = process.env.PYTHON || 'python3';
const sh = (cmd: string, args: string[], label: string) => {
  const t0 = Date.now(), r = spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8', maxBuffer: 256 << 20 });
  if (r.status !== 0) { console.error(r.stdout, r.stderr); throw new Error(`${label} failed (exit ${r.status})`); }
  console.error(`${label}: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  return r.stdout;
};
function audioHashes(): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => { for (const e of readdirSync(d).sort()) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else if (/\.(wav|mp3)$/.test(e)) out[relative(BUILD, p)] = createHash('sha256').update(readFileSync(p)).digest('hex'); } };
  for (const d of ['listen', 'rack', 'engine']) walk(join(BUILD, d));
  return out;
}
const build = (pre: boolean) => sh(process.execPath, [join(HERE, 'build.ts'), ...(pre ? ['--pre-qa'] : [])], pre ? 'build --pre-qa' : 'build');
const qa = (out: string) => sh(PY, ['-I', join(HERE, 'qa', 'measure.py'), BUILD, '--json', join(BUILD, out)], `qa -> ${out}`);

build(true);
const preHashes = Object.fromEntries(Object.entries(audioHashes()).filter(([k]) => k.startsWith('listen/')));
qa('qa-before-fix-pass.json');
build(false);
const a = audioHashes();
build(false);
const b = audioHashes();
const differing = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => a[k] !== b[k]);
writeFileSync(join(BUILD, 'determinism.json'), JSON.stringify({
  schema: 'daemonv12.cathedral-experiment.determinism/1', node: process.version,
  check: 'two from-scratch final builds; SHA-256 of every WAV and MP3 under build/listen, build/rack and build/engine',
  files: Object.keys(b).length, identical: differing.length === 0, differing,
  preQaCandidateListeningSha256: preHashes, finalListeningSha256: Object.fromEntries(Object.entries(b).filter(([k]) => k.startsWith('listen/'))),
}, null, 1) + '\n');
if (differing.length) throw new Error(`not deterministic: ${differing.join(', ')}`);
qa('qa-final.json');
const freeze = spawnSync(process.execPath, ['studio-001/rack/cli.ts', 'freeze'], { cwd: REPO, encoding: 'utf8' });
writeFileSync(join(BUILD, 'freeze-check.txt'), `$ node studio-001/rack/cli.ts freeze\n${freeze.stdout}${freeze.stderr}exit ${freeze.status}\n`);
if (freeze.status !== 0) throw new Error('freeze check failed: an approved engine, script or audition changed');
console.log(JSON.stringify({ deterministicFiles: Object.keys(b).length, identical: true, freeze: freeze.stdout.trim() }, null, 1));
