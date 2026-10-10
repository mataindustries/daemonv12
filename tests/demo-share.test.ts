import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

test('share demo falls back to the Node-only render and says what was skipped and how to listen', () => {
  const result = spawnSync(process.execPath, [resolve('scripts/demo-share.ts')], { encoding: 'utf8', cwd: tmpdir(), timeout: 60000,
    env: { ...process.env, DAEMONV12_FLUIDSYNTH: '/missing/fluidsynth', DAEMONV12_SOUNDFONT: '/missing.sf2', DAEMONV12_FFMPEG: '/missing/ffmpeg' } });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /FFmpeg is not available, so the Orbital Foundry audition and the agent-composed score were skipped/);
  assert.match(result.stdout, /Duration {4}20\.000 s \(882,000 frames/);
  assert.match(result.stdout, /SHA-256 {5}[0-9a-f]{64}/);
  const wav = /WAV {9}(.+\.wav)\n/.exec(result.stdout)?.[1];
  assert.ok(wav && existsSync(wav) && wav.startsWith(resolve('renders', 'share')), result.stdout);
  assert.match(result.stdout, /Listen:\n {2}\S+.*sample-only-demo\.wav/);
});
