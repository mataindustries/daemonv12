/**
 * Build BLACKOUT//ENGINE into experiments/blackout-engine-001/build/<stage>/ (recreated on each run).
 *
 *   node experiments/blackout-engine-001/build.ts            the final master (after the QA/fix pass); writes source/
 *   node experiments/blackout-engine-001/build.ts pre-qa     the candidate exactly as measured before the QA pass
 *
 * Steps:
 *   1. compose.ts writes the score, project and kits (source/ for the final stage, build/pre-qa/source otherwise).
 *   2. The rack renders the bass, voice, clock, log, spring, bearings and gong parts (Timbre Lab registered with
 *      --import, its documented opt-in), plus the shared room.
 *   3. The rack's `kit` command renders the one-shots (kick and snare layers, anvil, breaker). No new instrument.
 *   4. An isolated engine project is assembled in build/<stage>/project from copies of those files and two V12
 *      Signature WAVs, so nothing is referenced outside it.
 *   5. The unchanged DaemonV12 engine validates it and renders the master (WAV + MP3) and its aligned stems.
 * Needs Node 22.18+ and FFmpeg with libmp3lame. About 45 s.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = resolve(HERE, '..', '..');
const stage = process.argv[2] ?? 'final';
if (stage !== 'final' && stage !== 'pre-qa') { console.error('usage: build.ts [final|pre-qa]'); process.exit(2); }
if (stage === 'pre-qa') process.env.BLACKOUT_ENGINE_PRE_QA = '1'; else delete process.env.BLACKOUT_ENGINE_PRE_QA;
const { rackScore, project, KICK_KIT, SNARE_KIT, ANVIL_KIT, BREAKER_KIT, ONE_SHOTS, BPM } = await import('./compose.ts');

const BUILD = join(HERE, 'build', stage);
const run = (args: string[], label: string) => {
  const t0 = Date.now(), r = spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 << 20, env: process.env });
  if (r.status !== 0) { console.error(r.stdout, r.stderr); throw new Error(`${label} failed (exit ${r.status})`); }
  console.error(`${label}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return r.stdout;
};

rmSync(BUILD, { recursive: true, force: true });
mkdirSync(BUILD, { recursive: true });
const source = stage === 'final' ? join(HERE, 'source') : join(BUILD, 'source');
run([join(HERE, 'compose.ts'), source], 'compose');
// 2. rack stems
const rackOut = join(BUILD, 'rack');
run(['--import', './timbre-lab/register.ts', 'studio-001/rack/cli.ts', 'render', join(source, 'blackout-engine.rack.json'), rackOut, '--no-mp3'], 'rack render');
// 3. one-shots with the rack's kit command
const shots = join(BUILD, 'oneshots');
mkdirSync(shots);
for (const [pkg, inst, pitches, art, vel, macro] of ONE_SHOTS) {
  run(['--import', './timbre-lab/register.ts', 'studio-001/rack/cli.ts', 'kit', inst, join(shots, pkg), '--pitches', pitches.join(','), '--articulation', art,
    '--velocity', String(vel), '--beats', '1', '--bpm', String(BPM), ...(macro !== undefined ? ['--macro', String(macro)] : [])], `kit ${pkg}`);
}
// 4. isolated engine project
const proj = join(BUILD, 'project'), assets = join(proj, 'assets');
mkdirSync(join(assets, 'v12'), { recursive: true }); mkdirSync(join(assets, 'rack'), { recursive: true });
const V12 = join(REPO, 'packs', 'v12-signature-v1', 'assets', 'v12-signature');
for (const f of ['02-iron-pulse.wav', '03-titanium-crack.wav']) copyFileSync(join(V12, f), join(assets, 'v12', f));
for (const p of rackScore.parts) copyFileSync(join(rackOut, 'stems', `${p.id}.wav`), join(assets, 'rack', `${p.id}.wav`));
copyFileSync(join(rackOut, 'stems', 'room.wav'), join(assets, 'rack', 'room.wav'));
for (const [pkg] of ONE_SHOTS) cpSync(join(shots, pkg, 'assets'), join(assets, 'oneshots', pkg, 'assets'), { recursive: true });
for (const [name, kit] of [['kick', KICK_KIT], ['snare', SNARE_KIT], ['anvil', ANVIL_KIT], ['breaker', BREAKER_KIT]] as const)
  writeFileSync(join(assets, `${name}-kit.json`), JSON.stringify(kit, null, 2) + '\n');
const file = join(proj, 'blackout-engine.json');
writeFileSync(file, JSON.stringify(project, null, 1) + '\n');
// 5. engine
run(['bin/daemonv12.js', 'validate', file], 'engine validate');
const out = run(['bin/daemonv12.js', 'render', file, '--out-dir', join(BUILD, 'render'), '--stems', '--format', 'wav,mp3', '--json'], 'engine render');
writeFileSync(join(BUILD, 'render-result.json'), out);
const res = JSON.parse(out) as { analysis?: { master?: Record<string, unknown> }; warnings?: unknown[] };
console.log(JSON.stringify({ stage, master: res.analysis?.master, warnings: res.warnings ?? [] }, null, 2));
