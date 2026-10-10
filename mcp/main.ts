import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { ENGINE_VERSION } from '../src/version.ts';
import { createServer } from './server.ts';

const usage = `Usage: daemonv12-mcp --root <workspace-directory>

Stdio MCP server for DaemonV12. An MCP client (Claude Code, Codex CLI or any
stdio client) launches this command; stdout carries only MCP JSON-RPC.

  --root <dir>   Existing workspace directory (required). Projects are JSON files
                 inside it; sounds live in assets/ next to each project; renders
                 go to <dir>/.daemonv12-renders/. Use an absolute path in client
                 configurations. Create a ready workspace: daemonv12 init <dir>
  -h, --help     Show this help.
  -v, --version  Show the version.

Audio tools come from the server's environment: DAEMONV12_FLUIDSYNTH,
DAEMONV12_SOUNDFONT, DAEMONV12_FFMPEG (or PATH and standard SoundFont locations).`;

// Startup problems go to stderr with exit 2; stdout stays reserved for the protocol.
function fail(message: string): void {
  process.stderr.write(`daemonv12-mcp: ${message}\nUsage: daemonv12-mcp --root <existing-workspace-directory> (see --help)\n`);
  process.exitCode = 2;
}

async function main(): Promise<void> {
  let values;
  try {
    ({ values } = parseArgs({ strict: true, options: { root: { type: 'string' }, help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' } } }));
  } catch (error) { return fail(error instanceof Error ? error.message : String(error)); }
  if (values.help) { process.stdout.write(usage + '\n'); return; }
  if (values.version) { process.stdout.write(`daemonv12-mcp ${ENGINE_VERSION}\n`); return; }
  if (!values.root) return fail('--root <workspace-directory> is required.');
  const root = resolve(values.root);
  const unexpanded = /^~|\$/.test(values.root) ? ' MCP client configurations do not expand ~ or environment variables; use an absolute path.' : '';
  let stat;
  try { stat = statSync(root); }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return fail(code === 'ENOENT' ? `--root workspace does not exist: ${root}.${unexpanded || ` Create it first, for example: daemonv12 init ${root}`}`
      : `cannot access --root workspace ${root}: ${code ?? 'unknown error'}. Check permissions.`);
  }
  if (!stat.isDirectory()) return fail(`--root must be a directory: ${root}`);
  let server;
  try { server = createServer(root); }
  catch (error) { return fail(`cannot open --root workspace ${root}: ${(error as NodeJS.ErrnoException).code ?? (error instanceof Error ? error.message : 'unknown error')}.`); }
  await server.connect(new StdioServerTransport());
  // A person who launches the server by hand otherwise sees a silent, waiting process.
  if (process.stdin.isTTY) process.stderr.write(`daemonv12-mcp ${ENGINE_VERSION}: serving ${root} on stdio and waiting for an MCP client. Configure your client to launch this command; press Ctrl+C to exit.\n`);
}

try { await main(); }
catch (error) { fail(`startup failed: ${error instanceof Error ? error.message : String(error)}`); }
