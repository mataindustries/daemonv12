// CABLE//BEAST, Experiment C: THE LONGER GASP. Experiment B's overload ending with a 250 ms
// silence before the payoff (19.750-20.000 s). The wind-up completes at 19.750 s.
import { withGasp } from './a.mjs';
import { withOverload } from './b.mjs';
import { score as v3 } from '../morph-05/v3.mjs';

export const CHANGES = [
  'Silence: 250 ms before the payoff (fade-out ending at 19.750 s, exactly zero until 20.000 s); the payoff downbeat is unchanged.',
  'Wind-up 2 completes at 19.750 s: the same accelerando on a curve 25% shorter than V3, in 6 drum repeats (the last cut at a 20 ms round trip). Muting V3 as it was would have deleted its last 6 repeats.',
  'The ending is Experiment B\'s overload, unchanged (cut at 27.600 s).',
];
export const score = withOverload(withGasp(v3, 250, 'CABLE//BEAST C'), 'CABLE//BEAST C: the longer gasp');
