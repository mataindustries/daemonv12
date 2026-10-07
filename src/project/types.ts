import type { TimeSignature } from '../timing/musical-time.ts';
import type { Key } from './key.ts';
export interface Project {
  formatVersion: 1; title: string; description: string | null; bpm: number;
  timeSignature: TimeSignature; key: Key | null; bars: number; seed: number; tracks: Track[];
}
export interface Track {
  id: string; description: string | null;
  instrument: { type: 'gm'; program: number; programName: string };
  clips: { bar: number; pattern: string }[]; patterns: Pattern[];
}
export interface Pattern { id: string; description: string | null; bars: number; notes: Note[] }
export interface Note { startTicks: number; durationTicks: number; pitches: number[]; velocity: number }
