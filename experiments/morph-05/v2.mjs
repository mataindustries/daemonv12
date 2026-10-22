// CABLE//BEAST, V2: musical improvement. V1 with the edits below (each answers a weakness found
// in V1's render; see REVIEW.md). V1 itself is unchanged.
import { score as v1, E1, F1, G1, B1 } from './v1.mjs';

const s = structuredClone(v1);
s.name = 'CABLE//BEAST v2';
const drop = (list, pred) => list.filter(x => !pred(x));

export const CHANGES = [
  'Bar 4 beat 4 (7.5 s): the dead air after the Beast\'s first answer becomes a break-snare and clank pickup into the break.',
  'Bars 9-10 (18.6 s): the dead air after the solo is gone: the Beast\'s last note collapses into creak, and the creak is wound back into pitch with the cable.',
  'Wind-up 2: the ratchet and cable step back so the Beast\'s voice being wound up is audible.',
  'Beast solo: less sub, more mouth (the vowels carry it).',
  'Payoff: the Beast is 4-6 dB more present; the second cable chirps 3 against 4 on the right throughout; bar 12 ends with a one-beat snap-and-wind ratchet into the unison bar (the transition, compressed).',
];

// 1. bar 4 beat 4: a pickup instead of dead air
s.drums.snares.push([60, 0.22, 'g'], [61, 0.28, 'g'], [62.5, 0.3, 'g'], [63, 0.45, 'b']);
s.drums.clanks.push([61, 0.45]);

// 2. the solo's last note collapses into creak, then is wound up with the cable
s.beast.winds = [{ collapse: 149, from: 152, to: 160, midi: E1, restPeriod: 0.25 }];

// 3. wind-up 2: ratchet and cable step back while the Beast winds
s.ratchets[1].gain = [[152, 0.7], [159, 0.5], [160, 0.35], [161, 0]];

// 4 + 5. mix rides (dB): the Beast solo sheds sub; the Beast leads the wind-up and the payoff
s.automation = {
  beastSub: [[0, 0], [139, 0], [140, -6], [151, -6], [160, -2], [161, 0]],
  beastMid: [[0, 0], [139, 0], [140, 3], [152, 4], [160, 4], [191, 4], [192, 6], [207, 6], [208, 4], [212, 4], [213, 0]],
  cable: [[0, 0], [151.9, 0], [152, -4], [159.5, -4], [160, 0]],
};

// 5. payoff: the second cable chirps 3 against 4 on the right from the payoff downbeat
s.partner.events.push({ step: 160, kind: 'pluck', amp: 0.6 }, { step: 176, kind: 'pluck', amp: 0.6 });
s.partner.gain = [[0, 0.6], [12, 0.6], [12.1, 0.84], [15.5, 0.84], [16, 0.5], [64, 0.5], [64.1, 0.84], [79, 0.84], [80, 0.5],
  [160, 0.5], [160.1, 0.84], [207, 0.84], [208, 0.5], [212, 0.5], [212.1, 0.84], [222, 0.82], [224, 0.3]];
s.drums.kicks.push([171, 0.55, 'g'], [187, 0.55, 'g']);

// 5. bar 12 beat 4: the cable snaps and winds back in one beat; the drums ratchet with it
s.cable.notes = drop(s.cable.notes, ([st]) => st >= 188 && st < 192);
s.cable.regions.splice(s.cable.regions.findIndex(r => r.step === 212), 0,
  { step: 188, mode: 'slack', snap: true, to: 0.125, k: 10, crackAmp: 0.8, detail: 'snap: one beat of slack' },
  { step: 189, mode: 'wind', midi: E1 },
  { step: 192, mode: 'pitched' });
s.ratchets.splice(2, 0, { from: 189, to: 192.5, capture: 'ks', gain: [[189, 0.9], [191.5, 0.6], [192, 0.4], [192.5, 0]] });
s.sections.splice(s.sections.findIndex(x => x.step === 192), 0, { step: 188, name: 'Wind-up 3', detail: 'the transition again, compressed into one beat' });

export const score = s;
export { E1, F1, G1, B1 };
