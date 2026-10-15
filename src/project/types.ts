import type { TimeSignature } from '../timing/musical-time.ts';
import type { Key } from './key.ts';
import type { Effect, DuckingSettings } from '../audio-types.ts';
export type { Effect } from '../audio-types.ts';
export type TimeReference = { musical: string } | { seconds: number };
export type RenderDuration = { bars: number } | { musical: string } | { seconds: number };
export interface RenderSettings { duration?: RenderDuration; tail?: 'auto' | 'none' | { seconds: number } }
export interface AutomationPoint { at: TimeReference; value: number; transition?: 'step' | 'linear' }
export interface TrackAutomation { gainDb?: AutomationPoint[]; pan?: AutomationPoint[] }
export interface Ducking extends DuckingSettings { source: string }
export interface TrackMix { gainDb?: number; pan?: number }
export interface MasterMix { gainDb?: number; effects?: Effect[]; ducking?: Ducking }
export interface Project {
  master?: MasterMix; render?: RenderSettings;
  formatVersion: 1; title: string; description: string | null; bpm: number;
  timeSignature: TimeSignature; key: Key | null; bars: number; seed: number; tracks: Track[];
}
export interface Track {
  mix?: TrackMix; effects?: Effect[]; automation?: TrackAutomation;
  id: string; description: string | null;
  instrument: Instrument;
  clips: { bar: number; pattern: string }[]; patterns: Pattern[];
}
export type Instrument = { type: 'gm'; program: number; programName: string }
  | { type: 'sampler'; sample: string }
  | { type: 'drumkit'; kit: string };
export interface Pattern { id: string; description: string | null; bars: number; notes: Note[] }
// Present only when a sampler/drum-kit note departs from rate 1, offset 0 and no glide.
export interface SamplePlayback { rate: number; offsetSeconds: number; glide?: { to: number; durationTicks: number } }
// Present only when a sampler/drum-kit note explicitly requests articulation.
export interface SampleArticulation {
  endSeconds?: number; gateTicks?: number; attackSeconds: number; releaseSeconds: number; chokeGroup?: string;
}
export interface Note { startTicks: number; durationTicks: number; pitches: number[]; velocity: number;
  playback?: SamplePlayback; articulation?: SampleArticulation }
