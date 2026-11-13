/**
 * DaemonV12 Signature Rack command line (Node 22.18+; FFmpeg only for MP3 and loudness measurement).
 *   node studio-001/rack/cli.ts list
 *   node studio-001/rack/cli.ts render SCORE.json NEW_DIR [--transpose N] [--bpm X] [--normalize LUFS] [--no-mp3]
 *   node studio-001/rack/cli.ts bounce SCORE.json NEW_PACKAGE [--transpose N] [--bpm X]
 *   node studio-001/rack/cli.ts kit INSTRUMENT NEW_PACKAGE --pitches 36-48|36,40,43 [--macro M] [--velocity V] [--beats B] [--bpm X] [--articulation A]
 *   node studio-001/rack/cli.ts verify PACKAGE
 *   node studio-001/rack/cli.ts freeze [--write SOURCE_COMMIT]
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { computeFreeze, verifyFrozen, FREEZE_FILE, sha256 } from './frozen.ts';
import { normalizeScore, performanceJson } from './score.ts';
import { renderScore, mixdown, peak, type Stereo } from './render.ts';
import { bouncePackage, bounceKit, verifyPackage, sealPackage, wavBytes, containmentProblems, ENGINE_BASE } from './package.ts';
import { registryDocument, RACK_VERSION } from './registry.ts';
import { RACK_INTERFACE_VERSION } from './types.ts';

const ffmpeg = process.env.DAEMONV12_FFMPEG || 'ffmpeg';
export function ffmpegVersion(): string | null {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-version'], { encoding: 'utf8' });
  return r.status === 0 ? (r.stdout.split('\n')[0] ?? '').trim() : null;
}
function mp3(wav: string, out: string) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', '-y', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '192k', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg mp3: ${r.stderr}`);
}
export function loudness(wav: string): { lufs: number; lra: number; truePeakDb: number } | null {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', '-nostats', '-i', wav, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const sum = r.stderr.slice(r.stderr.lastIndexOf('Summary:')), num = (re: RegExp) => { const m = re.exec(sum); return m ? (m[1] === '-inf' ? -Infinity : Number(m[1])) : NaN; };
  return { lufs: num(/I:\s+(-?[\d.]+|-inf) LUFS/), lra: num(/LRA:\s+(-?[\d.]+) LU/), truePeakDb: num(/Peak:\s+(-?[\d.]+|-inf) dBFS/) };
}
function args(argv: string[]) {
  const pos: string[] = [], flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) { const next = argv[i + 1]; if (next !== undefined && !next.startsWith('--')) { flags[a.slice(2)] = next; i++; } else flags[a.slice(2)] = true; }
    else pos.push(a);
  }
  return { pos, flags };
}
const numFlag = (f: Record<string, string | true>, k: string) => (typeof f[k] === 'string' ? Number(f[k]) : undefined);
function pitchList(spec: string): number[] {
  return spec.split(',').flatMap(part => { const m = /^(\d+)-(\d+)$/.exec(part); if (!m) return [Number(part)]; const out: number[] = []; for (let p = +m[1]!; p <= +m[2]!; p++) out.push(p); return out; });
}

/** Direct rack render: aligned stems (gain + pan, pre-master), room, dry and context mixes, manifest, SHA256SUMS. */
export async function renderToDirectory(scoreFile: string, out: string, o: { transpose?: number; bpm?: number; normalize?: number; mp3?: boolean; log?: (s: string) => void }) {
  const authored = JSON.parse(readFileSync(scoreFile, 'utf8')) as unknown, score = normalizeScore(authored, { ...(o.transpose !== undefined ? { transpose: o.transpose } : {}), ...(o.bpm !== undefined ? { bpm: o.bpm } : {}) });
  const root = resolve(out);
  if (existsSync(root)) throw new Error(`refusing to write into an existing path: ${root}`);
  const rendered = await renderScore(score, o.log), mixes = await mixdown(rendered);
  mkdirSync(join(root, 'stems'), { recursive: true });
  let gain = 1; const files: Record<string, unknown>[] = [], ff = o.mp3 !== false ? ffmpegVersion() : null;
  if (o.normalize !== undefined) {
    if (!ffmpegVersion()) throw new Error('--normalize needs FFmpeg');
    const probe = join(root, 'probe.wav'); writeFileSync(probe, wavBytes(mixes.context, 0.5 / Math.max(1e-9, peak(mixes.context))).bytes);
    const l = loudness(probe)!; spawnSync('rm', [probe]);
    gain = Math.min(Math.pow(10, (o.normalize - l.lufs) / 20) * 0.5 / Math.max(1e-9, peak(mixes.context)), Math.pow(10, (-1 - l.truePeakDb) / 20) * 0.5 / Math.max(1e-9, peak(mixes.context)));
  }
  const put = (name: string, audio: Stereo, g: number, role: string, withMp3: boolean) => {
    const { bytes, clipped } = wavBytes(audio, g), file = join(root, name); writeFileSync(file, bytes);
    if (withMp3 && ff) mp3(file, file.replace(/\.wav$/, '.mp3'));
    files.push({ file: name, role, peak: +(peak(audio) * g).toFixed(5), clipped, ...(ff ? { loudness: loudness(file) } : {}) });
  };
  for (const [id, st] of mixes.stems) put(`stems/${id}.wav`, st, gain, 'stem: part after gain and pan, before the master', false);
  put('stems/room.wav', mixes.room, gain, 'stem: wet-only room', false);
  put('mix-dry.wav', mixes.dry, gain, 'instrument parts, no context parts, no room, master gain applied', true);
  put('mix-context.wav', mixes.context, gain, 'all parts, context parts and room, master gain applied', true);
  writeFileSync(join(root, 'score.json'), JSON.stringify(authored, null, 2) + '\n');
  writeFileSync(join(root, 'performance.json'), JSON.stringify(performanceJson(score), null, 2) + '\n');
  writeFileSync(join(root, 'render.json'), JSON.stringify({ schema: 'daemonv12.signature-rack.render/1', interfaceVersion: RACK_INTERFACE_VERSION, rackVersion: RACK_VERSION,
    title: score.title, bpm: score.bpm, key: score.key.label, transpose: score.transpose, frames: rendered.frames, seconds: +(rendered.frames / 44100).toFixed(6),
    normalizeGainDb: +(20 * Math.log10(gain)).toFixed(3), node: process.version, ffmpeg: ff, scoreSha256: sha256(Buffer.from(JSON.stringify(authored, null, 2) + '\n')), files }, null, 2) + '\n');
  sealPackage(root);
  return { root, frames: rendered.frames, files };
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2), { pos, flags } = args(rest), log = (s: string) => console.error(s);
  switch (cmd) {
    case 'list': console.log(JSON.stringify(registryDocument(), null, 2)); return;
    case 'render': {
      if (pos.length !== 2) throw new Error('usage: render SCORE.json NEW_DIR [--transpose N] [--bpm X] [--normalize LUFS] [--no-mp3]');
      const r = await renderToDirectory(pos[0]!, pos[1]!, { transpose: numFlag(flags, 'transpose'), bpm: numFlag(flags, 'bpm'), normalize: numFlag(flags, 'normalize'), mp3: !flags['no-mp3'], log });
      console.log(JSON.stringify({ root: r.root, seconds: r.frames / 44100, files: r.files }, null, 2)); return;
    }
    case 'bounce': {
      if (pos.length !== 2) throw new Error('usage: bounce SCORE.json NEW_PACKAGE [--transpose N] [--bpm X]');
      const score = normalizeScore(JSON.parse(readFileSync(pos[0]!, 'utf8')), { ...(numFlag(flags, 'transpose') !== undefined ? { transpose: numFlag(flags, 'transpose')! } : {}), ...(numFlag(flags, 'bpm') !== undefined ? { bpm: numFlag(flags, 'bpm')! } : {}) });
      const rendered = await renderScore(score, log), report = bouncePackage(score, rendered, await mixdown(rendered), pos[1]!);
      const bad = [...containmentProblems(report.root, 'main.json'), ...containmentProblems(report.root, 'dry.json')];
      if (bad.length) throw new Error(`containment: ${bad.join('; ')}`);
      console.log(JSON.stringify({ ...report, files: verifyPackage(report.root), engineBase: ENGINE_BASE }, null, 2)); return;
    }
    case 'kit': {
      if (pos.length !== 2 || typeof flags.pitches !== 'string') throw new Error('usage: kit INSTRUMENT NEW_PACKAGE --pitches 36-48 [--macro M] [--velocity V] [--beats B] [--bpm X] [--articulation A]');
      const r = await bounceKit(pos[0]!, pos[1]!, { pitches: pitchList(flags.pitches), ...(numFlag(flags, 'macro') !== undefined ? { macro: numFlag(flags, 'macro')! } : {}), ...(numFlag(flags, 'velocity') !== undefined ? { velocity: numFlag(flags, 'velocity')! } : {}),
        ...(numFlag(flags, 'beats') !== undefined ? { beats: numFlag(flags, 'beats')! } : {}), ...(numFlag(flags, 'bpm') !== undefined ? { bpm: numFlag(flags, 'bpm')! } : {}), ...(typeof flags.articulation === 'string' ? { articulation: flags.articulation } : {}) });
      console.log(JSON.stringify(r, null, 2)); return;
    }
    case 'verify': { if (pos.length !== 1) throw new Error('usage: verify PACKAGE'); console.log(`${verifyPackage(pos[0]!)} files verified`); return; }
    case 'freeze': {
      if (typeof flags.write === 'string') { writeFileSync(FREEZE_FILE, JSON.stringify(computeFreeze(flags.write), null, 2) + '\n'); console.log(`wrote ${FREEZE_FILE}`); return; }
      const bad = verifyFrozen(); console.log(bad.length ? bad.join('\n') : 'all frozen engines, scripts, auditions and manifests match frozen.json'); process.exitCode = bad.length ? 1 : 0; return;
    }
    default: console.error(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 8).join('\n')); process.exitCode = 2;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) main().catch(e => { console.error((e as Error).message); process.exitCode = 1; });
