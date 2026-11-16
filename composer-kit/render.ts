/**
 * Render a kit score with the unchanged Signature Rack and keep only what a listener needs: one MP3 (and the WAV if asked).
 * The rack is loaded lazily, after the Timbre Lab registration, so scores may use the lab instruments.
 */
import '../timbre-lab/register.ts';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const rack = () => import('../studio-001/rack/cli.ts');
const FFMPEG = process.env.DAEMONV12_FFMPEG || 'ffmpeg';
function ff(args: string[]) { const r = spawnSync(FFMPEG, ['-hide_banner', '-nostdin', '-v', 'error', '-y', ...args], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`); }
const toMp3 = (wav: string, mp3: string, kbps: number, filter?: string) => ff(['-i', wav, ...(filter ? ['-af', filter] : []), '-codec:a', 'libmp3lame', '-b:a', `${kbps}k`, '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', mp3]);

export interface RenderInfo { seconds: number; rawLufs: number; lufs: number; truePeakDb: number; mp3: string }
export async function renderMp3(score: unknown, mp3: string, o: { lufs?: number; kbps?: number; wav?: string } = {}): Promise<RenderInfo> {
  const { renderToDirectory, loudness } = await rack();
  const work = mkdtempSync(join(tmpdir(), 'kit-')), file = join(work, 'score.json'), out = join(work, 'out');
  try {
    writeFileSync(file, JSON.stringify(score));
    const r = await renderToDirectory(file, out, { normalize: o.lufs ?? -16, mp3: false });
    const meta = JSON.parse(readFileSync(join(out, 'render.json'), 'utf8')) as { normalizeGainDb: number };
    const l = loudness(join(out, 'mix-context.wav'));
    mkdirSync(dirname(mp3), { recursive: true });
    toMp3(join(out, 'mix-context.wav'), mp3, o.kbps ?? 112);
    if (o.wav) copyFileSync(join(out, 'mix-context.wav'), o.wav);
    const lufs = l?.lufs ?? NaN;
    return { seconds: +(r.frames / 44100).toFixed(2), rawLufs: +(lufs - meta.normalizeGainDb).toFixed(1), lufs, truePeakDb: l?.truePeakDb ?? NaN, mp3 };
  } finally { rmSync(work, { recursive: true, force: true }); }
}

/**
 * A two-sided track: each side is its own score (its own tempo and groove). The sides are rendered separately, brought
 * back to one common gain so the quiet side stays quiet, and joined exactly on the bar line: side B's first downbeat
 * lands where side A's last bar ends, and side A's tail rings over it. The whole track is then set to the target loudness.
 */
export async function renderSidesMp3(scores: unknown[], mp3: string, o: { lufs?: number; kbps?: number } = {}): Promise<RenderInfo & { switchSeconds: number[] }> {
  const { renderToDirectory, loudness } = await rack();
  const work = mkdtempSync(join(tmpdir(), 'kit-')), target = o.lufs ?? -16;
  try {
    const sides: { wav: string; gainDb: number; seconds: number }[] = [];
    for (const [i, score] of scores.entries()) {
      const s = score as { bpm: number; sections: { bars: number }[] }, file = join(work, `score-${i}.json`), out = join(work, `out-${i}`);
      writeFileSync(file, JSON.stringify(score));
      await renderToDirectory(file, out, { normalize: target, mp3: false });
      const meta = JSON.parse(readFileSync(join(out, 'render.json'), 'utf8')) as { normalizeGainDb: number };
      sides.push({ wav: join(out, 'mix-context.wav'), gainDb: meta.normalizeGainDb, seconds: s.sections.reduce((a, x) => a + x.bars * 4, 0) * 60 / s.bpm });
    }
    const common = Math.min(...sides.map(s => s.gainDb)), starts: number[] = []; let at = 0;
    for (const s of sides) { starts.push(at); at += s.seconds; }
    const graph = sides.map((s, i) => `[${i}:a]volume=${(common - s.gainDb).toFixed(3)}dB,adelay=${Math.round(starts[i]! * 44100)}S:all=1[s${i}]`).join(';')
      + `;${sides.map((_, i) => `[s${i}]`).join('')}amix=inputs=${sides.length}:normalize=0:duration=longest[m]`;
    const joined = join(work, 'joined.wav');
    ff([...sides.flatMap(s => ['-i', s.wav]), '-filter_complex', graph, '-map', '[m]', '-c:a', 'pcm_f32le', joined]);
    const raw = loudness(joined)!, gain = Math.min(target - raw.lufs, -1 - raw.truePeakDb), final = join(work, 'final.wav');
    ff(['-i', joined, '-af', `volume=${gain.toFixed(3)}dB`, '-c:a', 'pcm_s24le', final]);
    const l = loudness(final)!;
    mkdirSync(dirname(mp3), { recursive: true });
    toMp3(final, mp3, o.kbps ?? 112);
    return { seconds: +(l ? at + 0 : at).toFixed(2), rawLufs: +(raw.lufs - common).toFixed(1), lufs: l.lufs, truePeakDb: l.truePeakDb, mp3, switchSeconds: starts.slice(1).map(x => +x.toFixed(3)) };
  } finally { rmSync(work, { recursive: true, force: true }); }
}
