// Real GLASSHOUSE waveform outlines (extracted by scripts/extract-glasshouse.ts from the
// repository's own WAVs). The promo's glass identity is the actual sound, not a drawing.
import type {Peaks} from '../primitives/Waveform.tsx';
import type {SampleId} from './contract.ts';
import waveforms from './glasshouse-waveforms.json';

export type GlassSound = Peaks & {
  name: string;
  note: string;
  fundamentalHz: number | null;
  seconds: number;
};

const sounds = waveforms.sounds as unknown as Record<SampleId, GlassSound>;

export const glassSound = (id: SampleId): GlassSound => {
  const sound = sounds[id];
  if (!sound) throw new Error(`no GLASSHOUSE waveform for ${id}`);
  return sound;
};
