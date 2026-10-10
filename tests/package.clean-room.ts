// Release gate (npm run test:package): pack this checkout exactly as `npm publish`
// would, install only the tarball into an empty directory outside the repository,
// and use it the way a stranger would. Every installed Node process records the
// modules it loads; the test fails if any of them comes from the source checkout.
// Node-only checks always run with the audio tools hidden. Full-audio checks also
// run when this machine has FluidSynth, a SoundFont and FFmpeg.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { STARTER_PROJECTS } from '../src/cli/init.ts';
import { inspectEnvironment } from '../src/doctor.ts';
import { runCommand } from '../src/pipeline.ts';
import { decodePcm } from '../src/render/index.ts';
import { ENGINE_VERSION } from '../src/version.ts';

const repo = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const TOOLS = ['daemonv12_analyze', 'daemonv12_drumkits_list', 'daemonv12_instruments_list', 'daemonv12_project_create', 'daemonv12_project_patch',
  'daemonv12_project_read', 'daemonv12_project_validate', 'daemonv12_render', 'daemonv12_render_info'];
const HIDDEN_AUDIO = { DAEMONV12_FLUIDSYNTH: '/daemonv12-unavailable/fluidsynth', DAEMONV12_SOUNDFONT: '/daemonv12-unavailable/FluidR3_GM.sf2', DAEMONV12_FFMPEG: '/daemonv12-unavailable/ffmpeg' };
const BUDGET = { entries: 120, packedBytes: 6_000_000, unpackedBytes: 9_000_000 };
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const inside = (path: string, dir: string) => path === dir || path.startsWith(dir + sep);
const files = (dir: string) => readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter(file => statSync(join(dir, file)).isFile()).map(file => file.split(sep).join('/'));
// Environment for npm itself: the user's registry, proxy and cache settings (including uppercase
// NPM_CONFIG_* from CI), minus the lowercase variables npm injects into this repository's own
// lifecycle, such as npm_config_local_prefix, npm_package_* and INIT_CWD.
const npmEnv = () => Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(npm_|INIT_CWD$)/.test(name)));
function run(command: string, args: string[], options: SpawnSyncOptions & { env: NodeJS.ProcessEnv }) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 300_000, ...options });
  return { status: result.status, stdout: String(result.stdout ?? ''), stderr: String(result.stderr ?? ''), error: result.error };
}
// Harness-side PCM checks; the installed package is never asked to verify itself.
function audible(path: string) {
  const pcm = decodePcm(readFileSync(path)).pcm;
  assert.ok(pcm, `${path} must be PCM16 WAV`);
  let peak = 0, energy = 0;
  for (const sample of pcm.samples) { peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
  const peakDbfs = 20 * Math.log10(peak / 32768), rmsDbfs = 10 * Math.log10(energy / pcm.samples.length / 32768 ** 2);
  assert.ok(peakDbfs > -30 && rmsDbfs > -60, `${path} must be audible (peak ${peakDbfs.toFixed(1)} dBFS, RMS ${rmsDbfs.toFixed(1)} dBFS)`);
  return { frames: pcm.frames, peakDbfs, rmsDbfs };
}
function gitStatus(): string | null {
  const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: repo, encoding: 'utf8' });
  return status.status === 0 ? status.stdout : null;
}

test('packed tarball installs and works from an empty directory without the source checkout', { timeout: 900_000 }, async t => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'daemonv12-clean-room-')));
  if (process.env.DAEMONV12_KEEP_CLEAN_ROOM) t.diagnostic(`kept: ${root}`); else t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.ok(!inside(root, repo), 'the clean room must be outside the repository');
  const gitBefore = gitStatus();

  // 1. Pack exactly what `npm publish` would upload (prepare compiles dist/).
  const packs = join(root, 'tarball'); mkdirSync(packs);
  const pack = run('npm', ['pack', '--json', '--pack-destination', packs], { cwd: repo, env: npmEnv() });
  assert.equal(pack.status, 0, pack.stderr);
  const manifest = (JSON.parse(pack.stdout.slice(pack.stdout.indexOf('['))) as { filename: string; size: number; unpackedSize: number; entryCount: number; files: { path: string; mode: number }[] }[])[0]!;
  const tarball = join(packs, manifest.filename), packed = manifest.files.map(file => file.path);
  t.diagnostic(`${manifest.filename}: ${manifest.entryCount} files, ${manifest.size} bytes packed, ${manifest.unpackedSize} bytes unpacked`);

  await t.test('tarball: explicit allowlist, compiled runtime only, size budget', () => {
    const required = ['package.json', 'README.md', 'CHANGELOG.md', 'SECURITY.md', 'bin/daemonv12.js', 'bin/daemonv12-mcp.js', 'bin/launch.js',
      'dist/src/cli/main.js', 'dist/mcp/main.js', 'examples/README.md', 'examples/orbital-foundry.catalog.json', 'examples/glasshouse.catalog.json', ...STARTER_PROJECTS.map(project => `examples/${project}`),
      'examples/assets/orbital-foundry/kit.json', 'examples/assets/orbital-foundry/LICENSE', 'examples/assets/glasshouse/kit.json', 'examples/assets/glasshouse/LICENSE', 'examples/assets/pulse-kit/kit.json', 'examples/assets/v05/synthetic-vo.wav',
      'scripts/bootstrap-audio-tools.sh', 'scripts/audio-tools-linux-64.lock', 'docs/MCP_CLIENTS.md', 'docs/V0_SPEC.md'];
    for (const path of required) assert.ok(packed.includes(path), `tarball is missing ${path}`);
    for (const path of packed) assert.doesNotMatch(path, /\.ts$|\.tgz$|^(src|mcp|tests|reports|renders|node_modules|\.github|\.devcontainer)\/|\.daemonv12-renders|package-lock\.json/, `tarball must not contain ${path}`);
    // dist/ mirrors the runtime sources exactly: nothing stale, nothing missing, no development demo.
    const compiled = packed.filter(path => path.startsWith('dist/')).sort();
    const sources = [...files(join(repo, 'src')).map(file => `dist/src/${file}`), ...readdirSync(join(repo, 'mcp')).filter(file => file.endsWith('.ts') && file !== 'demo.ts').map(file => `dist/mcp/${file}`)];
    assert.deepEqual(compiled, sources.map(file => file.replace(/\.ts$/, '.js')).sort());
    for (const path of ['bin/daemonv12.js', 'bin/daemonv12-mcp.js', 'scripts/bootstrap-audio-tools.sh'])
      assert.ok(manifest.files.find(file => file.path === path)!.mode & 0o111, `${path} must be executable`);
    assert.ok(manifest.entryCount <= BUDGET.entries && manifest.size <= BUDGET.packedBytes && manifest.unpackedSize <= BUDGET.unpackedBytes,
      `package exceeds its budget ${JSON.stringify(BUDGET)}`);
  });

  // 2. Install only the tarball into an empty consumer project.
  const consumer = join(root, 'consumer'); mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'daemonv12-clean-room', private: true }) + '\n');
  const install = run('npm', ['install', '--no-audit', '--no-fund', '--prefer-offline', tarball], { cwd: consumer, env: npmEnv() });
  assert.equal(install.status, 0, install.stderr);
  const installed = join(consumer, 'node_modules', 'daemonv12'), bin = join(consumer, 'node_modules', '.bin');

  await t.test('install: a real copy with runtime dependencies only', () => {
    assert.ok(lstatSync(installed).isDirectory() && !lstatSync(installed).isSymbolicLink(), 'installed package must be a copy, not a link');
    for (const name of ['daemonv12', 'daemonv12-mcp']) assert.ok(existsSync(join(bin, name)), `missing executable ${name}`);
    for (const dependency of ['@modelcontextprotocol/server', '@modelcontextprotocol/core', 'zod']) assert.ok(existsSync(join(consumer, 'node_modules', dependency, 'package.json')), dependency);
    for (const development of ['@modelcontextprotocol/client', 'typescript', '@types/node', '@tonejs/midi']) assert.equal(existsSync(join(consumer, 'node_modules', development)), false, development);
    const shipped = files(installed);
    assert.equal(shipped.filter(file => file.endsWith('.ts')).length, 0, 'Node cannot strip types under node_modules');
    for (const file of shipped.filter(file => !/\.(wav|sf2)$/.test(file)))
      assert.equal(readFileSync(join(installed, file), 'utf8').includes(repo), false, `${file} embeds the source checkout path`);
  });

  // 3. Installed processes: minimal environment, temporary HOME, module-load tracing.
  const home = join(root, 'home'), temporary = join(root, 'tmp'), trace = join(root, 'trace');
  for (const dir of [home, temporary, trace]) mkdirSync(dir);
  const hook = join(trace, 'hook.mjs');
  writeFileSync(hook, `import { registerHooks } from 'node:module';\nimport { appendFileSync } from 'node:fs';\nconst log = ${JSON.stringify(trace)} + '/' + process.pid + '.log';\nregisterHooks({ load(url, context, nextLoad) { appendFileSync(log, url + '\\n'); return nextLoad(url, context); } });\n`);
  const PATH = [dirname(process.execPath), '/usr/bin', '/bin'].filter(dir => existsSync(dir) && !inside(realpathSync(dir), repo)).join(delimiter);
  const environment = (audio: Record<string, string> = HIDDEN_AUDIO): NodeJS.ProcessEnv =>
    ({ PATH, HOME: home, TMPDIR: temporary, NODE_OPTIONS: `--import=${pathToFileURL(hook).href}`, ...audio });
  const cli = (args: string[], cwd = consumer, audio?: Record<string, string>) => run(join(bin, 'daemonv12'), args, { cwd, env: environment(audio) });
  const realInstalled = realpathSync(installed), workspace = join(consumer, 'music');

  await t.test('executables: version and help without a checkout', () => {
    assert.deepEqual(cli(['--version']), { status: 0, stdout: `daemonv12 ${ENGINE_VERSION}\n`, stderr: '', error: undefined });
    const help = cli(['--help']);
    assert.equal(help.status, 0); assert.match(help.stdout, /daemonv12 init <new-workspace-directory>/); assert.match(help.stdout, /daemonv12 doctor/);
    const mcpVersion = run(join(bin, 'daemonv12-mcp'), ['--version'], { cwd: consumer, env: environment() });
    assert.equal(mcpVersion.status, 0); assert.equal(mcpVersion.stdout, `daemonv12-mcp ${ENGINE_VERSION}\n`);
    const mcpHelp = run(join(bin, 'daemonv12-mcp'), ['--help'], { cwd: consumer, env: environment() });
    assert.equal(mcpHelp.status, 0); assert.match(mcpHelp.stdout, /--root <dir>/);
  });

  await t.test('doctor: installed-package mode, Node-only readiness, actionable fixes', () => {
    const doctor = cli(['doctor', '--json']);
    assert.equal(doctor.status, 3, 'audio tools are hidden, so some capabilities are not ready');
    const report = JSON.parse(doctor.stdout);
    assert.deepEqual(report.installation, { mode: 'package', root: realInstalled });
    assert.equal(report.readiness.sampleOnly, true); assert.equal(report.readiness.mcp, true); assert.equal(report.readiness.generalMidi, false);
    assert.equal(report.dependencies.mcp.available, true);
    // npm is only reported when it is not on this minimal PATH; development tools are never asked for.
    const fixes = report.fixes.filter((fix: { component: string }) => fix.component !== 'npm');
    assert.deepEqual(fixes.map((fix: { component: string }) => fix.component), ['fluidsynth', 'soundfont', 'ffmpeg']);
    const bootstrap = join(realInstalled, 'scripts', 'bootstrap-audio-tools.sh');
    assert.ok(fixes[0].action.includes(bootstrap) && existsSync(bootstrap));
  });

  await t.test('init and Node-only render: audible WAV identical to the source checkout', async () => {
    const init = cli(['init', workspace, '--json']);
    assert.equal(init.status, 0, init.stderr);
    const created = JSON.parse(init.stdout);
    assert.deepEqual(created.mcp.args, [join(realInstalled, 'bin', 'daemonv12-mcp.js'), '--root', workspace]);
    assert.equal(cli(['validate', 'sample-only-demo.json'], workspace).status, 0);
    const render = cli(['render', 'sample-only-demo.json', '--json'], workspace);
    assert.equal(render.status, 0, render.stdout + render.stderr);
    const result = JSON.parse(render.stdout), wav = join(workspace, result.artifacts.wav);
    assert.equal(result.manifest.soundfont, null); assert.equal(result.manifest.wav.sha256, sha256(readFileSync(wav)));
    assert.equal(audible(wav).frames, 882_000);
    assert.equal(readFileSync(join(workspace, result.artifacts.manifest), 'utf8').includes(repo), false, 'manifest must not mention the checkout');
    const reference = await runCommand('render', join(repo, 'examples', 'sample-only-demo.json'), { outDir: join(root, 'reference'), env: HIDDEN_AUDIO });
    assert.equal(reference.exitCode, 0);
    assert.equal(result.manifest.wav.sha256, (reference.result.manifest!.wav as { sha256: string }).sha256, 'compiled package and TypeScript checkout must render identical bytes');
    // Without FFmpeg, production projects fail clearly instead of producing partial output.
    const production = cli(['render', 'v05-loop-demo.json', '--json'], workspace);
    assert.equal(production.status, 3); assert.equal(JSON.parse(production.stdout).errors[0].code, 'AUDIO_TOOL_NOT_FOUND');
  });

  await t.test('MCP: nine tools, instructions, and an agent-style session that renders audio', async () => {
    const client = new Client({ name: 'daemonv12-clean-room', version: '1' });
    const transport = new StdioClientTransport({ command: join(bin, 'daemonv12-mcp'), args: ['--root', workspace], cwd: root, env: environment() as Record<string, string>, stderr: 'pipe' });
    const call = async (name: string, args: Record<string, unknown>) => {
      const response = await client.callTool({ name, arguments: args });
      return response.structuredContent as Record<string, unknown> & { ok: boolean; errors: { code: string; hint?: string }[] };
    };
    try {
      await client.connect(transport, { timeout: 30_000 });
      assert.deepEqual(client.getServerVersion(), { name: 'daemonv12', version: ENGINE_VERSION });
      assert.match(client.getInstructions() ?? '', /daemonv12_render/);
      assert.deepEqual((await client.listTools()).tools.map(tool => tool.name).sort(), TOOLS);
      const kits = await call('daemonv12_drumkits_list', { project: 'clean-room-cue.json' });
      assert.ok((kits.kits as { kit: string }[]).some(kit => kit.kit === 'assets/orbital-foundry/kit.json'));
      const created = await call('daemonv12_project_create', { project: 'clean-room-cue.json', title: 'Clean-room cue', bpm: 100, bars: 2, key: 'D minor' });
      assert.equal(created.ok, true, JSON.stringify(created));
      const hits = ['mechanical-kick', 'machine-tick', 'industrial-snare', 'machine-tick'].map((pitch, beat) => ({ start: `1:${beat + 1}`, pitch, velocity: 0.8 }));
      const patched = await call('daemonv12_project_patch', { project: 'clean-room-cue.json', expectedSha256: created.sha256, edits: [
        { op: 'track_add', track: { id: 'foundry', instrument: { type: 'drumkit', kit: 'assets/orbital-foundry/kit.json' } } },
        { op: 'track_remove', trackId: 'lead' },
        { op: 'pattern_put', trackId: 'foundry', pattern: { id: 'drive', bars: 1, notes: hits } },
        { op: 'clips_set', trackId: 'foundry', clips: [{ bar: 1, pattern: 'drive' }, { bar: 2, pattern: 'drive' }] },
      ] });
      assert.equal(patched.ok, true, JSON.stringify(patched));
      assert.equal((await call('daemonv12_project_validate', { project: 'clean-room-cue.json' })).ok, true);
      // An explicit format requests loudness analysis, which needs FFmpeg; the error says how to proceed.
      const exported = await call('daemonv12_render', { project: 'clean-room-cue.json', format: 'wav' });
      assert.equal(exported.ok, false); assert.equal(exported.errors[0]!.code, 'AUDIO_TOOL_NOT_FOUND');
      assert.match(exported.errors[0]!.hint ?? '', /render without it when no format is requested/);
      const rendered = await call('daemonv12_render', { project: 'clean-room-cue.json' });
      assert.equal(rendered.ok, true, JSON.stringify(rendered));
      const artifacts = rendered.artifacts as { wav: string; manifest: string };
      assert.match(artifacts.wav, /^\.daemonv12-renders\/render-[^/]+\/clean-room-cue\.wav$/);
      assert.ok(audible(join(workspace, artifacts.wav)).frames >= 4.8 * 44_100, 'two bars at 100 BPM');
      const info = await call('daemonv12_render_info', { manifest: artifacts.manifest });
      assert.equal((info.manifest as { wav: { sha256: string } }).wav.sha256, sha256(readFileSync(join(workspace, artifacts.wav))));
      const analysis = await call('daemonv12_analyze', { audio: artifacts.wav });
      assert.equal(analysis.ok, false); assert.equal(analysis.errors[0]!.code, 'AUDIO_TOOL_NOT_FOUND', 'loudness analysis needs FFmpeg and says so');
    } finally { await client.close(); }
  });

  const tools = await inspectEnvironment({ env: process.env });
  const fullAudio = tools.readiness.generalMidi && tools.readiness.productionEffects && tools.readiness.mp3;
  await t.test('full audio from the package: GM, production effects, MP3, exact stems', { skip: !fullAudio && 'FluidSynth, a SoundFont and FFmpeg are not all available here' }, async () => {
    const audio = { DAEMONV12_FLUIDSYNTH: tools.fluidsynth.path!, DAEMONV12_SOUNDFONT: tools.soundfont.path!, DAEMONV12_FFMPEG: tools.ffmpeg.path! };
    const doctor = cli(['doctor', '--json'], consumer, audio);
    assert.equal(doctor.status, 0, doctor.stdout); assert.equal(JSON.parse(doctor.stdout).ok, true);
    const foundry = cli(['render', 'orbital-foundry-audition.json', '--json', '--out-dir', 'full'], workspace, audio);
    assert.equal(foundry.status, 0, foundry.stdout);
    const reference = await runCommand('render', join(repo, 'examples', 'orbital-foundry-audition.json'), { outDir: join(root, 'reference'), env: { ...process.env, ...audio } });
    assert.equal(JSON.parse(foundry.stdout).manifest.wav.sha256, (reference.result.manifest!.wav as { sha256: string }).sha256, 'production route must match the checkout byte for byte');
    const gm = cli(['render', 'production-demo.json', '--json', '--out-dir', 'full', '--format', 'wav,mp3'], workspace, audio);
    assert.equal(gm.status, 0, gm.stdout);
    const gmResult = JSON.parse(gm.stdout);
    assert.ok(gmResult.manifest.soundfont.sha256 && existsSync(join(workspace, gmResult.artifacts.mp3)));
    audible(join(workspace, gmResult.artifacts.wav));
    const loop = cli(['render', 'v05-loop-demo.json', '--json', '--out-dir', 'full', '--stems'], workspace, audio);
    assert.equal(loop.status, 0, loop.stdout);
    const loopResult = JSON.parse(loop.stdout);
    for (const wav of [loopResult.artifacts.wav, ...loopResult.artifacts.stems.map((stem: { wav: string }) => stem.wav)])
      assert.equal(decodePcm(readFileSync(join(workspace, wav))).pcm!.frames, 423_360, `${wav} must be exactly four bars`);
    const analysis = cli(['analyze', join('full', 'production-demo.wav'), '--json'], workspace, audio);
    assert.equal(analysis.status, 0); assert.equal(typeof JSON.parse(analysis.stdout).analysis.integratedLufs, 'number');
  });

  await t.test('no installed process loaded anything from the source checkout', () => {
    // One log per process. Every DaemonV12 process (CLI or MCP server) must load only from the
    // install; helper processes such as doctor's npm probe may load their own tools, but nothing
    // anywhere may come from the checkout.
    const processes = readdirSync(trace).filter(file => file.endsWith('.log')).map(file =>
      [...new Set(readFileSync(join(trace, file), 'utf8').split('\n'))].filter(url => url.startsWith('file:')).map(url => fileURLToPath(url)).filter(path => path !== hook));
    const daemon = processes.filter(paths => paths.some(path => inside(path, join(realInstalled, 'bin'))));
    assert.ok(daemon.length >= 8, `expected traced DaemonV12 processes, found ${daemon.length}`);
    assert.deepEqual(processes.flat().filter(path => inside(path, repo)), [], 'modules loaded from the source checkout');
    assert.deepEqual(daemon.flat().filter(path => !inside(path, consumer)), [], 'DaemonV12 modules loaded from outside the clean-room install');
    assert.ok(daemon.flat().some(path => inside(path, join(realInstalled, 'dist'))), 'the compiled runtime must be what ran');
    assert.ok(daemon.flat().some(path => inside(path, join(consumer, 'node_modules', '@modelcontextprotocol', 'server'))), 'the MCP SDK must come from the install');
    t.diagnostic(`${daemon.length} DaemonV12 processes loaded ${new Set(daemon.flat()).size} modules, all inside ${relative(root, consumer)}/`);
  });

  if (gitBefore !== null) assert.equal(gitStatus(), gitBefore, 'the release gate must not leave files in the repository');
});
