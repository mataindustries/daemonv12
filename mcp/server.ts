import { Server, type Tool } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { ENGINE_VERSION } from '../src/version.ts';
import { DaemonTools } from './handlers.ts';
import { schemas, type ToolName } from './schemas.ts';

const descriptions: Record<ToolName, string> = {
  daemonv12_project_create: 'Create a validated project without overwriting. Defaults: 120 BPM, 4/4, 4 bars, seed 0, one silent GM piano track named lead. Parent directory must exist.',
  daemonv12_project_read: 'Read project intent, summary and sha256 revision. Patterns, notes and clips are paginated; no resolved render data. Use offsets and trackId/patternId for detail.',
  daemonv12_project_validate: 'Validate the project, musical timing, overlaps, kit mappings and sample WAV assets using the engine.',
  daemonv12_project_patch: 'Apply ordered semantic edits as one transaction with a required current sha256. Validate the complete result before atomic publication. pattern_put replaces or creates one pattern; clips_set and mix/effects replace their fields; null removes optional fields. Failed batches leave the original bytes intact.',
  daemonv12_instruments_list: 'Discover exact GM program names and optionally validated sampler WAV assets under the project assets/. Paginated, optional substring query.',
  daemonv12_drumkits_list: 'Discover valid reusable kits and their named/pitch mappings under the project assets/. Use examples/new.json to discover repository example assets before creating a project there.',
  daemonv12_render: 'Render through the existing engine into a fresh private output directory. WAV is always canonical; request stems and optional MP3. Returns workspace-relative artifact paths and compact provenance; never binary audio. Each call creates new artifacts.',
  daemonv12_analyze: 'Analyze a rendered master/stem WAV: duration, PCM format, sample peak, clipping, integrated LUFS, loudness range and true peak.',
  daemonv12_render_info: 'Read persisted render provenance by manifest path. Summary omits resolved sample triggers; full includes them. Describes that render, not necessarily the current project revision.',
};
export function createServer(root: string, env: NodeJS.ProcessEnv = process.env) {
  const server = new Server({name: 'daemonv12', version: ENGINE_VERSION}, {capabilities: {tools: {}}});
  const handlers = new DaemonTools(root, env);
  const tools: Tool[] = (Object.keys(schemas) as ToolName[]).map(name => {
    const readOnly = !['daemonv12_project_create', 'daemonv12_project_patch', 'daemonv12_render'].includes(name);
    return {name, description: descriptions[name], inputSchema: z.toJSONSchema(schemas[name], {io: 'input'}) as Tool['inputSchema'],
      annotations: {readOnlyHint: readOnly, destructiveHint: name === 'daemonv12_project_patch', idempotentHint: readOnly, openWorldHint: false}};
  });
  server.setRequestHandler('tools/list', async () => ({tools}));
  // SDK protocol/transport, application-owned schema validation: even malformed tool
  // arguments receive the same structured diagnostic envelope as engine failures.
  server.setRequestHandler('tools/call', async request => {
    const result = await handlers.call(request.params.name, request.params.arguments);
    return {isError: !result.ok, content: [{type: 'text' as const, text: JSON.stringify(result)}], structuredContent: result};
  });
  return server;
}
