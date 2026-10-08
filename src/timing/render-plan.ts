import type { Project, RenderDuration, AutomationPoint } from '../project/types.ts';
import { parseDuration, parsePosition, ticksPerBar, ticksToFrames, usPerQuarter } from './musical-time.ts';
import { secondsToFrames, secondsToMicroseconds } from './wall-time.ts';

export interface RenderPlan {
  authoredFrames: number; minimumFrames: number; outputFrames: number | null; audioEndFrames: number | null;
}
function durationFrames(duration: RenderDuration, project: Project): number {
  if ('seconds' in duration) return secondsToFrames(duration.seconds);
  const ticks = 'bars' in duration ? duration.bars * ticksPerBar(project.timeSignature) : parseDuration(duration.musical).value!;
  return ticksToFrames(ticks, usPerQuarter(project.bpm));
}
export function renderPlan(project: Project): RenderPlan {
  const endTick = project.bars * ticksPerBar(project.timeSignature), tempo = usPerQuarter(project.bpm);
  const authoredFrames = ticksToFrames(endTick, tempo);
  const requested = project.render?.duration;
  const output = requested ? durationFrames(requested, project) : null;
  const tail = project.render?.tail ?? 'auto';
  // Round the combined authored timeline + tail once, rather than summing rounded frames.
  const tailEnd = typeof tail === 'object' ? Number(((BigInt(endTick) * BigInt(tempo) + secondsToMicroseconds(tail.seconds) * 960n) * 44100n + 480000000n) / 960000000n)
    : tail === 'none' ? authoredFrames : null;
  const audioEndFrames = tailEnd === null ? output : Math.min(tailEnd, output ?? tailEnd);
  const outputFrames = output ?? tailEnd;
  return { authoredFrames, outputFrames, audioEndFrames,
    minimumFrames: Math.min(ticksToFrames(endTick, tempo, 44100, true), audioEndFrames ?? Infinity) };
}
export function automationFrames(points: AutomationPoint[] | undefined, project: Project) {
  return points?.map(point => ({ frame: 'seconds' in point.at ? secondsToFrames(point.at.seconds)
    : ticksToFrames(parsePosition(point.at.musical, project.timeSignature, project.bars + 1).value!, usPerQuarter(project.bpm)),
    value: point.value, transition: point.transition ?? 'step' as const }));
}
