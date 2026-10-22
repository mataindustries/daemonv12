// CABLE//BEAST, V3: production refinement. V2 with the edits below (each answers a weakness
// measured in V2's render; see REVIEW.md). V1 and V2 are unchanged.
import { score as v2, E1 } from './v2.mjs';

const s = structuredClone(v2);
s.name = 'CABLE//BEAST v3';

export const CHANGES = [
  'Dynamics: the Beast\'s stop-consonant bursts (20.76 s, 24.38 s: 23 dB above its voice) are soft-limited to 14 dB above it, so they stop driving the master clip.',
  'Separation: the Beast gives way (-10 dB for 30 ms, back in 50 ms) at each cable onset, so slaps and pops speak through the unison; its wound-up voice lets go a 32nd before the payoff slap.',
  'Payoff downbeat: the wind-up 2 ratchet ends exactly on the downbeat and the clank is gone, so the slap at 20.0 s speaks; alarm bells ring a 16th after the payoff and unison downbeats.',
  'Energy arc: the bowed talk in wind-up 1 is 3 dB lower, wind-up 2 keeps more of its push, and the slack cable chirps are louder in the break, so the payoff is the biggest moment and the 8-10 s sag is shallower; the Beast\'s wound-up growl is 2 dB lower so the approach does not outshout the arrival.',
  'Separation: the Beast sits wider (two mouths, 9 ms apart) while the cable stays centred; the Beast\'s unison ride drops from +6 to +3 dB.',
  'Opening: the first sound is the cable alone (the kick enters at 2.0 s), its upper band +3 dB in bar 1 so the hook reads on small speakers.',
  'Payoff impact: drums ride up in the payoff (kick +1.5, snare, ticks and toms +2 dB) and in the break (snare +2, ticks +3 dB); the Beast sits 2 dB lower overall after its bursts were tamed.',
  'Dynamics: the Beast\'s solo after the choke drops back to 0 dB (V2 rode it +3), so the negative space stays intimate and the climb into the payoff is about 5 dB.',
  'Ending: the final reflections decay further inside the 28 s container.',
  'Ticks are a round-robin of 8 cable-tick samples (instead of a new sample per hit), so the DaemonV12 sampler can play them; bells and the clank get their own stem.',
];

s.mix = { ...s.mix, beastCrest: 14, beastYield: 0.7, beastMid: -8, beastWidth: 0.6, beastHaas: 0.009, splitPerc: true };
s.drums.tickVariants = 8; // a round-robin of 8 tick samples: reproducible by DaemonV12's sampler
s.beast.winds = [{ ...s.beast.winds[0], to: 159.5 }]; // the Beast lets go a 32nd before the payoff slap
s.ratchets[1] = { ...s.ratchets[1], to: 160, gain: [[152, 0.8], [159, 0.55], [160, 0.4]] };
s.drums.clanks = s.drums.clanks.filter(([st]) => st !== 160);
s.drums.bells = [...s.drums.bells, [160.5, 0.4], [192.5, 0.4]];
s.drums.kicks = s.drums.kicks.filter(([st]) => st !== 0);
s.automation = {
  ...s.automation,
  beastMid: [[0, 0], [151, 0], [152, 2], [159.5, 2], [160, 4], [191, 4], [192, 3], [207, 3], [208, 4], [212, 4], [213, 0]],
  cable: [[0, 0], [63.9, 0], [64.1, 3], [79.8, 3], [80, 0], [87.9, 0], [88.2, -3], [91.8, -3], [92, 0], [151.9, 0], [152, -2], [159.5, -2], [160, 0]],
  partner: [[0, 0], [63.9, 0], [64.1, 2], [79.8, 2], [80, 0]],
  cablePresence: [[0, 3], [15, 3], [16, 0]],
  kick: [[0, 0], [159.9, 0], [160, 1.5], [211.9, 1.5], [212, 0]],
  snare: [[0, 0], [63.9, 0], [64.1, 2], [79.8, 2], [80, 0], [159.9, 0], [160, 2], [211.9, 2], [212, 0]],
  perc: [[0, 0], [63.9, 0], [64.1, 3], [79.8, 3], [80, 0], [159.9, 0], [160, 2], [211.9, 2], [212, 0]],
  toms: [[0, 0], [159.9, 0], [160, 2], [211.9, 2], [212, 0]],
};
const last = s.cable.regions.find(r => r.step === 212);
last.gain = [0.93, 0.7];
s.partner.gain = s.partner.gain.map(([st, g]) => (st === 222 ? [222, 0.6] : [st, g]));

export const score = s;
export { E1 };
