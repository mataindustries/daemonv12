/**
 * Drum-and-bass A/B, V1 then V2, bars 5-10 (six bars, the groove A / A' / B run).
 *   V1: its delivered stems kick + snare + hats + bass808 (lossless FLAC from experiments/concrete-gospel-001/delivery)
 *   V2: build/ab/render/drum-bass-v2.wav (the same four tracks, `node build.ts ab`)
 * Both are pre-master buses, loudness-matched to the same integrated LUFS (so the louder one does not win by level),
 * joined with one second of silence, 5 ms edge fades. Writes ab/concrete-gospel-v1-vs-v2-drums-bass.{wav,mp3} + ab.json.
 *
 *   node experiments/concrete-gospel-002/build.ts ab && node experiments/concrete-gospel-002/ab.ts
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'ab'), TMP = join(HERE, 'build', 'ab-tmp');
const ffmpeg = process.env.DAEMONV12_FFMPEG || 'ffmpeg', SR = 44100;
const FROM = 294000, TO = 735000; // engine frames of beat 16 (bar 5) and beat 40 (bar 11) at 144 BPM
const TARGET_LUFS = -14, MAX_TP = -1;
const ff = (args: string[]) => { const r = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', ...args], { maxBuffer: 512 << 20 }); if (r.status !== 0) throw new Error(String(r.stderr)); return r; };
const pcm = (file: string) => { const b = ff(['-v', 'error', '-i', file, '-f', 's16le', '-acodec', 'pcm_s16le', '-ac', '2', '-ar', String(SR), '-']).stdout as Buffer; return new Int16Array(b.buffer, b.byteOffset, b.length / 2); };
function wav(samples: Float64Array, file: string) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i]! * 32768))), 44 + 2 * i);
  writeFileSync(file, b);
}
function loud(file: string) {
  const e = String(ff(['-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr), s = e.slice(e.lastIndexOf('Summary:'));
  return { lufs: Number(/I:\s+(-?[\d.]+) LUFS/.exec(s)![1]), tp: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(s)![1]) };
}
/** Sum stereo int16 sources over [FROM, TO) into float. */
function excerpt(sources: Int16Array[]) {
  const n = (TO - FROM) * 2, out = new Float64Array(n);
  for (const s of sources) for (let i = 0; i < n; i++) out[i] = out[i]! + (s[FROM * 2 + i] ?? 0) / 32768;
  const f = Math.round(0.005 * SR);
  for (let k = 0; k < f; k++) { const g = k / f; for (const c of [0, 1]) { out[2 * k + c] = out[2 * k + c]! * g; out[n - 2 - 2 * k + c] = out[n - 2 - 2 * k + c]! * g; } }
  return out;
}

rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true }); mkdirSync(OUT, { recursive: true });
const V1 = join(HERE, '..', 'concrete-gospel-001', 'delivery', 'stems');
const a = excerpt(['kick', 'snare', 'hats', 'bass808'].map(s => pcm(join(V1, `${s}.flac`))));
const b = excerpt([pcm(join(HERE, 'build', 'ab', 'render', 'drum-bass-v2.wav'))]);
wav(a, join(TMP, 'a.wav')); wav(b, join(TMP, 'b.wav'));
const la = loud(join(TMP, 'a.wav')), lb = loud(join(TMP, 'b.wav'));
// one gain per side to the target loudness, then a common reduction if either would pass the true-peak ceiling
let ga = TARGET_LUFS - la.lufs, gb = TARGET_LUFS - lb.lufs;
const over = Math.max(la.tp + ga, lb.tp + gb) - MAX_TP;
if (over > 0) { ga -= over; gb -= over; }
const gap = new Float64Array(SR * 2), joined = new Float64Array(a.length + gap.length + b.length);
joined.set(a.map(v => v * 10 ** (ga / 20)), 0); joined.set(b.map(v => v * 10 ** (gb / 20)), a.length + gap.length);
const name = join(OUT, 'concrete-gospel-v1-vs-v2-drums-bass');
wav(joined, `${name}.wav`);
ff(['-v', 'error', '-y', '-i', `${name}.wav`, '-codec:a', 'libmp3lame', '-b:a', '192k', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', `${name}.mp3`]);
const report = {
  bars: '5-10 (beats 16-40), V1 first, 1 s silence, then V2', frames: [FROM, TO],
  v1: { source: 'concrete-gospel-001/delivery/stems kick+snare+hats+bass808', lufsBeforeMatch: la.lufs, truePeakBeforeMatch: la.tp, gainDb: +ga.toFixed(2) },
  v2: { source: 'build/ab/render/drum-bass-v2.wav (kick+snare+hats+bass808)', lufsBeforeMatch: lb.lufs, truePeakBeforeMatch: lb.tp, gainDb: +gb.toFixed(2) },
  matchedTo: `${TARGET_LUFS - Math.max(0, over)} LUFS integrated each`, joined: loud(`${name}.wav`),
  sha256: { wav: spawnSync('sha256sum', [`${name}.wav`]).stdout.toString().split(' ')[0], mp3: spawnSync('sha256sum', [`${name}.mp3`]).stdout.toString().split(' ')[0] },
};
writeFileSync(join(OUT, 'ab.json'), JSON.stringify(report, null, 1) + '\n');
rmSync(TMP, { recursive: true, force: true });
console.log(JSON.stringify(report, null, 1));
