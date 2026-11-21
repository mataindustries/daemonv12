/**
 * Build CONCRETE GOSPEL V2 into experiments/concrete-gospel-002/build/<stage>/ (recreated on each run).
 *
 *   node experiments/concrete-gospel-002/build.ts ab     drum-and-bass only (the A/B against V1), no master processing
 *   node experiments/concrete-gospel-002/build.ts full   the complete V2 (master WAV + MP3, stems, analysis, manifest)
 *
 * Steps: compose.ts writes source/; the rack renders the V1 reed, choir and 808 parts (unchanged, same seeds); the
 * rack's `kit` command renders the four drum one-shots (skin slaps, log rim, HEADLINER context snare); an isolated
 * engine project is assembled in build/project from copies of those files and the V12 kit; the unchanged engine
 * validates and renders it. Needs Node 22.18+ and FFmpeg with libmp3lame.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rackScore, project, drumBassProject, KICK_KIT, SNARE_KIT, CHOIR_KIT_JSON, ONE_SHOTS } from './compose.ts';

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = resolve(HERE, '..', '..');
const stage = process.argv[2];
if (stage !== 'ab' && stage !== 'full') { console.error('usage: build.ts ab|full'); process.exit(2); }
const BUILD = join(HERE, 'build', stage);
const run = (args: string[], label: string) => {
  const t0 = Date.now(), r = spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) { console.error(r.stdout, r.stderr); throw new Error(`${label} failed (exit ${r.status})`); }
  console.error(`${label}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return r.stdout;
};

rmSync(BUILD, { recursive: true, force: true });
mkdirSync(BUILD, { recursive: true });
run([join(HERE, 'compose.ts')], 'compose');
// rack stems: reed, choir, 808 (and the shared room)
const rackOut = join(BUILD, 'rack');
run(['--import', './timbre-lab/register.ts', 'studio-001/rack/cli.ts', 'render', join(HERE, 'source', 'concrete-gospel-v2.rack.json'), rackOut, '--no-mp3'], 'rack render');
// drum one-shots with the rack's kit command (existing interface; nothing new is synthesised)
const shots = join(BUILD, 'oneshots');
mkdirSync(shots);
for (const [pkg, inst, pitch, art, vel, macro] of ONE_SHOTS) {
  run(['--import', './timbre-lab/register.ts', 'studio-001/rack/cli.ts', 'kit', inst, join(shots, pkg), '--pitches', String(pitch), '--articulation', art,
    '--velocity', String(vel), '--beats', '0.5', '--bpm', '144', ...(macro !== undefined ? ['--macro', String(macro)] : [])], `kit ${pkg}`);
}
// isolated engine project
const proj = join(BUILD, 'project'), assets = join(proj, 'assets');
mkdirSync(join(assets, 'v12'), { recursive: true }); mkdirSync(join(assets, 'rack'), { recursive: true });
const V12 = join(REPO, 'packs', 'v12-signature-v1', 'assets', 'v12-signature');
copyFileSync(join(V12, 'kit.json'), join(assets, 'v12', 'kit.json'));
for (const f of ['01-sub-hammer.wav', '02-iron-pulse.wav', '03-titanium-crack.wav', '04-neon-clap.wav', '05-ghost-tick.wav', '06-open-circuit.wav', '14-chrome-strike.wav']) copyFileSync(join(V12, f), join(assets, 'v12', f));
for (const p of rackScore.parts) copyFileSync(join(rackOut, 'stems', `${p.id}.wav`), join(assets, 'rack', `${p.id}.wav`));
copyFileSync(join(rackOut, 'stems', 'room.wav'), join(assets, 'rack', 'room.wav'));
for (const [pkg] of ONE_SHOTS) cpSync(join(shots, pkg, 'assets'), join(assets, 'oneshots', pkg, 'assets'), { recursive: true });
writeFileSync(join(assets, 'kick-kit.json'), JSON.stringify(KICK_KIT, null, 2) + '\n');
writeFileSync(join(assets, 'snare-kit.json'), JSON.stringify(SNARE_KIT, null, 2) + '\n');
writeFileSync(join(assets, 'choir-kit.json'), JSON.stringify(CHOIR_KIT_JSON, null, 2) + '\n');
const file = join(proj, stage === 'ab' ? 'drum-bass-v2.json' : 'concrete-gospel.json');
writeFileSync(file, JSON.stringify(stage === 'ab' ? drumBassProject : project, null, 1) + '\n');
run(['bin/daemonv12.js', 'validate', file], 'engine validate');
const out = run(['bin/daemonv12.js', 'render', file, '--out-dir', join(BUILD, 'render'), '--stems', '--format', 'wav,mp3', '--json'], 'engine render');
writeFileSync(join(BUILD, 'render-result.json'), out);
const res = JSON.parse(out) as { analysis?: { master?: Record<string, unknown> }; warnings?: unknown[] };
console.log(JSON.stringify({ stage, master: res.analysis?.master, warnings: res.warnings ?? [] }, null, 2));
