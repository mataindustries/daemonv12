export interface Timeline {
  title: string; ppq: 960; bpm: number; usPerQuarter: number;
  timeSignature: { numerator: number; denominator: number };
  key: { sharpsFlats: number; mode: 'major' | 'minor' } | null;
  ticksPerBar: number; endTick: number; tracks: TimelineTrack[];
}
export interface TimelineTrack { id: string; index: number; instrument: { type: 'gm'; program: number }; notes: TimelineNote[] }
export interface TimelineNote { tick: number; durationTicks: number; pitch: number; velocity: number }
