import { constants, copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { diagnostic, type Diagnostic } from '../diagnostics.ts';
import { packageRoot } from '../installation.ts';
import { executablePath } from '../render/index.ts';
import { ENGINE_VERSION } from '../version.ts';

// Newcomer order. Every file here and examples/assets/ is in the package "files" allowlist.
export const STARTER_PROJECTS = ['sample-only-demo.json', 'orbital-foundry-audition.json', 'v05-loop-demo.json',
  'v05-video-demo.json', 'production-demo.json', 'shoot-the-moon-locked-score.json'] as const;
const STARTER_FILES = [...STARTER_PROJECTS, 'orbital-foundry.catalog.json', 'README.md'];
const AUDIO_VARIABLES = ['DAEMONV12_FLUIDSYNTH', 'DAEMONV12_SOUNDFONT', 'DAEMONV12_FFMPEG'] as const;

// POSIX shell quoting for the copy-and-paste commands printed below.
const quote = (value: string) => /^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;

export interface InitResult {
  ok: boolean; command: 'init'; engineVersion: string; workspace: string; files: string[];
  cli: string; mcp: { command: string; args: string[]; env: Record<string, string> } | null;
  errors: Diagnostic[]; warnings: Diagnostic[];
}

// Creates a new or empty directory; never overwrites, and removes its own copies on failure.
export function initWorkspace(target: string, env: NodeJS.ProcessEnv, root = packageRoot()): InitResult {
  const workspace = resolve(target);
  const result: InitResult = { ok: false, command: 'init', engineVersion: ENGINE_VERSION, workspace, files: [], cli: '', mcp: null, errors: [], warnings: [] };
  const failure = (code: 'USAGE_ERROR' | 'OUTPUT_WRITE_FAILED' | 'INTERNAL_ERROR', message: string) => {
    const d = diagnostic(code, '', workspace, 'a new or empty directory', code === 'INTERNAL_ERROR'
      ? 'This DaemonV12 installation is incomplete; reinstall it or restore the repository examples.' : 'init never overwrites files; choose a new or empty directory.');
    d.message = message; result.errors.push(d); return result;
  };
  const sources = [...STARTER_FILES, 'assets'].map(file => join(root, 'examples', file));
  const absent = sources.filter(file => !existsSync(file));
  if (absent.length) return failure('INTERNAL_ERROR', `Starter files are missing: ${absent.join(', ')}`);
  let created = false;
  try {
    if (readdirSync(workspace).length) return failure('USAGE_ERROR', `Workspace directory is not empty: ${workspace}`);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOTDIR') return failure('USAGE_ERROR', `Workspace path is a file, not a directory: ${workspace}`);
    if (code !== 'ENOENT') return failure('OUTPUT_WRITE_FAILED', `Cannot read workspace directory ${workspace}: ${code}`);
    created = true;
  }
  const copied: string[] = [];
  try {
    mkdirSync(workspace, { recursive: true });
    for (const file of STARTER_FILES) {
      copyFileSync(join(root, 'examples', file), join(workspace, file), constants.COPYFILE_EXCL); copied.push(join(workspace, file));
    }
    copied.push(join(workspace, 'assets'));
    cpSync(join(root, 'examples', 'assets'), join(workspace, 'assets'), { recursive: true, errorOnExist: true, force: false });
  } catch (error) {
    // Only this call's copies are removed; the directory itself only if init created it.
    for (const path of created ? [workspace] : copied) rmSync(path, { recursive: true, force: true });
    return failure('OUTPUT_WRITE_FAILED', `Cannot create workspace ${workspace}: ${error instanceof Error ? error.message : String(error)}`);
  }
  // The short command only when PATH resolves to this very copy; otherwise the absolute form.
  const cliScript = join(root, 'bin', 'daemonv12.js'), onPath = executablePath('daemonv12', env);
  let sameInstall = false;
  try { sameInstall = onPath !== null && realpathSync(onPath) === realpathSync(cliScript); } catch { /* Fall back to the absolute form. */ }
  // Relative tool paths would resolve against the client's directory; bare command names stay PATH lookups.
  const variables = Object.fromEntries(AUDIO_VARIABLES.filter(name => env[name]).map(name => [name, /[/\\]/.test(env[name]!) ? resolve(env[name]!) : env[name]!]));
  // Absolute Node and script paths: desktop MCP clients often do not inherit a terminal PATH.
  return { ...result, ok: true, files: [...STARTER_FILES, 'assets/'], cli: sameInstall ? 'daemonv12' : [process.execPath, cliScript].map(quote).join(' '),
    mcp: { command: process.execPath, args: [join(root, 'bin', 'daemonv12-mcp.js'), '--root', workspace], env: variables } };
}

export function formatInit(result: InitResult): string {
  const mcp = result.mcp!, launch = [mcp.command, ...mcp.args].map(quote).join(' ');
  const config = { mcpServers: { daemonv12: { command: mcp.command, args: mcp.args, ...(Object.keys(mcp.env).length ? { env: mcp.env } : {}) } } };
  const flags = Object.entries(mcp.env).map(([name, value]) => `--env ${name}=${quote(value)} `).join('');
  return [`Created DaemonV12 workspace: ${result.workspace}`,
    `  ${STARTER_PROJECTS.length} starter projects, orbital-foundry.catalog.json and README.md`,
    '  assets/orbital-foundry (12 CC0 cinematic sounds + kit), assets/pulse-kit, assets/v05',
    '', 'Hear it now (Node only, no audio tools needed):',
    `  cd ${quote(result.workspace)}`, `  ${result.cli} render sample-only-demo.json`,
    '', 'Connect an MCP client. It launches this stdio command:', `  ${launch}`,
    'Claude-style JSON ("mcpServers"):', JSON.stringify(config, null, 2),
    // Claude Code reads a name directly after --env as another KEY=value pair, so --transport separates them.
    `Claude Code: claude mcp add ${flags}--transport stdio daemonv12 -- ${launch}`,
    `Codex CLI:   codex mcp add daemonv12 ${flags}-- ${launch}`,
    ...(Object.keys(mcp.env).length ? [] : ['Audio tools: set DAEMONV12_FLUIDSYNTH, DAEMONV12_SOUNDFONT and DAEMONV12_FFMPEG before init to include them, or add an "env" block.']),
    ...(result.mcp!.args[0]!.includes('/_npx/') ? ['Note: this copy runs from the npx cache, which npm may clear. Install daemonv12 for a lasting MCP configuration.'] : []),
    'Guide: https://github.com/mataindustries/daemonv12/blob/main/docs/MCP_CLIENTS.md', ''].join('\n');
}
