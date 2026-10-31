// Master a DaemonV12 pre-master with the vendored MORPH chain: +2.5 dB air shelf, lows mono below
// 120 Hz, a 4x-oversampled soft clip on the top few dB (the kick+808 downbeats), then the
// look-ahead true-peak limiter. Loudness is a consequence, not the target: the loudest level whose
// clip and limiter both stay inside their limits is chosen, so transients survive.
//   node master.mjs <name>   reads renders/<name>/<name>.wav, writes masters/<name>.wav (24-bit),
//                            masters/<name>.mp3 (320 kbps) and masters/<name>.master.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readWav } from './sounds.mjs';
import { Biquad, monoBass, encodeWav, lufs, limit, truePeak, shape, scale, dbToGain } from '../../../../experiments/lowrider-2099/vendor/morph-03/dsp.mjs';

const CEILING_DB = -1.0, CLIP_DB = 3.0;                       // soft clip acts on the top CLIP_DB below the ceiling
// chosen from the measured trade-off: at -11 LUFS the clip shaves <= ~4.3 dB from <= ~1.7 % of samples,
// nearly all crests of the already-saturated 808; -10 needed 5+ dB on 3 %, which risks audible distortion
const LIMITS = { limiterMaxDb: 2.0, clipMaxDb: 4.5, clipActivePercent: 2.0 };
const TARGETS = [-8, -8.5, -9, -9.5, -10, -10.5, -11, -11.5, -12];
const name = process.argv[2];
if (!name) throw new Error('usage: node master.mjs <crest|hover>');
const HERE = new URL('./', import.meta.url).pathname;
const src = readWav(readFileSync(`${HERE}renders/${name}/${name}.wav`));

function chain(target) {
  const bus = { L: Float64Array.from(src.L), R: Float64Array.from(src.R) };
  for (const ch of [bus.L, bus.R]) new Biquad('hs', 10000, 0.7, 2.5).run(ch);
  monoBass(bus, 120);
  const preMasterLufs = lufs(bus);
  scale(bus.L, dbToGain(target - preMasterLufs)); scale(bus.R, dbToGain(target - preMasterLufs));
  // soft clip: linear below t, tanh knee above it (the MORPH//06 master's knee), 4x oversampled
  const t = dbToGain(CEILING_DB - CLIP_DB), c = dbToGain(CEILING_DB + 0.3) - t;
  const knee = v => { const a = Math.abs(v); return a <= t ? v : Math.sign(v) * (t + c * Math.tanh((a - t) / c)); };
  let over = 0, clipMaxDb = 0;
  for (const ch of [bus.L, bus.R]) for (const v of ch) { const a = Math.abs(v); if (a > t) { over++; clipMaxDb = Math.max(clipMaxDb, 20 * Math.log10(a / Math.abs(knee(v)))); } }
  bus.L = shape(bus.L, knee, 1); bus.R = shape(bus.R, knee, 1);
  const limiterMaxDb = limit(bus, { ceilingDb: CEILING_DB - 0.3, lookahead: 0.003, release: 0.06 });
  const tp = truePeak(bus), truePeakTrimDb = Math.min(0, CEILING_DB - 20 * Math.log10(tp));
  scale(bus.L, dbToGain(truePeakTrimDb)); scale(bus.R, dbToGain(truePeakTrimDb));
  return { bus, stats: { preMasterLufs, clipActivePercent: 100 * over / (2 * bus.L.length), clipMaxDb, limiterMaxDb, truePeakTrimDb } };
}
let chosen;
for (const target of TARGETS) {
  chosen = { target, ...chain(target) };
  const s = chosen.stats;
  if (s.limiterMaxDb <= LIMITS.limiterMaxDb && s.clipMaxDb <= LIMITS.clipMaxDb && s.clipActivePercent <= LIMITS.clipActivePercent) break;
}
mkdirSync(`${HERE}masters`, { recursive: true });
const wavPath = `${HERE}masters/${name}.wav`, mp3Path = `${HERE}masters/${name}.mp3`;
writeFileSync(wavPath, encodeWav(chosen.bus, 24, 7));
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-b:a', '320k', mp3Path]);
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const report = {
  source: `renders/${name}/${name}.wav`, sourceSha256: sha(`${HERE}renders/${name}/${name}.wav`),
  chain: ['high shelf +2.5 dB @ 10 kHz', 'mono below 120 Hz', `4x-oversampled soft clip on the top ${CLIP_DB} dB`, `MORPH look-ahead limiter, true-peak ceiling ${CEILING_DB} dBTP`],
  rule: `loudest of ${TARGETS.join(', ')} LUFS (gain-staging estimate) within ${JSON.stringify(LIMITS)}`,
  targetLufs: chosen.target, preMasterLufsEstimate: +chosen.stats.preMasterLufs.toFixed(2),
  clipActivePercent: +chosen.stats.clipActivePercent.toFixed(3), clipMaxDb: +chosen.stats.clipMaxDb.toFixed(2), limiterMaxDb: +chosen.stats.limiterMaxDb.toFixed(2),
  truePeakTrimDb: +chosen.stats.truePeakTrimDb.toFixed(2), outputLufsEstimate: +lufs(chosen.bus).toFixed(2),
  wav: { path: `masters/${name}.wav`, format: '44.1 kHz / 24-bit stereo, TPDF dither', sha256: sha(wavPath) },
  mp3: { path: `masters/${name}.mp3`, format: '320 kbps libmp3lame' },
};
writeFileSync(`${HERE}masters/${name}.master.json`, JSON.stringify(report, null, 2) + '\n');
console.log(name, `target ${chosen.target} LUFS, clip ${report.clipMaxDb} dB on ${report.clipActivePercent}% of samples, limiter max ${report.limiterMaxDb} dB, TP trim ${report.truePeakTrimDb} dB`);
