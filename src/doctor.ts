import { spawnSync } from 'node:child_process';
import { closeSync, openSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { installation as detectInstallation, packageRoot } from './installation.ts';
import { executablePath, fluidSynthCommand, inspectFfmpeg, probeFluidSynth, resolveSoundfont, selectSoundfont, type SoundfontOptions } from './render/index.ts';
import { ENGINE_VERSION } from './version.ts';

export const REQUIRED_NODE = '>=22.18.0';
export function supportedNode(version: string): boolean {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return false;
  const major = Number(match[1]), minor = Number(match[2]);
  return major > 22 || (major === 22 && minor >= 18);
}

function dependencies(root: string, manifest: string, kind: 'dependencies' | 'devDependencies') {
  const require = createRequire(join(root, manifest));
  const pkg = JSON.parse(readFileSync(join(root, manifest), 'utf8')) as Record<string, Record<string, string>>;
  const packages = Object.entries(pkg[kind] ?? {}).map(([name, requiredVersion]) => {
    let version: string | null = null;
    try {
      let path: string;
      try { path = require.resolve(`${name}/package.json`); }
      catch {
        let dir = dirname(require.resolve(name));
        for (;;) {
          try {
            const candidate = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
            if (candidate.name === name) break;
          } catch { /* Keep looking above the resolved entry point. */ }
          const parent = dirname(dir);
          if (parent === dir) throw new Error('Package metadata unavailable.');
          dir = parent;
        }
        path = join(dir, 'package.json');
      }
      version = (JSON.parse(readFileSync(path, 'utf8')) as { version: string }).version;
    } catch { /* Missing packages are a diagnostic, not a command failure. */ }
    return { name, requiredVersion, version, present: version !== null, matches: version === requiredVersion };
  });
  return { available: packages.every(pkg => pkg.present && pkg.matches), packages };
}

// Where to get the external audio tools; the rootless script ships in checkouts and packages.
function audioInstall(root: string, packages: string, brew: string): string {
  return `Rootless on Linux x86_64 (glibc >=2.28): bash ${join(root, 'scripts', 'bootstrap-audio-tools.sh')}, then source the printed env.sh. `
    + `Or use system packages (Debian/Ubuntu: sudo apt-get install ${packages}; macOS Homebrew: brew install ${brew}).`;
}

export interface DoctorOptions extends SoundfontOptions { nodeVersion?: string; dependencyRoot?: string; probeTimeoutMs?: number }
export async function inspectEnvironment(options: DoctorOptions) {
  const { env } = options, root = options.dependencyRoot ?? packageRoot();
  const installation = detectInstallation(root);
  const node = { version: options.nodeVersion ?? process.version, required: REQUIRED_NODE, supported: supportedNode(options.nodeVersion ?? process.version), path: process.execPath };
  const npmProbe = spawnSync('npm', ['--version'], { env, encoding: 'utf8', timeout: options.probeTimeoutMs ?? 3000, maxBuffer: 8192, shell: false });
  const npm = { command: 'npm', path: executablePath('npm', env), version: npmProbe.status === 0 ? npmProbe.stdout.trim() : null,
    available: npmProbe.status === 0, error: npmProbe.status === 0 ? null : npmProbe.error?.message ?? `npm probe exited ${npmProbe.status}.` };
  const [fluid, sf, ffmpeg] = await Promise.all([
    probeFluidSynth({ env, probeTimeoutMs: options.probeTimeoutMs ?? 3000 }),
    resolveSoundfont(options), inspectFfmpeg({ env, timeoutMs: options.probeTimeoutMs ?? 3000 }),
  ]);
  const command = fluidSynthCommand(env);
  const fluidsynth = { command, path: fluid.value?.path ?? executablePath(command, env), version: fluid.value?.version ?? null,
    available: !!fluid.value, error: fluid.diagnostic?.message ?? null };
  const selected = selectSoundfont(options);
  let readable = false;
  if (selected.path !== undefined) {
    try { if (statSync(selected.path).isFile()) { const fd = openSync(selected.path, 'r'); closeSync(fd); readable = true; } }
    catch { /* Preserve the resolver diagnostic below. */ }
  }
  const soundfont = { selection: selected.selection, path: selected.path === undefined ? null : resolve(selected.path), readable,
    valid: !!sf.value, bytes: sf.value?.bytes ?? null, sha256: sf.value?.sha256 ?? null, error: sf.diagnostic?.message ?? null };
  const development = dependencies(root, 'package.json', 'devDependencies');
  const mcp = dependencies(root, 'package.json', 'dependencies');
  const readiness = {
    generalMidi: node.supported && fluidsynth.available && soundfont.valid,
    sampleOnly: node.supported,
    productionEffects: node.supported && ffmpeg.available && ffmpeg.capabilities.effects && ffmpeg.capabilities.loudnessAnalysis,
    mp3: node.supported && ffmpeg.available && ffmpeg.capabilities.mp3 && ffmpeg.capabilities.loudnessAnalysis,
    loudnessAnalysis: node.supported && ffmpeg.available && ffmpeg.capabilities.loudnessAnalysis,
    mcp: node.supported && mcp.available,
  };
  const fixes: { component: string; action: string }[] = [];
  if (!node.supported) fixes.push({ component: 'node', action: `Install Node ${REQUIRED_NODE}; older versions cannot run DaemonV12. Use the devcontainer or your Node version manager.` });
  if (!npm.available) fixes.push({ component: 'npm', action: 'Install npm alongside Node to install DaemonV12 and its dependencies. Rendering itself does not need npm.' });
  if (!fluidsynth.available) fixes.push({ component: 'fluidsynth', action: `General MIDI tracks (instrument type "gm") need FluidSynth; sampler and drumkit tracks render without it. ${audioInstall(root, 'fluidsynth fluid-soundfont-gm ffmpeg', 'fluid-synth ffmpeg')} Set DAEMONV12_FLUIDSYNTH to the executable if it is not on PATH; inspect the probe error for missing shared libraries.` });
  if (!soundfont.valid) fixes.push({ component: 'soundfont', action: 'General MIDI tracks also need a General MIDI SoundFont (.sf2) such as FluidR3_GM. The rootless bootstrap installs one (Debian/Ubuntu package: fluid-soundfont-gm). Set DAEMONV12_SOUNDFONT to its absolute path or pass --soundfont <file.sf2>. An explicit selection must be readable and valid; it never falls back to a system file.' });
  if (!readiness.productionEffects || !readiness.mp3 || !readiness.loudnessAnalysis) fixes.push({ component: 'ffmpeg', action: `Production rendering (track mix, effects or automation; master; render duration/tail), MP3 export and the analyze command need FFmpeg with highpass, lowpass, aecho, acompressor, loudnorm and libmp3lame. Plain sample-only projects render without it. ${audioInstall(root, 'ffmpeg', 'ffmpeg')} Set DAEMONV12_FFMPEG to the executable if it is not on PATH.` });
  if (installation.mode === 'source' && (!development.available || !mcp.available)) fixes.push({ component: 'dependencies', action: `Run npm ci in ${root}. It installs the pinned MCP runtime (@modelcontextprotocol/server, zod) and the development tools.` });
  if (installation.mode === 'package' && !mcp.available) fixes.push({ component: 'dependencies', action: 'Reinstall daemonv12 with npm (from the registry or a release tarball) so npm installs its runtime dependencies @modelcontextprotocol/server and zod.' });
  return { schemaVersion: 1 as const, command: 'doctor' as const, engineVersion: ENGINE_VERSION, installation,
    ok: Object.values(readiness).every(Boolean), platform: process.platform, architecture: process.arch,
    node, npm, fluidsynth, soundfont, ffmpeg, dependencies: { engineRuntime: { count: 0 }, development, mcp }, readiness, fixes };
}
export type DoctorReport = Awaited<ReturnType<typeof inspectEnvironment>>;

// What each readiness flag unlocks, in the order a first-time user needs them.
const capabilities: Record<keyof DoctorReport['readiness'], string> = {
  sampleOnly: 'sampler/drum-kit projects without production fields (Node only)',
  generalMidi: 'General MIDI instruments (FluidSynth + a GM SoundFont)',
  productionEffects: 'mix, effects, automation, master and exact durations (FFmpeg)',
  mp3: 'MP3 export (FFmpeg with libmp3lame)',
  loudnessAnalysis: 'LUFS/true-peak analysis and the analyze command (FFmpeg)',
  mcp: 'daemonv12-mcp stdio server for agents (MCP SDK + Zod)',
};
export function formatDoctor(report: DoctorReport): string {
  const tool = (name: string, item: { available: boolean; version: string | null; path: string | null; command: string; error?: string | null }) =>
    `  ${name}: ${item.available ? `${item.version ?? 'unknown version'} (${item.path ?? 'path unresolved'})` : `unavailable (${item.path ?? item.command})${item.error ? ` — ${item.error}` : ''}`}`;
  const flags = Object.entries(report.readiness) as [keyof DoctorReport['readiness'], boolean][];
  const ready = flags.filter(([, value]) => value).map(([name]) => name), missing = flags.filter(([, value]) => !value).map(([name]) => name);
  const source = report.installation.mode === 'source';
  return [`DaemonV12 ${report.engineVersion} doctor (${source ? 'source checkout' : 'installed package'}: ${report.installation.root})`,
    `  Node: ${report.node.version} (${report.node.supported ? 'supported' : 'unsupported'}; requires ${report.node.required})`,
    tool('npm', report.npm), tool('FluidSynth', report.fluidsynth),
    `  SoundFont: ${report.soundfont.path ?? 'not found'} (${report.soundfont.selection}; ${report.soundfont.valid ? 'readable RIFF/sfbk' : report.soundfont.error ?? 'invalid'})`,
    tool('FFmpeg', { ...report.ffmpeg, error: report.ffmpeg.diagnostic?.message ?? null }),
    `  Development dependencies: ${!source ? 'not needed by an installed package' : report.dependencies.development.available ? 'ready' : 'missing or different versions'}`,
    `  MCP runtime dependencies: ${report.dependencies.mcp.available ? 'ready' : 'missing or different versions'}`,
    'Capabilities:',
    ...flags.map(([name, value]) => `  ${name}: ${value ? 'ready' : 'not ready'} — ${capabilities[name]}`),
    missing.length === 0 ? 'Summary: everything is ready.'
      : `Summary: ready now: ${ready.length ? ready.join(', ') : 'nothing'}. Not ready: ${missing.join(', ')}; the fixes below say what each needs.`,
    ...report.fixes.map(fix => `  Fix ${fix.component}: ${fix.action}`),
    'Read-only probes; no audio was rendered. Readiness does not test a project or load SoundFont instruments.',
    ...(missing.length ? ['Exit code 3 only means at least one capability is not ready; ready capabilities work regardless.'] : []), ''].join('\n');
}
