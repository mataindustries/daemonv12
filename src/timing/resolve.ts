import { diagnostic, type Diagnostic } from '../diagnostics.ts';
import type { Project } from '../project/types.ts';
import { formatDuration, formatPosition, ticksPerBar, usPerQuarter, PPQ } from './musical-time.ts';
import type { Timeline, TimelineNote } from './timeline.ts';
interface LocatedNote extends TimelineNote { path: string; clip: number; pattern: number; note: number; member: number }
export function resolve(project: Project): { timeline: Timeline | null; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const barTicks = ticksPerBar(project.timeSignature);
  const timeline: Timeline = {
    title: project.title, ppq: PPQ, bpm: project.bpm, usPerQuarter: usPerQuarter(project.bpm),
    timeSignature: project.timeSignature, key: project.key, ticksPerBar: barTicks, endTick: project.bars * barTicks,
    tracks: project.tracks.map((track, index) => {
      const notes: LocatedNote[] = [];
      track.clips.forEach((clip, ci) => {
        const pi = track.patterns.findIndex(p => p.id === clip.pattern), pattern = track.patterns[pi]!;
        pattern.notes.forEach((note, ni) => note.pitches.forEach((pitch, member) => notes.push({
          tick: (clip.bar - 1) * barTicks + note.startTicks, durationTicks: note.durationTicks, pitch, velocity: note.velocity,
          path: `tracks[${index}].patterns[${pi}].notes[${ni}]`, clip: ci, pattern: pi, note: ni, member,
        })));
      });
      notes.sort((a,b) => a.tick-b.tick || a.pitch-b.pitch || a.clip-b.clip || a.pattern-b.pattern || a.note-b.note || a.member-b.member);
      const previous = new Map<number, LocatedNote>();
      for (const note of notes) {
        const prev = previous.get(note.pitch);
        if (prev && note.tick < prev.tick + prev.durationTicks) {
          const d = diagnostic('NOTE_OVERLAP', note.path, note.pitch, 'non-overlapping notes of the same pitch on one track',
            note.tick > prev.tick ? `Shorten the earlier note to "${formatDuration(note.tick-prev.tick)}" or move one note to another track.` : 'Move one note to another track or remove the duplicate.');
          d.message = `Pitch ${note.pitch}: ${prev.path} (tracks[${index}].clips[${prev.clip}], ${formatPosition(prev.tick, project.timeSignature)}) overlaps ${note.path} (tracks[${index}].clips[${note.clip}], ${formatPosition(note.tick, project.timeSignature)}).${prev.path === note.path && prev.clip === note.clip ? ' Both pitches come from the same chord.' : ''}`;
          diagnostics.push(d);
        }
        // Retain the furthest-reaching note to catch nesting as well as adjacent overlaps.
        if (!prev || note.tick + note.durationTicks > prev.tick + prev.durationTicks) previous.set(note.pitch, note);
      }
      return { id: track.id, index, instrument: { type: 'gm', program: track.instrument.program },
        notes: notes.map(({ tick, durationTicks, pitch, velocity }) => ({ tick, durationTicks, pitch, velocity })) };
    }),
  };
  return { timeline: diagnostics.length ? null : timeline, diagnostics };
}
