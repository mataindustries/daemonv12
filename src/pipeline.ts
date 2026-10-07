import { capDiagnostics, type Diagnostic } from './diagnostics.ts';
import { loadProject, parseProjectText, type LoadResult } from './project/load.ts';
import { validateProject } from './project/validate.ts';
import type { Project } from './project/types.ts';
import { resolve } from './timing/resolve.ts';
import { ticksToSeconds } from './timing/musical-time.ts';
import type { Timeline } from './timing/timeline.ts';
export interface Compilation {
  diagnostics: Diagnostic[]; omitted?: number; project: Project | null; timeline: Timeline | null; projectBytes?: Uint8Array;
}
function compile(loaded: LoadResult): Compilation {
  if (loaded.diagnostics.length) return { diagnostics: loaded.diagnostics, project: null, timeline: null };
  const validated = validateProject(loaded.value);
  const resolved = validated.project ? resolve(validated.project) : { timeline: null, diagnostics: [] };
  return { ...capDiagnostics([...validated.diagnostics, ...resolved.diagnostics]), project: validated.project,
    timeline: resolved.timeline, ...(loaded.bytes ? { projectBytes: loaded.bytes } : {}) };
}
export function compileProjectText(text: string): Compilation { return compile(parseProjectText(text)); }
export function compileProjectFile(path: string): Compilation { return compile(loadProject(path)); }
export function summarize(project: Project, timeline: Timeline) {
  return { title: project.title, bars: project.bars, timeSignature: `${project.timeSignature.numerator}/${project.timeSignature.denominator}`,
    bpm: project.bpm, key: project.key?.text ?? null, tracks: timeline.tracks.length,
    notes: timeline.tracks.reduce((sum, track) => sum + track.notes.length, 0), durationTicks: timeline.endTick,
    durationSeconds: Number(ticksToSeconds(timeline.endTick, timeline.usPerQuarter).toFixed(6)) };
}
