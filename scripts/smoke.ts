import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { formatDoctor, inspectEnvironment } from '../src/doctor.ts';
import { runCommand } from '../src/pipeline.ts';
import { analyzeWav } from '../src/render/index.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const { values, positionals } = parseArgs({ options: { mcp: { type: 'boolean' } }, allowPositionals: true });
  assert.equal(positionals.length, 0, 'Usage: npm run smoke [-- --mcp]');
  const report = await inspectEnvironment({ env: process.env });
  process.stdout.write(formatDoctor(report));
  assert.ok(report.readiness.sampleOnly, 'Install a supported Node version before running the sample smoke.');
  const project = join(root, 'examples/sample-only-demo.json');
  const validation = await runCommand('validate', project);
  assert.equal(validation.exitCode, 0, JSON.stringify(validation.result.errors));
  const renders = join(root, 'renders');
  mkdirSync(renders, { recursive: true });
  const outDir = mkdtempSync(join(renders, 'smoke-'));
  const render = await runCommand('render', project, { outDir, env: process.env });
  assert.equal(render.exitCode, 0, JSON.stringify(render.result.errors));
  const wav = render.result.artifacts.wav;
  assert.ok(wav, 'Render must produce a WAV.');
  const audio = analyzeWav(wav);
  assert.ok(audio.value, audio.diagnostic?.message);
  assert.equal(audio.value.sampleRate, 44100);
  assert.equal(audio.value.channels, 2);
  assert.equal(audio.value.bitsPerSample, 16);
  assert.ok(audio.value.frames > 0);
  assert.ok(audio.value.peakDbfs !== null, 'WAV must contain audible, nonzero PCM.');
  assert.equal(audio.value.clipping, false, 'The bundled sample demo must not clip.');
  const manifest = render.result.manifest!;
  assert.equal(manifest.soundfont, null, 'Sample-only rendering must not use a SoundFont.');
  assert.equal((manifest.wav as { sha256: string }).sha256, createHash('sha256').update(readFileSync(wav)).digest('hex'));
  process.stdout.write(`Sample smoke passed: ${audio.value.durationSeconds}s, 44100 Hz, 16-bit stereo, nonzero PCM, verified SHA-256\nListen: ${wav}\n`);
  if (values.mcp) {
    assert.ok(report.readiness.mcp, 'MCP runtime dependencies are missing. Run npm ci at the checkout root.');
    const { Client } = await import('@modelcontextprotocol/client');
    const { StdioClientTransport } = await import('@modelcontextprotocol/client/stdio');
    const client = new Client({ name: 'daemonv12-smoke', version: '0.4.0' });
    const transport = new StdioClientTransport({ command: process.execPath, args: [join(root, 'mcp/bin/daemonv12-mcp.js'), '--root', root] });
    try {
      await client.connect(transport, { timeout: 10000 });
      const { tools } = await client.listTools({}, { timeout: 10000 });
      assert.equal(tools.length, 9, 'MCP must expose the existing nine tools.');
      assert.ok(tools.some(tool => tool.name === 'daemonv12_render'));
      process.stdout.write('MCP smoke passed: stdio initialization and nine tools discovered.\n');
    } finally { await client.close(); }
  }
} catch (error) {
  process.stderr.write(`Smoke failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
