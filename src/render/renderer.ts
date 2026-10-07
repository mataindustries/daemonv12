import type { Diagnostic } from '../diagnostics.ts';
export interface AudioRenderer {
  readonly name: string;
  render(request: RenderRequest): Promise<RenderOutcome>;
}
export interface RenderRequest { midiPath: string; wavPath: string }
export type RenderOutcome =
  | { ok: true; renderer: { name: string; version: string; settings: Record<string, string | number | boolean> };
      wav: { frames: number; sampleRate: number; channels: number; bitsPerSample: number } }
  | { ok: false; diagnostic: Diagnostic };
export interface Soundfont { path: string; file: string; bytes: number; sha256: string }
export interface RendererOptions { soundfont: Soundfont; env: NodeJS.ProcessEnv; timeoutMs?: number; probeTimeoutMs?: number }
