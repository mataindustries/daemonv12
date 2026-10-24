// Optional Daemon timeline adapter. Custom scores can call buildEventMap directly.
import type { Timeline } from './timing/timeline.ts';
import { ticksToFrames } from './timing/musical-time.ts';
import type { ScheduledEvent, JsonObject } from './sync/index.ts';

export function scheduledEventsFromTimeline(
  timeline: Timeline, source: JsonObject, sampleRate = 44100,
  visualRoles: Readonly<Record<string, readonly string[]>> = {},
): ScheduledEvent[] {
  return timeline.tracks.flatMap(track => track.notes.map((note, noteIndex) => ({
    sampleFrame: ticksToFrames(note.tick, timeline.usPerQuarter, sampleRate),
    trackId: track.id, eventId: String(noteIndex), velocity: note.velocity,
    ...(visualRoles[track.id] ? { visualRoles: [...visualRoles[track.id]!] } : {}),
    source: { ...source, trackIndex: track.index, noteIndex, tick: note.tick, pitch: note.pitch },
  })));
}
