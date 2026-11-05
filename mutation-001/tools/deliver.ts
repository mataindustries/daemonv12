/**
 * Loudness-matched audition delivery for MUTATION 001. Every audition is written as PCM16 WAV normalised by a
 * single gain to TARGET_LUFS integrated (EBU R128, measured by FFmpeg's ebur128 filter, the measurement tool the
 * DaemonV12 engine already depends on), never above CEILING_DBTP true peak; no compression or limiting. A 192 kbps
 * MP3 listening copy is encoded beside it. Also: a manifest writer and plain per-segment spectral measurements.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodeWav, peakOf, SR, type Wave } from './dsp.ts';

export const TARGET_LUFS = -19, CEILING_DBTP = -1;
export const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
function run(cmd: string, args: string[]): string {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}\n${r.stderr}`);
  return r.stderr;
}
/** FFmpeg EBU R128 summary: integrated loudness, loudness range, true peak. */
export function r128(file: string): { lufs: number; lra: number; truePeakDb: number } {
  const s = run('ffmpeg', ['-hide_banner', '-nostdin', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const sum = s.slice(s.lastIndexOf('Summary:'));
  const num = (re: RegExp) => { const m = re.exec(sum); if (!m) throw new Error(`ebur128 parse: ${sum}`); return m[1] === '-inf' ? -Infinity : Number(m[1]); };
  return { lufs: num(/I:\s+(-?[\d.]+|-inf) LUFS/), lra: num(/LRA:\s+(-?[\d.]+) LU/), truePeakDb: num(/Peak:\s+(-?[\d.]+|-inf) dBFS/) };
}

export interface Delivered {
  file: string; mp3: string; role: string; seconds: number; channels: number;
  lufs: number; lra: number; truePeakDb: number; wavSha256: string; mp3Sha256: string; note?: string;
}
export function deliver(dir: string, name: string, chs: Wave[], role: string, tmpDir: string): Delivered {
  mkdirSync(dir, { recursive: true }); mkdirSync(tmpDir, { recursive: true });
  const g0 = 0.5 / Math.max(1e-9, peakOf(chs)), probe = join(tmpDir, `${name}.probe.wav`);
  writeFileSync(probe, encodeWav(chs, g0));
  const pr = r128(probe); unlinkSync(probe);
  let gainDb = TARGET_LUFS - pr.lufs, note: string | undefined;
  if (pr.truePeakDb + gainDb > CEILING_DBTP) {
    note = `true-peak ceiling binds: ${(gainDb - (CEILING_DBTP - pr.truePeakDb)).toFixed(2)} dB below the loudness target`;
    gainDb = CEILING_DBTP - pr.truePeakDb;
  }
  const wav = encodeWav(chs, g0 * Math.pow(10, gainDb / 20)), wavPath = join(dir, `${name}.wav`), mp3Path = join(dir, `${name}.mp3`);
  writeFileSync(wavPath, wav);
  run('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-b:a', '192k',
    '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', mp3Path]);
  const fin = r128(wavPath);
  return { file: `${name}.wav`, mp3: `${name}.mp3`, role, seconds: +(chs[0]!.length / SR).toFixed(3), channels: chs.length,
    ...fin, wavSha256: sha256(wav), mp3Sha256: sha256(readFileSync(mp3Path)), ...(note ? { note } : {}) };
}

/** Merge one mutation's entries into auditions/manifest.json and rewrite auditions/SHA256SUMS. */
export function writeManifest(root: string, key: string, entry: Record<string, unknown>, files: Delivered[], sub: string): void {
  const mf = join(root, 'manifest.json');
  const all = existsSync(mf) ? JSON.parse(readFileSync(mf, 'utf8')) : {
    schema: 'mutation-001.auditions/1',
    loudness: { targetLufs: TARGET_LUFS, ceilingDbtp: CEILING_DBTP, method: 'single gain per file, FFmpeg ebur128 (EBU R128); no compression or limiting' },
    provenance: 'Every sound is synthesized by mutation-001/tools from numeric parameters and seeded PRNGs. No recordings, samples, SoundFonts, impulse responses, presets or third-party audio.',
    license: 'PENDING OWNER DECLARATION: no license is granted by this file.',
    mutations: {},
  };
  all.mutations[key] = { ...entry, files: files.map(f => ({ ...f, file: `${sub}/${f.file}`, mp3: `${sub}/${f.mp3}` })) };
  writeFileSync(mf, JSON.stringify(all, null, 2) + '\n');
  const lines: string[] = [];
  for (const k of Object.keys(all.mutations).sort()) for (const f of all.mutations[k].files) lines.push(`${f.wavSha256}  ${f.file}`, `${f.mp3Sha256}  ${f.mp3}`);
  writeFileSync(join(root, 'SHA256SUMS'), lines.join('\n') + '\n');
}

// ---------------------------------------------------------------- plain measurements (no quality scores)
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j]!, re[i]!]; [im[i], im[j]] = [im[j]!, im[i]!]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j]!, ui = im[i + j]!, xr = re[i + j + len / 2]!, xi = im[i + j + len / 2]!;
        const vr = xr * cr - xi * ci, vi = xr * ci + xi * cr;
        re[i + j] = ur + vr; im[i + j] = ui + vi; re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
/** Per-segment RMS (dB re full-scale peak of the whole file), spectral centroid and share of energy above `splitHz`. */
export function segmentStats(x: Wave, segs: [string, number, number][], splitHz = 250): Record<string, number | string>[] {
  const n = 4096, win = new Float64Array(n).map((_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n)), pk = Math.max(1e-12, peakOf([x]));
  return segs.map(([label, t0, t1]) => {
    const a = Math.round(t0 * SR), b = Math.min(x.length, Math.round(t1 * SR));
    let ss = 0; for (let i = a; i < b; i++) ss += x[i]! * x[i]!;
    let num = 0, den = 0, hi = 0;
    for (let s = a; s + n <= b; s += n / 2) {
      const re = new Float64Array(n), im = new Float64Array(n);
      for (let i = 0; i < n; i++) re[i] = x[s + i]! * win[i]!;
      fft(re, im);
      for (let k = 1; k < n / 2; k++) { const f = k * SR / n, e = re[k]! * re[k]! + im[k]! * im[k]!; num += f * e; den += e; if (f >= splitHz) hi += e; }
    }
    return { segment: label, from: +t0.toFixed(2), to: +t1.toFixed(2), rmsDb: +(10 * Math.log10(ss / Math.max(1, b - a) / (pk * pk) + 1e-20)).toFixed(1),
      centroidHz: Math.round(num / Math.max(1e-20, den)), [`above${splitHz}HzPct`]: +(100 * hi / Math.max(1e-20, den)).toFixed(1) };
  });
}
