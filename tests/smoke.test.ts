import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { readWavInfo } from '../src/render/wav.ts';

test('fresh-clone smoke proves audible WAV and actual MCP discovery without system audio tools, from any cwd', t => {
  const result = spawnSync(process.execPath, [resolve('scripts/smoke.ts'), '--mcp'], { encoding: 'utf8', cwd: tmpdir(), timeout: 30000,
    env: { ...process.env, DAEMONV12_FLUIDSYNTH: '/missing/fluidsynth', DAEMONV12_SOUNDFONT: '/missing.sf2', DAEMONV12_FFMPEG: '/missing/ffmpeg' } });
  const wav = /Listen: (.+)\n/.exec(result.stdout)?.[1];
  if (wav) t.after(() => rmSync(resolve(wav, '..'), { recursive: true, force: true }));
  assert.equal(result.status, 0, result.stdout + result.stderr); assert.match(result.stdout, /generalMidi: not ready/);
  assert.match(result.stdout, /Sample smoke passed/); assert.match(result.stdout, /MCP smoke passed.*nine tools discovered/);
  assert.ok(wav); const parsed = readWavInfo(wav); assert.ok(parsed.ok); assert.ok(parsed.info.frames > 0);
});
