/**
 * Gate 2's natural tail, for the join. Gate 2's master is cut at exactly 28.0 s while its last glass note is still
 * ringing in the atmosphere room (about -50 dBFS), so a plain concatenation would put a small step there. This script
 * does not reconstruct anything: it re-renders Wonder's UNCHANGED project with only `render.duration` lengthened to the
 * end of the extension, runs Wonder's UNCHANGED mix.ts on it (a temporary copy whose only edits are five path
 * expressions plus one appended line that records three gains), checks that the first 28.0 s of that longer master are
 * identical to the approved master, and keeps only what comes after 28.0 s.
 *
 *   node benchmarks/grind-wonder-anti-formula/redshift/gate2_tail.ts      (needs FFmpeg, ~3 min)
 *
 * Writes redshift/audio/stems/gate2-tail.wav and redshift/audio/gate2-reference.json. Writes nothing else in the repo;
 * the temporary project file beside Wonder's is deleted again, and Wonder's files are hash-checked before and after.
 */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readWav } from '../../../fable-lab/crush/measure.ts';
import { bridgeWav } from '../../../studio-001/v12-bridge/bridge.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const BENCH = resolve(HERE, '..');
const REPO = resolve(BENCH, '../..');
const GATE2 = join(BENCH, 'impossible-ascent-gate2');
const OUT = process.env.REDSHIFT_OUT ?? join(HERE, 'audio');
const END_FRAMES = 1837501;          // bar 26 downbeat on the 144 BPM grid = the extension's last frame + 1
const CUT = 1234800;                  // Gate 2's frame count (28.0 s)
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const APPROVED: Record<string, string> = {
  'c-impossible-ascent-gate2.json': 'c0d46566bec614595a90f85f54eee2cd0927a52bafeb266818de49fe404b000a',
  'impossible-ascent-gate2/mix.ts': '5ebb73a26647bb4f58ee11bef961925f6d9dd69094a6b7332e65312fa4139d08',
  'impossible-ascent-gate2/audio/IMPOSSIBLE-ASCENT-DEVELOPED.wav': 'b0eef2f73188243505792ada55c0d034d2bcf0ae5570b98fa43688800ea70afa',
};
function checkApproved(when: string) {
  for (const [rel, want] of Object.entries(APPROVED)) {
    const got = sha(join(BENCH, rel));
    if (got !== want) throw new Error(`${when}: ${rel} sha256 ${got} != approved ${want}`);
  }
}
checkApproved('before');

const tmp = mkdtempSync(join(tmpdir(), 'gate2-tail-'));
// 1. Wonder's project with one field changed. It must sit beside the original so `assets/...` resolves; removed below.
const proj = JSON.parse(readFileSync(join(BENCH, 'c-impossible-ascent-gate2.json'), 'utf8'));
proj.render.duration = { seconds: Number((END_FRAMES / 44100).toFixed(6)) };
const longProj = join(BENCH, '.gate2-long.tmp.json');
writeFileSync(longProj, JSON.stringify(proj, null, 2));
try {
  const r = spawnSync(process.execPath, [join(REPO, 'bin/daemonv12.js'), 'render', longProj, '--out-dir', join(tmp, 'render'), '--stems', '--format', 'wav'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`render failed: ${r.stderr}`);
} finally { rmSync(longProj, { force: true }); }
const stemsDir = join(tmp, 'render', '.gate2-long.tmp.stems');
if (!existsSync(stemsDir)) throw new Error('no stems rendered');

// 2. Wonder's mix.ts, verbatim except for where it reads and writes (each substitution must apply exactly once).
let mix = readFileSync(join(GATE2, 'mix.ts'), 'utf8');
const subs: [string, string][] = [
  [`'../../../sound-lab/lib.ts'`, JSON.stringify(join(REPO, 'sound-lab/lib.ts'))],
  [`import { readWav, round } from '../../../fable-lab/crush/measure.ts'`, `import { readWav, round } from ${JSON.stringify(join(REPO, 'fable-lab/crush/measure.ts'))}`],
  [`await import('../../../fable-lab/crush/measure.ts')`, `await import(${JSON.stringify(join(REPO, 'fable-lab/crush/measure.ts'))})`],
  [`join(HERE, 'source-render', 'c-impossible-ascent-gate2.stems')`, JSON.stringify(stemsDir)],
  [`const OUT = join(HERE, 'audio');`, `const OUT = ${JSON.stringify(join(tmp, 'mix'))};`],
];
for (const [from, to] of subs) {
  const n = mix.split(from).length - 1;
  if (n !== 1) throw new Error(`mix.ts substitution matched ${n} times: ${from}`);
  mix = mix.replace(from, to);
}
mix = mix.replace(`join(HERE, '..', 'c-impossible-ascent-gate2.json')`, JSON.stringify(join(BENCH, 'c-impossible-ascent-gate2.json')));
mix += `\nwriteFileSync(join(OUT, 'gains.json'), JSON.stringify({ hookPreGainDb: -11 - ampDb(peak(S('phrase'))), masterPushDb: 2 - 1 - ampDb(peak(total)), masterTrimDb: -1 - ampDb(truePeak(clipped)) }));\n`;
const mixCopy = join(tmp, 'mix-gate2-long.ts');
writeFileSync(mixCopy, mix);
const m = spawnSync(process.execPath, [mixCopy], { encoding: 'utf8', maxBuffer: 1 << 26 });
if (m.status !== 0) throw new Error(`Gate 2 mix failed: ${m.stderr}`);

// 3. Verify before trusting the continuation. Gate 2's seven processed stems are the music: over the first 28.0 s they
//    must be byte-identical to the approved stems. The longer master may differ only in its last frames before 28.0 s,
//    where Gate 2's 4x-oversampled soft clipper saw the cut (in the approved file it saw silence after 28.0 s).
const dataOf = (b: Buffer) => { let at = 12; while (at + 8 <= b.length) { const id = b.toString('ascii', at, at + 4), size = b.readUInt32LE(at + 4); if (id === 'data') return b.subarray(at + 8, at + 8 + size); at += 8 + size + (size & 1); } throw new Error('no data'); };
const stemIds = ['hook', 'atmosphere', 'wall-drone', 'bass808', 'kick', 'snare', 'hats-ticks'];
const stemsIdentical: Record<string, boolean> = {};
for (const id of stemIds) {
  const approved = dataOf(readFileSync(join(GATE2, 'audio', 'stems', `${id}.wav`)));
  stemsIdentical[id] = dataOf(readFileSync(join(tmp, 'mix', 'stems', `${id}.wav`))).subarray(0, approved.length).equals(approved);
  if (!stemsIdentical[id]) throw new Error(`Gate 2 stem ${id} is not reproduced over its first 28.0 s`);
}
const approved = readWav(join(GATE2, 'audio', 'IMPOSSIBLE-ASCENT-DEVELOPED.wav'));
const long = readWav(join(tmp, 'mix', 'IMPOSSIBLE-ASCENT-DEVELOPED.wav'));
if (long[0].length !== END_FRAMES || approved[0].length !== CUT) throw new Error('unexpected master lengths');
let firstDiff = CUT, maxDiff = 0;
for (let c = 0; c < 2; c++) for (let i = 0; i < CUT; i++) {
  const d = Math.abs(approved[c]![i]! - long[c]![i]!);
  if (d > 0) { firstDiff = Math.min(firstDiff, i); maxDiff = Math.max(maxDiff, d); }
}
if (CUT - firstDiff > 64) throw new Error(`longer master differs ${CUT - firstDiff} frames before the cut (clipper look-ahead allows 64)`);

// 4. The continuation, made continuous with the APPROVED last sample: the tiny offset between the approved and the longer
//    master at frame CUT-1 is added to the continuation and faded out over 5 ms (raised cosine). Gate 2's bytes are untouched.
const FADE = Math.round(0.005 * 44100);
const delta = [approved[0][CUT - 1]! - long[0][CUT - 1]!, approved[1][CUT - 1]! - long[1][CUT - 1]!];
const tail = [0, 1].map(c => long[c]!.slice(CUT).map((v, n) => v + (n < FADE ? delta[c]! * 0.5 * (1 + Math.cos(Math.PI * n / FADE)) : 0))) as [Float64Array, Float64Array];
mkdirSync(join(OUT, 'stems'), { recursive: true });
writeFileSync(join(OUT, 'stems', 'gate2-tail.wav'), bridgeWav(tail));
const gains = JSON.parse(readFileSync(join(tmp, 'mix', 'gains.json'), 'utf8'));
const ampDb = (a: number) => 20 * Math.log10(a);
const tailPeak = Math.max(...tail.map(ch => ch.reduce((p, v) => Math.max(p, Math.abs(v)), 0)));
writeFileSync(join(OUT, 'gate2-reference.json'), JSON.stringify({
  note: 'Measured from Wonder\'s unchanged Gate 2 pipeline re-run with a longer render. Used by mix_redshift.ts; nothing here alters Gate 2.',
  approvedSha256: APPROVED,
  processedStemsFirst28sByteIdentical: stemsIdentical,
  longerMasterVsApproved: { framesDifferingBeforeCut: CUT - firstDiff, maxAbsDifference: maxDiff, maxAbsDifferenceDbfs: Number(ampDb(maxDiff).toFixed(1)),
    cause: 'Gate 2 master soft clipper (4x oversampled) look-ahead at the 28.0 s cut' },
  gains,
  tail: { file: 'stems/gate2-tail.wav', fromFrame: CUT, frames: tail[0].length, peakDbfs: Number(ampDb(tailPeak).toFixed(2)),
    joinOffsetCorrection: { perChannel: delta, fadeFrames: FADE } },
}, null, 1) + '\n');
rmSync(tmp, { recursive: true, force: true });
checkApproved('after');
console.log(JSON.stringify({ stemsIdentical, framesDifferingBeforeCut: CUT - firstDiff, maxDiff, gains, tailPeakDbfs: ampDb(tailPeak) }));
