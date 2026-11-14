/** Reproduce the listening delivery: node instruments/bollo-coin/proof.ts NEW_DIRECTORY */
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { renderCoin, COIN_VERSION, SR, type Stereo } from './coin.ts';
import { PRESETS } from './presets.ts';
import { renderCoinBridge, type CoinBridgeScore } from './bridge.ts';
import { bridgeWav } from '../../studio-001/v12-bridge/bridge.ts';
import { sha256, verifyFrozen, REPO_ROOT } from '../../studio-001/rack/frozen.ts';
import { crush } from '../../fable-lab/crush/crush.ts';
import { ampDb, bandBalance, gain, peak, rms, truePeak, mp3, r128 } from '../../fable-lab/crush/measure.ts';

export function statistics(x: Stereo) {
  const mono = x[0].map((v, i) => (v + x[1][i]!) / 2);
  let dot = 0, ll = 0, rr = 0;
  for (let i = 0; i < mono.length; i++) { dot += x[0][i]! * x[1][i]!; ll += x[0][i]! ** 2; rr += x[1][i]! ** 2; }
  return { frames: mono.length, seconds: mono.length / SR, samplePeakDbfs: ampDb(peak(x)),
    truePeak4xDbfs: ampDb(truePeak(x)), rmsDbfs: ampDb(rms(x)),
    dc: x.map(ch => ch.reduce((a, b) => a + b, 0) / ch.length),
    correlation: dot / Math.sqrt(ll * rr), monoRmsRelativeDb: ampDb(rms([mono, mono]) / rms(x)),
    lastSample: x.map(ch => ch.at(-1)), bandsDb: bandBalance(x) };
}
const add = (...xs: Stereo[]): Stereo => {
  const out: Stereo = [new Float64Array(xs[0]![0].length), new Float64Array(xs[0]![0].length)];
  for (const x of xs) for (let c = 0; c < 2; c++) for (let i = 0; i < x[c]!.length; i++) out[c]![i] = out[c]![i]! + x[c]![i]!;
  return out;
};
export async function exportProof(directory: string) {
  const out = resolve(directory); mkdirSync(out); mkdirSync(join(out, 'stems'));
  const records: Record<string, unknown> = {}, eventRecords: Record<string, unknown> = {};
  const ff = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (ff.status !== 0) throw new Error(`ffmpeg unavailable: ${ff.error?.message ?? ff.stderr}`);
  const save = (name: string, x: Stereo, encodeMp3 = true) => {
    const file = join(out, `${name}.wav`);
    if (peak(x) >= 0.95) throw new Error(`${name}: delivery headroom exceeded`);
    writeFileSync(file, bridgeWav(x));
    if (encodeMp3) mp3(file, join(out, `${name}.mp3`));
    records[name] = { ...statistics(x), ...r128(file) };
  };
  const specs = [
    ['A-quarter-face', PRESETS.face, 1.2, 0], ['B-quarter-edge', PRESETS.edge, 1.2, 0],
    ['C-quarter-bounce-settle', PRESETS.bounce, 3, 3], ['D-quarter-spin-wobble', PRESETS.spin, 4, 6],
    ['E-quarter-roll-tile', PRESETS.roll, 4, 12],
  ] as const;
  for (const [name, preset, seconds, gainDb] of specs) {
    const a = renderCoin(preset), b = renderCoin(preset);
    if (sha256(bridgeWav(a.audio)) !== sha256(bridgeWav(b.audio))) throw new Error(`${name}: nondeterministic synthesis`);
    const x: Stereo = [new Float64Array(seconds * SR), new Float64Array(seconds * SR)], onset = Math.round(0.08 * SR);
    if (onset + a.plan.frames > x[0].length) throw new Error(`${name}: sample length`);
    for (let c = 0; c < 2; c++) x[c]!.set(a.audio[c]!.map(v => v * 10 ** (gainDb / 20)), onset);
    save(name, x); eventRecords[name] = { onsetFrame: onset, gainDb, plan: a.plan, modes: a.modes };
  }
  const score = JSON.parse(readFileSync(new URL('./proof.score.json', import.meta.url), 'utf8')) as CoinBridgeScore;
  const a = await renderCoinBridge(score), b = await renderCoinBridge(score);
  if (a.audio[0].length !== 5 * SR) throw new Error('groove must be exactly five seconds');
  if (sha256(bridgeWav(a.audio)) !== sha256(bridgeWav(b.audio))) throw new Error('nondeterministic integration');
  save('F-BOLLO-5s-dry', a.audio);
  for (const [id, stem] of a.stems) { writeFileSync(join(out, 'stems', `${id}.wav`), bridgeWav(stem)); }
  const coinStem = add(...[...a.stems].filter(([id]) => !['kick', 'clap', 'room'].includes(id)).map(([, v]) => v));
  const drums = add(a.stems.get('kick')!, a.stems.get('clap')!, a.stems.get('room')!);
  save('G-coins-only-dry', coinStem);
  // Preserve the bright rim and all drums. Process only face + bounce, then blend 25% wet.
  const selected = add(a.stems.get('face')!, a.stems.get('bounce')!);
  const untouched = add(a.stems.get('rim')!, a.stems.get('turn')!, a.stems.get('roll')!);
  const processed = crush(selected, { amount: 0.46, referenceDb: -16, ceilingDb: -6 });
  const wetCoins = add(untouched, gain(selected, 0.75), gain(processed.audio, 0.25));
  const wet = add(drums, wetCoins);
  // Match integrated loudness within 0.1 LU, then deliver the actual applied trim in QA.
  const temp = join(out, 'wet-measure.wav'); writeFileSync(temp, bridgeWav(wet));
  const dryLufs = r128(join(out, 'F-BOLLO-5s-dry.wav')).lufs, wetLufs = r128(temp).lufs;
  const matchDb = dryLufs - wetLufs;
  const { unlinkSync } = await import('node:fs'); unlinkSync(temp);
  const matched = gain(wet, 10 ** (matchDb / 20));
  save('H-BOLLO-5s-selective-CRUSH', matched);
  const ab: Stereo = [new Float64Array(10 * SR), new Float64Array(10 * SR)];
  for (let c = 0; c < 2; c++) { ab[c]!.set(a.audio[c]!); ab[c]!.set(matched[c]!, 5 * SR); }
  save('I-dry-then-selective-CRUSH', ab);
  const protectedHashes = JSON.parse(readFileSync(join(REPO_ROOT, 'proofs/v12-motif-bridge/PROTECTED.json'), 'utf8')) as Record<string, string>;
  const protectedChanges = Object.entries(protectedHashes).filter(([f, hash]) => sha256(readFileSync(join(REPO_ROOT, f))) !== hash).map(([f]) => f);
  if (verifyFrozen().length || protectedChanges.length) throw new Error('protected sources changed');
  const json = (name: string, value: unknown) => writeFileSync(join(out, name), JSON.stringify(value, null, 2) + '\n');
  json('score.json', score); json('events.json', { auditions: eventRecords, groove: a.manifest });
  json('qa.json', { version: COIN_VERSION, node: process.version, ffmpeg: ff.stdout.split('\n')[0], sampleRate: SR,
    sourceHashes: Object.fromEntries(['coin.ts', 'presets.ts', 'bridge.ts', 'proof.ts', 'proof.score.json'].map(f => [f, sha256(readFileSync(new URL(f, import.meta.url)))])),
    rights: 'Coin audio is numeric synthesis only. Kick/clap are unchanged repository V12 signature assets; see their existing provenance.',
    determinism: 'two independent renders: identical PCM24 SHA-256 for each audition and groove',
    frozenFilesVerified: true, protectedBridgeFilesVerified: Object.keys(protectedHashes).length,
    crush: { routing: ['face', 'bounce'], unaffected: ['kick', 'clap', 'rim', 'turn', 'roll'], wetShare: 0.25, matchDb, report: processed.report },
    ab: 'I: 0..5 s dry, 5..10 s selective CRUSH; no gaps or voiceover', records });
  const files = readdirSync(out).filter(f => f !== 'stems').concat(readdirSync(join(out, 'stems')).map(f => `stems/${f}`)).sort();
  writeFileSync(join(out, 'SHA256SUMS'), files.map(f => `${sha256(readFileSync(join(out, f)))}  ${f}\n`).join(''));
  return { out, records };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 3) throw new Error('Usage: node instruments/bollo-coin/proof.ts NEW_DIRECTORY');
  console.log(JSON.stringify(await exportProof(process.argv[2]!), null, 2));
}
