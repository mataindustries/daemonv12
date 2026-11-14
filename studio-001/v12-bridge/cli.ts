/** node studio-001/v12-bridge/cli.ts SCORE.json NEW_OUTPUT_DIR [--mp3] */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { bridgeWav, renderBridge, type BridgeScore } from './bridge.ts';
import { sha256 } from '../rack/frozen.ts';

export async function exportBridge(score: BridgeScore, directory: string, mp3 = false) {
  const rendered = await renderBridge(score);
  const files = new Map<string, Buffer>([['master.wav', bridgeWav(rendered.audio)]]);
  for (const [id, st] of rendered.stems) files.set(`stems/${id}.wav`, bridgeWav(st));
  const json = (v: unknown) => Buffer.from(JSON.stringify(v, null, 2) + '\n');
  files.set('score.json', json(score));
  files.set('events.json', json(rendered.manifest));
  // mkdir without recursive intentionally refuses to overwrite an existing delivery.
  const out = resolve(directory);
  mkdirSync(out); mkdirSync(join(out, 'stems'));
  for (const [name, bytes] of files) writeFileSync(join(out, name), bytes);
  try {
    if (mp3) {
      const r = spawnSync('ffmpeg', ['-v', 'error', '-nostdin', '-i', join(out, 'master.wav'), '-c:a', 'libmp3lame', '-b:a', '192k', join(out, 'master.mp3')], { encoding: 'utf8' });
      if (r.error || r.status !== 0) throw new Error(`MP3 export failed (WAVs and metadata retained): ${r.error?.message ?? r.stderr}`);
      files.set('master.mp3', readFileSync(join(out, 'master.mp3')));
    }
  } finally {
    writeFileSync(join(out, 'SHA256SUMS'), [...files].sort(([a], [b]) => a.localeCompare(b)).map(([name, bytes]) => `${sha256(bytes)}  ${name}\n`).join(''));
  }
  return rendered;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [file, out, ...flags] = process.argv.slice(2);
  if (!file || !out || flags.some(f => f !== '--mp3')) throw new Error('Usage: node studio-001/v12-bridge/cli.ts SCORE.json NEW_OUTPUT_DIR [--mp3]');
  const score = JSON.parse(readFileSync(file, 'utf8')) as BridgeScore;
  const r = await exportBridge(score, out, flags.includes('--mp3'));
  console.log(`${r.manifest.frames} frames at 44100 Hz; ${r.manifest.events.length} events; ${resolve(out)}`);
}
