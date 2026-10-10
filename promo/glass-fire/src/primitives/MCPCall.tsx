// A real DaemonV12 MCP tool call, flashed for a fraction of a second: the agent working
// in the background, never the centrepiece. Tool names match mcp/server.ts.
import {clamp01} from '../motion/physics.ts';
import {C, mono} from '../theme.ts';

export const MCP_TOOLS = [
  'project_create',
  'project_read',
  'project_validate',
  'project_patch',
  'instruments_list',
  'drumkits_list',
  'render',
  'analyze',
  'render_info',
] as const;
export type McpTool = (typeof MCP_TOOLS)[number];

type Props = {
  tool: McpTool;
  /** Short argument summary, e.g. "edits 6". */
  detail?: string;
  /** Result shown once the call "returns", e.g. "rev 4c1e…". */
  result?: string;
  t: number;
  t0: number;
  t1: number;
  x: number;
  y: number;
  u?: number;
};

export const MCPCall = ({tool, detail, result, t, t0, t1, x, y, u = 1}: Props) => {
  if (t < t0 || t >= t1) return null;
  const dt = t - t0;
  const name = `daemonv12_${tool}`;
  const typed = Math.ceil(clamp01(dt / 0.06) * name.length);
  const returned = dt > (t1 - t0) * 0.45;
  return (
    <div style={{position: 'absolute', left: x, top: y, display: 'flex', alignItems: 'center', gap: 14 * u, ...mono(17 * u, 500, 0.06)}}>
      <div style={{width: 2 * u, height: 22 * u, background: C.ink}} />
      <span style={{color: C.g6}}>→</span>
      <span style={{color: C.ink}}>{name.slice(0, typed)}</span>
      {detail && typed >= name.length ? <span style={{color: C.g6}}>{detail}</span> : null}
      {returned && result ? <span style={{color: C.g8}}>{`✓ ${result}`}</span> : null}
    </div>
  );
};
