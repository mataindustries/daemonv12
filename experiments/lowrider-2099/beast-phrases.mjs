// Candidate B's answers: the MORPH//06 Wobble Beast (a bowed cable through the MORPH//03
// Kelly-Lochbaum throat; every wobble is a mouth shape, never an LFO), vendored unchanged.
// The Beast schedules in 120 BPM 16ths (0.125 s); a 96 BPM 16th is 1.25 of those.
import { beast } from './vendor/morph-06/beast.mjs';
import { SR } from './instruments.mjs';

const F1 = 29, Ab1 = 32, Bb1 = 34, C2 = 36, Db2 = 37, E2 = 40, F2 = 41, Ab2 = 44, F3 = 53;
const PRE = 1;              // first syllable at 120-BPM step 1 (0.125 s) so the inhale fits before it
export const PREROLL = 0.078125; // the file starts one 96-BPM 32nd before the first syllable

// cells in 96 BPM 16ths from the answer's downbeat
export const BEAST = {
  // an octave above the first draft: at F1 the bowed cable barely sustains (body ~-20 dB)
  'beast-wom': { anger: 0.75, cells: [
    { s: 0, len: 2, syl: 'WOM', midi: F2 }, { s: 2, len: 1, syl: 'ka', midi: F2 },
    { s: 3, len: 2, syl: 'YOI', midi: F3 }, { s: 5, len: 1, syl: 'ka', midi: Ab2 },
  ] },
  'beast-dive': { anger: 0.9, cells: [
    { s: 0, len: 1, syl: 'ya', midi: Bb1 }, { s: 1, len: 1, syl: 'ya', midi: C2 },
    { s: 2, len: 4, syl: 'EEYOOW', midi: E2, toMidi: F1, dive: true },
  ] },
  'beast-wa-wa': { anger: 0.8, cells: [
    { s: 0, len: 1.5, syl: 'wa', midi: Db2 }, { s: 1.5, len: 1.5, syl: 'wa', midi: Db2 },
    { s: 3, len: 3, syl: 'YOW', midi: C2, toMidi: F1 },
  ] },
};

export function renderBeastPhrase({ anger, cells }) {
  const c120 = cells.map(c => ({ step: PRE + c.s * 1.25, len: c.len * 1.25, syl: c.syl, midi: c.midi, toMidi: c.toMidi, dive: c.dive }));
  const last = c120[c120.length - 1];
  const seconds = (last.step + last.len) * 0.125 + 0.35;
  const { sub, mid } = beast({ seconds, phrases: [{ name: 'answer', anger, cells: c120 }], seed: 77 });
  const from = Math.round((PRE * 0.125 - PREROLL) * SR), out = new Float64Array(sub.length - from);
  // fade out just before the lips seal after the last syllable: sealing a sounding tract pops
  const end = PREROLL + (last.step + last.len - PRE) * 0.125, f0 = end - 0.035, f1 = end - 0.004;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, g = t < f0 ? 1 : t >= f1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (t - f0) / (f1 - f0));
    out[i] = (mid[from + i] + 0.7 * sub[from + i]) * g;
  }
  return out;
}
