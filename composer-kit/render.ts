/** Render a kit score with the unchanged Signature Rack and keep only what a listener needs: one MP3 (and the WAV if asked). */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { renderToDirectory, loudness } from '../studio-001/rack/cli.ts';

export interface RenderInfo { seconds: number; rawLufs: number; lufs: number; truePeakDb: number; mp3: string }
export async function renderMp3(score: unknown, mp3: string, o: { lufs?: number; kbps?: number; wav?: string } = {}): Promise<RenderInfo> {
  const work = mkdtempSync(join(tmpdir(), 'kit-')), file = join(work, 'score.json'), out = join(work, 'out');
  try {
    writeFileSync(file, JSON.stringify(score));
    const r = await renderToDirectory(file, out, { normalize: o.lufs ?? -16, mp3: false });
    const meta = JSON.parse(readFileSync(join(out, 'render.json'), 'utf8')) as { normalizeGainDb: number };
    const l = loudness(join(out, 'mix-context.wav'));
    mkdirSync(dirname(mp3), { recursive: true });
    const ff = spawnSync(process.env.DAEMONV12_FFMPEG || 'ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-y', '-i', join(out, 'mix-context.wav'), '-codec:a', 'libmp3lame', '-b:a', `${o.kbps ?? 112}k`, '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', mp3], { encoding: 'utf8' });
    if (ff.status !== 0) throw new Error(`ffmpeg: ${ff.stderr}`);
    if (o.wav) copyFileSync(join(out, 'mix-context.wav'), o.wav);
    const lufs = l?.lufs ?? NaN;
    return { seconds: +(r.frames / 44100).toFixed(2), rawLufs: +(lufs - meta.normalizeGainDb).toFixed(1), lufs, truePeakDb: l?.truePeakDb ?? NaN, mp3 };
  } finally { rmSync(work, { recursive: true, force: true }); }
}
