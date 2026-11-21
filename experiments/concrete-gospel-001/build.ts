/**
 * Build CONCRETE GOSPEL from source into experiments/concrete-gospel-001/build/ (deleted and recreated each run).
 *
 *   node experiments/concrete-gospel-001/build.ts
 *
 * 1. compose.ts writes the rack score and the engine project (source/).
 * 2. The Signature Rack renders the rack + Timbre Lab parts to aligned stems (Timbre Lab registered with --import).
 * 3. An isolated engine project is assembled in build/project: copies of the V12 Signature kit WAVs it uses, the rack
 *    stems, two small kits (kick layers, choir) and the project JSON. Nothing outside this experiment is written.
 * 4. The unchanged DaemonV12 engine validates and renders it: master WAV + MP3, aligned stems, analysis, manifest.
 * Needs Node 22.18+ and FFmpeg with libmp3lame (production effects, MP3, loudness).
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rackScore, project, KICK_KIT, CHOIR_KIT_JSON } from './compose.ts';

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = resolve(HERE, '..', '..'), BUILD = join(HERE, 'build');
const run = (args: string[], label: string) => {
  const t0 = Date.now(), r = spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) { console.error(r.stdout, r.stderr); throw new Error(`${label} failed (exit ${r.status})`); }
  console.error(`${label}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return r.stdout;
};

rmSync(BUILD, { recursive: true, force: true });
mkdirSync(BUILD, { recursive: true });
// 1. source
run([join(HERE, 'compose.ts')], 'compose');
// 2. rack stems
const rackOut = join(BUILD, 'rack');
run(['--import', './timbre-lab/register.ts', 'studio-001/rack/cli.ts', 'render', join(HERE, 'source', 'concrete-gospel.rack.json'), rackOut, '--no-mp3'], 'rack render');
// 3. isolated engine project
const proj = join(BUILD, 'project'), assets = join(proj, 'assets');
mkdirSync(join(assets, 'v12'), { recursive: true }); mkdirSync(join(assets, 'rack'), { recursive: true });
const V12 = join(REPO, 'packs', 'v12-signature-v1', 'assets', 'v12-signature');
copyFileSync(join(V12, 'kit.json'), join(assets, 'v12', 'kit.json'));
for (const f of ['01-sub-hammer.wav', '02-iron-pulse.wav', '03-titanium-crack.wav', '04-neon-clap.wav', '05-ghost-tick.wav', '06-open-circuit.wav', '14-chrome-strike.wav']) copyFileSync(join(V12, f), join(assets, 'v12', f));
for (const p of rackScore.parts) copyFileSync(join(rackOut, 'stems', `${p.id}.wav`), join(assets, 'rack', `${p.id}.wav`));
copyFileSync(join(rackOut, 'stems', 'room.wav'), join(assets, 'rack', 'room.wav'));
writeFileSync(join(assets, 'kick-kit.json'), JSON.stringify(KICK_KIT, null, 2) + '\n');
writeFileSync(join(assets, 'choir-kit.json'), JSON.stringify(CHOIR_KIT_JSON, null, 2) + '\n');
const projectFile = join(proj, 'concrete-gospel.json');
writeFileSync(projectFile, JSON.stringify(project, null, 1) + '\n');
// 4. engine validate + render
run(['bin/daemonv12.js', 'validate', projectFile], 'engine validate');
const out = run(['bin/daemonv12.js', 'render', projectFile, '--out-dir', join(BUILD, 'render'), '--stems', '--format', 'wav,mp3', '--json'], 'engine render');
writeFileSync(join(BUILD, 'render-result.json'), out);
const res = JSON.parse(out) as { analysis?: { master?: Record<string, unknown> }; warnings?: unknown[] };
console.log(JSON.stringify({ master: res.analysis?.master, warnings: res.warnings ?? [] }, null, 2));
if (!existsSync(join(BUILD, 'render', 'concrete-gospel.wav'))) throw new Error('no master written');
