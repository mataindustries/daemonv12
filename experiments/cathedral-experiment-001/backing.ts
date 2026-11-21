/**
 * The approved Concrete Gospel V2 backing, rebuilt and verified.
 *
 * Concrete Gospel V1/V2 live on branch `claude/awesome-dijkstra-nf60w1` (V2 = commit 620426e). Their two compose
 * modules are vendored byte for byte in upstream/ (hashes in upstream/PROVENANCE.json). This module repeats V2's own
 * `build.ts full` steps with exactly the same commands, then compares the result with V2's delivered SHA256SUMS:
 * the master WAV and every engine stem must be bit-identical, or nothing downstream runs. The auditions then reuse
 * this build's assets (V12 kit copies, rack 808 stem, drum one-shots) and V2's own track definitions.
 *
 *   node experiments/cathedral-experiment-001/backing.ts      rebuild V2 into build/v2 and verify it
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as V2 from './upstream/concrete-gospel-002/compose.ts';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '..', '..');
export const V2_BUILD = join(HERE, 'build', 'v2');
export const V2_PROJECT_DIR = join(V2_BUILD, 'project');
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

export function run(args: string[], label: string, extraEnv: Record<string, string> = {}): string {
  const t0 = Date.now(), r = spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', maxBuffer: 256 << 20, env: { ...process.env, ...extraEnv } });
  if (r.status !== 0) { console.error(r.stdout, r.stderr); throw new Error(`${label} failed (exit ${r.status})`); }
  console.error(`${label}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return r.stdout;
}

/** V2's delivered hashes: master WAV and the engine stem WAVs (from its SHA256SUMS, vendored). */
export function v2Recorded(): { master: string; stems: Record<string, string> } {
  const lines = readFileSync(join(HERE, 'upstream', 'concrete-gospel-002', 'delivery', 'SHA256SUMS'), 'utf8').split('\n');
  const get = (suffix: string) => lines.find(l => l.endsWith(`  ${suffix}`))?.split(' ')[0];
  const stems: Record<string, string> = {};
  for (const l of lines) { const m = /^([0-9a-f]{64}) {2}engine-wav\/(.+)\.wav$/.exec(l); if (m) stems[m[2]!] = m[1]!; }
  return { master: get('concrete-gospel-v2.wav')!, stems };
}

/** Rebuild V2 exactly as experiments/concrete-gospel-002/build.ts `full` does, into build/v2. */
export function buildV2(): void {
  rmSync(V2_BUILD, { recursive: true, force: true });
  mkdirSync(V2_BUILD, { recursive: true });
  const src = join(V2_BUILD, 'source');
  mkdirSync(src);
  // what V2's compose.ts writes (same serialisation)
  writeFileSync(join(src, 'concrete-gospel-v2.rack.json'), JSON.stringify(V2.rackScore, null, 1) + '\n');
  writeFileSync(join(src, 'concrete-gospel-v2.project.json'), JSON.stringify(V2.project, null, 1) + '\n');
  const rackOut = join(V2_BUILD, 'rack');
  run(['--import', './timbre-lab/register.ts', 'studio-001/rack/cli.ts', 'render', join(src, 'concrete-gospel-v2.rack.json'), rackOut, '--no-mp3'], 'V2 rack render');
  const shots = join(V2_BUILD, 'oneshots');
  mkdirSync(shots);
  for (const [pkg, inst, pitch, art, vel, macro] of V2.ONE_SHOTS) {
    run(['--import', './timbre-lab/register.ts', 'studio-001/rack/cli.ts', 'kit', inst, join(shots, pkg), '--pitches', String(pitch), '--articulation', art,
      '--velocity', String(vel), '--beats', '0.5', '--bpm', '144', ...(macro !== undefined ? ['--macro', String(macro)] : [])], `V2 kit ${pkg}`);
  }
  const assets = join(V2_PROJECT_DIR, 'assets');
  mkdirSync(join(assets, 'v12'), { recursive: true }); mkdirSync(join(assets, 'rack'), { recursive: true });
  const V12 = join(REPO, 'packs', 'v12-signature-v1', 'assets', 'v12-signature');
  copyFileSync(join(V12, 'kit.json'), join(assets, 'v12', 'kit.json'));
  for (const f of ['01-sub-hammer.wav', '02-iron-pulse.wav', '03-titanium-crack.wav', '04-neon-clap.wav', '05-ghost-tick.wav', '06-open-circuit.wav', '14-chrome-strike.wav']) copyFileSync(join(V12, f), join(assets, 'v12', f));
  for (const p of V2.rackScore.parts) copyFileSync(join(rackOut, 'stems', `${p.id}.wav`), join(assets, 'rack', `${p.id}.wav`));
  copyFileSync(join(rackOut, 'stems', 'room.wav'), join(assets, 'rack', 'room.wav'));
  for (const [pkg] of V2.ONE_SHOTS) cpSync(join(shots, pkg, 'assets'), join(assets, 'oneshots', pkg, 'assets'), { recursive: true });
  writeFileSync(join(assets, 'kick-kit.json'), JSON.stringify(V2.KICK_KIT, null, 2) + '\n');
  writeFileSync(join(assets, 'snare-kit.json'), JSON.stringify(V2.SNARE_KIT, null, 2) + '\n');
  writeFileSync(join(assets, 'choir-kit.json'), JSON.stringify(V2.CHOIR_KIT_JSON, null, 2) + '\n');
  const file = join(V2_PROJECT_DIR, 'concrete-gospel.json');
  writeFileSync(file, JSON.stringify(V2.project, null, 1) + '\n');
  run(['bin/daemonv12.js', 'validate', file], 'V2 engine validate');
  const out = run(['bin/daemonv12.js', 'render', file, '--out-dir', join(V2_BUILD, 'render'), '--stems', '--format', 'wav,mp3', '--json'], 'V2 engine render');
  writeFileSync(join(V2_BUILD, 'render-result.json'), out);
}

/** Compare the rebuild with V2's delivered hashes. Returns a record; throws if anything differs. */
export function verifyV2(): { master: { sha256: string; identical: boolean }; stems: Record<string, { sha256: string; identical: boolean }> } {
  const want = v2Recorded(), R = join(V2_BUILD, 'render');
  const master = sha(readFileSync(join(R, 'concrete-gospel.wav')));
  const stems: Record<string, { sha256: string; identical: boolean }> = {};
  for (const f of readdirSync(join(R, 'concrete-gospel.stems')).filter(x => x.endsWith('.wav')).sort()) {
    const id = f.replace(/\.wav$/, ''), h = sha(readFileSync(join(R, 'concrete-gospel.stems', f)));
    stems[id] = { sha256: h, identical: h === want.stems[id] };
  }
  const missing = Object.keys(want.stems).filter(k => !stems[k]);
  const rec = { master: { sha256: master, identical: master === want.master }, stems };
  if (!rec.master.identical || missing.length || Object.values(stems).some(s => !s.identical))
    throw new Error(`V2 rebuild differs from the delivered V2:\n${JSON.stringify({ rec, missing, want }, null, 1)}`);
  return rec;
}

export const v2Built = () => existsSync(join(V2_BUILD, 'render', 'concrete-gospel.wav'));

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  buildV2();
  const rec = verifyV2();
  writeFileSync(join(V2_BUILD, 'verify.json'), JSON.stringify(rec, null, 1) + '\n');
  console.log(JSON.stringify({ masterIdentical: rec.master.identical, stems: Object.fromEntries(Object.entries(rec.stems).map(([k, v]) => [k, v.identical])) }, null, 1));
}
