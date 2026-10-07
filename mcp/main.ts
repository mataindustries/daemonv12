import { parseArgs } from 'node:util';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.ts';

try {
  const {values} = parseArgs({strict: true, options: {root: {type: 'string'}}});
  if (!values.root) throw new Error('Required: --root <existing-workspace-directory>');
  const server = createServer(values.root);
  await server.connect(new StdioServerTransport());
} catch {
  process.stderr.write('DaemonV12 MCP startup failed. Use --root <existing-workspace-directory> and check permissions.\n');
  process.exitCode = 2;
}
