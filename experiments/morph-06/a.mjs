// CABLE//BEAST, Experiment A: THE GASP. MORPH//05 V3 (unchanged file, imported) plus 125 ms of
// silence before the payoff. The payoff downbeat stays at 20.000 s; the ending is V3's.
import { readFileSync } from 'node:fs';
import { score as v3 } from '../morph-05/v3.mjs';

// V3's own normalisation peaks (control.mjs): pinned, so the alternates keep V3's levels and drive
export const V3_LEVELS = JSON.parse(readFileSync(new URL('./v3-levels.json', import.meta.url), 'utf8')).levels;

/** Insert a gasp of `ms` before the payoff: the wind-up finishes, then everything is silent. */
export function withGasp(base, ms, name) {
  const s = structuredClone(base);
  s.name = name;
  s.levels = V3_LEVELS;
  const gap = ms / 1000, stepsGap = gap / 0.125, end = 160 - stepsGap; // 159 for 125 ms, 158 for 250 ms
  // the cable's wind-up completes at the start of the gasp (the whole accelerando, a little faster),
  // the hand holds the cable through the silence, and the payoff slap restarts it
  const w = s.cable.regions.findIndex(r => r.step === 152 && r.mode === 'wind');
  s.cable.regions.splice(w + 1, 0, { step: end, mode: 'bowed', detail: 'wind-up complete; held silent through the gasp' });
  s.cable.grabs.push({ from: end, to: 159.98 });
  // the drum ratchet follows the same faster wind-up and ends with it
  s.ratchets[1] = { ...s.ratchets[1], to: end, gain: [[152, 0.8], [end - 1, 0.55], [end, 0.4]] };
  // the Beast's wound-up voice lets go a 32nd before the gasp (V3: a 32nd before the payoff)
  s.beast.winds = [{ ...s.beast.winds[0], to: end - 0.25 }];
  // instruments restart from rest at 20.000 s, so their return needs only a 0.3 ms guard; rooms fade back over 30 ms
  s.silences = [{ from: 20 - gap, to: 20, fadeOut: 0.004, fadeIn: 0.0003, label: 'GASP' }];
  s.sections.splice(s.sections.findIndex(x => x.step === 160), 0, { step: end, name: 'The gasp', detail: `${ms} ms of silence; the payoff stays on 20.000 s` });
  return s;
}

export const CHANGES = [
  'Silence: 125 ms before the payoff. Every instrument, room and echo fades out over 4 ms (raised cosine) ending at 19.875 s and is exactly zero until 20.000 s; the payoff downbeat is unchanged (instruments return with a 0.3 ms guard, rooms over 30 ms).',
  'Wind-up 2 completes at 19.875 s instead of 20.000 s: the same accelerando (dotted eighth to E1) on a curve 12.5% shorter, in 7 drum repeats ending on a 26 ms round trip (V3: 9, the last cut short by the downbeat). Muting V3 as it was would instead have deleted its last 4 repeats, the fastest ones.',
  'The hand holds the cable through the gasp, so the payoff slap restarts it from rest; the Beast lets go a 32nd before the gasp.',
];
export const score = withGasp(v3, 125, 'CABLE//BEAST A: the gasp (125 ms)');
