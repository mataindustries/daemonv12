// External mastering, deliberately minimal: DaemonV12 has no limiter, so the engine's master
// (mix, track effects, glue compressor) is taken as-is and only (1) gained to a common
// integrated loudness and (2) held under a true-peak ceiling by the MORPH lookahead limiter
// (lib/dsp.mjs). The gain is iterated until the integrated loudness agrees with the target to
// within 0.05 LU on the loudnorm meter that DaemonV12's `analyze` uses; ebur128 is also reported.
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { readWav } from './wav.mjs';
import { master as limitTo, rng } from '../lib/dsp.mjs';

/** FFmpeg ebur128 summary: integrated loudness, loudness range, true peak. */
export function loudness(path, filter = '') {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', path, '-af', `${filter}ebur128=peak=true`, '-f', 'null', '-'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg ebur128 failed: ${r.stderr.slice(-500)}`);
  return parseEbur(r.stderr);
}
/** The meter DaemonV12's `analyze` uses (src/render/ffmpeg.ts): loudnorm's input measurements. */
export function engineLoudness(path) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', path, '-map', '0:a:0', '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg loudnorm failed: ${r.stderr.slice(-500)}`);
  const j = JSON.parse(r.stderr.slice(r.stderr.lastIndexOf('{')));
  return { integratedLufs: +j.input_i, truePeakDbtp: +j.input_tp, lraLu: +j.input_lra };
}
function parseEbur(text) {
  const s = text.slice(text.lastIndexOf('Summary:'));
  const num = re => { const m = s.match(re); return m ? +m[1] : null; };
  return { integratedLufs: num(/I:\s+(-?[\d.]+) LUFS/), lraLu: num(/LRA:\s+(-?[\d.]+) LU/), truePeakDbtp: num(/Peak:\s+(-?[\d.]+) dBFS/) };
}

/** Silence windows [{ from, to, fade }] (seconds): raised-cosine fade from `from`, exact zeros from `from + fade` until `to`. */
function silence(bus, windows) {
  for (const { from, to, fade = 0.004 } of windows) {
    const a = Math.round(from * 44100), f = Math.round(fade * 44100), b = Math.round(to * 44100);
    for (let i = a; i < b; i++) { const g = i < a + f ? 0.5 + 0.5 * Math.cos(Math.PI * (i - a) / f) : 0; bus.L[i] *= g; bus.R[i] *= g; }
  }
}

export function masterFile(inPath, outPath, { targetLufs = -14, ceilingDb = -1.2, silenceWindows = [] } = {}) {
  const src = readWav(inPath);
  if (src.channels.length !== 2 || src.rate !== 44100) throw new Error('expected 44.1 kHz stereo');
  let aim = targetLufs, report, measured;
  for (let pass = 0; pass < 4; pass++) {
    const bus = { L: src.channels[0].slice(), R: src.channels[1].slice() };
    report = limitTo(bus, { targetLufs: aim, ceilingDb, release: 0.06 });
    silence(bus, silenceWindows); // after the master chain, so no filter or limiter tail can enter the breath
    writeFileSync(outPath, pcm16(bus));
    measured = engineLoudness(outPath);
    if (Math.abs(measured.integratedLufs - targetLufs) <= 0.05) break;
    aim += targetLufs - measured.integratedLufs;
  }
  measured.ebur128 = loudness(outPath);
  return { targetLufs, ceilingDb, frames: src.frames, gainAimLufs: +aim.toFixed(3), engineMasterLufs: +report.preMasterLufs.toFixed(2),
    limiterMaxDb: +report.limiterMaxDb.toFixed(2), truePeakTrimDb: +report.truePeakTrimDb.toFixed(2), limiterOver2dBAt: report.limiterOver2dBAt, silenceWindows, measured };
}

/**
 * Canonical PCM16 with seeded TPDF dither (deterministic). Exact digital silence in the input
 * (the A breath, padded frames) stays exact zero: dither is applied only to nonzero samples.
 */
export function pcm16(bus, seed = 1) {
  const n = bus.L.length, b = Buffer.alloc(44 + n * 4), r = rng(seed);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(44100, 24); b.writeUInt32LE(44100 * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (const ch of [bus.L, bus.R]) {
    const v = ch[i], d = r() - r();
    if (!Number.isFinite(v) || Math.abs(v) > 1) throw new RangeError(`master sample ${i} out of range: ${v}`);
    b.writeInt16LE(v === 0 ? 0 : Math.max(-32768, Math.min(32767, Math.round(v * 32767 + d))), o); o += 2;
  }
  return b;
}

export function mp3(wavPath, mp3Path) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wavPath, '-c:a', 'libmp3lame', '-b:a', '320k', '-ar', '44100', mp3Path]);
}
