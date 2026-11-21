/**
 * Build BLACKOUT//ENGINE (full length) into experiments/blackout-engine-full/build/<stage>/ (recreated on each run).
 *
 *   node experiments/blackout-engine-full/build.ts            the final master (after the QA/fix pass); writes source/
 *   node experiments/blackout-engine-full/build.ts pre-qa     the candidate exactly as measured before the QA pass
 *
 * Steps:
 *   1. compose.ts writes the score, project, kits and stem groups (source/ for the final stage, build/pre-qa/source otherwise).
 *   2. The rack renders the twelve parts and the shared room, with the Timbre Lab registered through its documented
 *      opt-in (--import ./timbre-lab/register.ts).
 *   3. The rack's `kit` command renders the one-shots (kick and snare layers, anvil, breaker). No new instrument.
 *   4. Rack stems that share an engine track (STEM_GROUPS: bells+tine+gong, clock+log+spring, bearings) are summed
 *      sample for sample into one PCM16 stem; the sum is checked for overflow. The engine takes at most 15 tracks.
 *   5. An isolated engine project is assembled in build/<stage>/project from copies of those files and two V12
 *      Signature WAVs, so nothing is referenced outside it.
 *   6. The unchanged DaemonV12 engine validates it and renders master (WAV + MP3) and aligned stems, with its existing
 *      exact voice-reuse option (--reuse-voices) for the repeated drum hits.
 * Needs Node 22.18+ and FFmpeg with libmp3lame. A few minutes.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = resolve(HERE, '..', '..');
const stage = process.argv[2] ?? 'final';
if (stage !== 'final' && stage !== 'pre-qa') { console.error('usage: build.ts [final|pre-qa]'); process.exit(2); }
if (stage === 'pre-qa') process.env.BLACKOUT_FULL_PRE_QA = '1'; else delete process.env.BLACKOUT_FULL_PRE_QA;
const { rackScore, project, KICK_KIT, SNARE_KIT, ANVIL_KIT, BREAKER_KIT, ONE_SHOTS, BPM, STEM_GROUPS } = await import('./compose.ts');

const BUILD = join(HERE, 'build', stage);
const run = (args: string[], label: string) => {
  const t0 = Date.now(), r = spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', maxBuffer: 256 << 20, env: process.env });
  if (r.status !== 0) { console.error(r.stdout, r.stderr); throw new Error(`${label} failed (exit ${r.status})`); }
  console.error(`${label}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return r.stdout;
};
/** PCM16 WAV: returns [channels, samples] from the data chunk (any header layout). */
function readWav(path: string): { channels: number; rate: number; data: Int16Array } {
  const b = readFileSync(path);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${path}: not a WAV`);
  let off = 12, channels = 0, rate = 0, bits = 0;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4), size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') { channels = b.readUInt16LE(off + 10); rate = b.readUInt32LE(off + 12); bits = b.readUInt16LE(off + 22); }
    if (id === 'data') {
      if (bits !== 16) throw new Error(`${path}: ${bits}-bit, expected 16`);
      return { channels, rate, data: new Int16Array(b.buffer.slice(b.byteOffset + off + 8, b.byteOffset + off + 8 + size)) };
    }
    off += 8 + size + (size & 1);
  }
  throw new Error(`${path}: no data chunk`);
}
function writeWav(path: string, channels: number, rate: number, data: Int16Array) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'ascii'); h.writeUInt32LE(36 + data.byteLength, 4); h.write('WAVE', 8, 'ascii'); h.write('fmt ', 12, 'ascii');
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * channels * 2, 28);
  h.writeUInt16LE(channels * 2, 32); h.writeUInt16LE(16, 34); h.write('data', 36, 'ascii'); h.writeUInt32LE(data.byteLength, 40);
  writeFileSync(path, Buffer.concat([h, Buffer.from(data.buffer, data.byteOffset, data.byteLength)]));
}

rmSync(BUILD, { recursive: true, force: true });
mkdirSync(BUILD, { recursive: true });
const source = stage === 'final' ? join(HERE, 'source') : join(BUILD, 'source');
run([join(HERE, 'compose.ts'), source], 'compose');
// 2. rack stems
const rackOut = join(BUILD, 'rack');
run(['--import', './timbre-lab/register.ts', 'studio-001/rack/cli.ts', 'render', join(source, 'blackout-engine-full.rack.json'), rackOut, '--no-mp3'], 'rack render');
// 3. one-shots
const shots = join(BUILD, 'oneshots');
mkdirSync(shots);
for (const [pkg, inst, pitches, art, vel, macro] of ONE_SHOTS) {
  run(['--import', './timbre-lab/register.ts', 'studio-001/rack/cli.ts', 'kit', inst, join(shots, pkg), '--pitches', pitches.join(','), '--articulation', art,
    '--velocity', String(vel), '--beats', '1', '--bpm', String(BPM), ...(macro !== undefined ? ['--macro', String(macro)] : [])], `kit ${pkg}`);
}
// 4-5. isolated engine project, with the summed stem groups
const proj = join(BUILD, 'project'), assets = join(proj, 'assets');
for (const d of ['v12', 'rack', 'groups']) mkdirSync(join(assets, d), { recursive: true });
const V12 = join(REPO, 'packs', 'v12-signature-v1', 'assets', 'v12-signature');
for (const f of ['02-iron-pulse.wav', '03-titanium-crack.wav']) copyFileSync(join(V12, f), join(assets, 'v12', f));
const grouped = new Set(Object.values(STEM_GROUPS).flat());
for (const p of rackScore.parts) if (!grouped.has(p.id)) copyFileSync(join(rackOut, 'stems', `${p.id}.wav`), join(assets, 'rack', `${p.id}.wav`));
copyFileSync(join(rackOut, 'stems', 'room.wav'), join(assets, 'rack', 'room.wav'));
const groupReport: Record<string, { parts: string[]; peak: number }> = {};
for (const [group, parts] of Object.entries(STEM_GROUPS)) {
  const wavs = parts.map(p => readWav(join(rackOut, 'stems', `${p}.wav`)));
  const n = Math.max(...wavs.map(w => w.data.length)), sum = new Int16Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const w of wavs) s += w.data[i] ?? 0;
    if (s > 32767 || s < -32768) throw new Error(`stem group ${group} overflows at sample ${i}`);
    sum[i] = s; peak = Math.max(peak, Math.abs(s));
  }
  writeWav(join(assets, 'groups', `${group}.wav`), wavs[0]!.channels, wavs[0]!.rate, sum);
  groupReport[group] = { parts, peak: Math.round(20 * Math.log10(Math.max(1, peak) / 32768) * 100) / 100 };
}
writeFileSync(join(BUILD, 'stem-groups.json'), JSON.stringify(groupReport, null, 2) + '\n');
for (const [pkg] of ONE_SHOTS) cpSync(join(shots, pkg, 'assets'), join(assets, 'oneshots', pkg, 'assets'), { recursive: true });
for (const [name, kit] of [['kick', KICK_KIT], ['snare', SNARE_KIT], ['anvil', ANVIL_KIT], ['breaker', BREAKER_KIT]] as const)
  writeFileSync(join(assets, `${name}-kit.json`), JSON.stringify(kit, null, 2) + '\n');
const file = join(proj, 'blackout-engine-full.json');
writeFileSync(file, JSON.stringify(project, null, 1) + '\n');
// 6. engine
const validation = run(['bin/daemonv12.js', 'validate', file, '--reuse-voices', '--json'], 'engine validate');
writeFileSync(join(BUILD, 'validate.json'), validation);
const out = run(['bin/daemonv12.js', 'render', file, '--out-dir', join(BUILD, 'render'), '--stems', '--format', 'wav,mp3', '--reuse-voices', '--json'], 'engine render');
writeFileSync(join(BUILD, 'render-result.json'), out);
const res = JSON.parse(out) as { analysis?: { master?: Record<string, unknown> }; warnings?: unknown[] };
console.log(JSON.stringify({ stage, groups: groupReport, master: res.analysis?.master, warnings: res.warnings ?? [] }, null, 2));
