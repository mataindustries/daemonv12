// CABLE//BEAST, V1: the complete arrangement (14 bars, 120 BPM, E Phrygian, 28 s).
// Steps are absolute 16ths from the start (bar n starts at step 16 * (n - 1)); 0.125 s each.
//
// Thesis
//   hook      the CABLE CALL: SLAP (pitch dive) . ghost . octave POP . G "ow", answered by an
//             F~E bend: one gesture made only of the cable's physical articulations
//   rhythm    HEAVY's half-time weight is the anchor; BREAKS' cable-clocked time mutates it
//   low end   the cable's E1 owns the sub; the membrane kick lands on slaps or in the gaps
//   contrast  exposed call -> heavy groove -> break -> conversation -> choke and a sung solo
//   payoff    cable and Beast, who only answered each other, play the hook as one voice
//   ending    the hook is cut off by the SNAP; its reflections lead back to the opening slap
export const E1 = 28, F1 = 29, G1 = 31, A1 = 33, Bb1 = 34, B1 = 35, E2 = 40;
const S = { amp: 1.5, stretch: 0.3 }, SBIG = { amp: 1.7, stretch: 0.45 }, SLIGHT = { amp: 1.2, stretch: 0.18 };
const third = 4 / 3;

export const score = {
  name: 'CABLE//BEAST v1',
  sections: [
    { step: 0, name: 'I. The call', detail: 'the hook alone, the cable lets go, reflections' },
    { step: 16, name: 'The call, grounded', detail: 'hook + kick + 16th ticks' },
    { step: 32, name: 'II. Heavy', detail: 'half-time groove (MORPH//04 A)' },
    { step: 52, name: 'The Beast answers', detail: 'it imitates the hook with its mouth' },
    { step: 64, name: 'III. Breaks', detail: 'the cable goes slack: 3-against-4 chirps (MORPH//04 B)' },
    { step: 80, name: 'Wind-up 1', detail: 'drums ratchet with the cable into a 41 Hz tone' },
    { step: 96, name: 'IV. Call and response', detail: 'no snare: cable calls, Beast answers' },
    { step: 128, name: 'V. The choke', detail: 'heavy statement, then everything stops' },
    { step: 140, name: 'Beast solo', detail: 'the hook sung slowly, unaccompanied' },
    { step: 152, name: 'Wind-up 2', detail: 'cable, drums and the Beast\'s voice are wound into pitch together' },
    { step: 160, name: 'VI. Payoff', detail: 'heavy + break complexity; cable and Beast share the hook (hocket)' },
    { step: 192, name: 'Unison', detail: 'cable and Beast play the whole hook as one voice' },
    { step: 208, name: 'VII. The snap', detail: 'the hook is cut off; reflections lead back to the opening' },
  ],
  cable: {
    seed: 31,
    notes: [
      // bar 1: the call, exposed; then the cable lets go (snap at step 12)
      [0, E1, 'slap', 1.75, S], [2, E1, 'ghost', 0.6], [3, E1, 'pluck', 1.25, { pop: 2 }], [6, G1, 'pluck', 1.5, { vowel: 'ow' }],
      [8, E1, 'slap', 1, SLIGHT], [10, F1, 'pluck', 1.9, { bendTo: E1 }],
      // bar 2: the call again, grounded, and the run into the groove
      [16, E1, 'slap', 1.75, S], [18, E1, 'ghost', 0.6], [19, E1, 'pluck', 1.25, { pop: 2 }], [22, G1, 'pluck', 1.5, { vowel: 'ow' }],
      [24, E1, 'slap', 1, SLIGHT], [26, F1, 'pluck', 1.4, { bendTo: E1 }], [28, B1, 'pluck', 0.75], [29, A1, 'pluck', 0.75],
      [30, G1, 'pluck', 0.5], [30.5, G1, 'pluck', 0.5], [31, A1, 'pluck', 0.5], [31.5, B1, 'pluck', 0.5, { hard: 1 }],
      // bar 3: HEAVY statement (the slap answers the snare a 16th late)
      [32, E1, 'slap', 1.75, S], [34, E1, 'ghost', 0.6], [35, E1, 'pluck', 1.25, { pop: 2 }], [38, G1, 'pluck', 1.5, { vowel: 'ow' }],
      [41, E1, 'slap', 1, SLIGHT], [42, F1, 'pluck', 1.4, { bendTo: E1 }], [44, B1, 'pluck', 0.75], [45, A1, 'pluck', 0.75], [47, B1, 'pluck', 0.5, { hard: 1 }],
      // bar 4: the biggest slap, then the cable listens; a run into the break
      [48, E1, 'slap', 1.75, SBIG], [50, E1, 'ghost', 0.6], [51, E1, 'pluck', 1, { pop: 2 }],
      [62, G1, 'pluck', 0.5], [62.5, G1, 'pluck', 0.5], [63, A1, 'pluck', 0.5], [63.5, B1, 'pluck', 0.5, { hard: 1 }],
      // bar 6, beat 4: the 32nd stutter out of the bowed talk
      [92, E1, 'pluck', 0.5, { hard: 0.5, amp: 0.55 }], [92.5, E1, 'pluck', 0.5, { hard: 0.55, amp: 0.6 }], [93, E1, 'pluck', 0.5, { hard: 0.6, amp: 0.65 }], [93.5, E1, 'pluck', 0.5, { hard: 0.65, amp: 0.7 }],
      [94, G1, 'pluck', 0.5, { hard: 0.7, amp: 0.75 }], [94.5, G1, 'pluck', 0.5, { hard: 0.75, amp: 0.8 }], [95, A1, 'pluck', 0.5, { hard: 0.85, amp: 0.85 }], [95.5, B1, 'pluck', 0.5, { hard: 1, amp: 0.9 }],
      // bar 7: call 1
      [96, E1, 'slap', 1.75, S], [98, E1, 'ghost', 0.6], [99, E1, 'pluck', 1.25, { pop: 2 }], [102, G1, 'pluck', 1.5, { vowel: 'ow' }],
      [111, B1, 'pluck', 0.5, { hard: 1 }],
      // bar 8: call 2, angrier: twelfth pop and a tritone re-tension
      [112, E1, 'slap', 1.75, SBIG], [114, E1, 'ghost', 0.6], [115, E1, 'pluck', 1, { pop: 3, hard: 1 }], [118, G1, 'pluck', 1.5, { snapTo: Bb1, snapAt: 119 }],
      // bar 9: HEAVY statement into the choke
      [128, E1, 'slap', 1.75, S], [130, E1, 'ghost', 0.6], [131, E1, 'pluck', 1.25, { pop: 2 }], [134, G1, 'pluck', 1.5, { vowel: 'ow' }],
      // bar 11: payoff, hocket: the Beast takes the ghost, the "ow" and the bend
      [160, E1, 'slap', 1.75, S], [163, E1, 'pluck', 1.25, { pop: 2 }], [169, E1, 'slap', 1, SLIGHT], [172, B1, 'pluck', 0.75], [173, A1, 'pluck', 0.75], [175, B1, 'pluck', 0.5, { hard: 1 }],
      // bar 12
      [176, E1, 'slap', 1.75, SBIG], [178, E1, 'ghost', 0.6], [179, E1, 'pluck', 1, { pop: 3, hard: 1 }], [182, G1, 'pluck', 1.5, { snapTo: Bb1, snapAt: 183 }],
      [188, B1, 'pluck', 0.75], [189, A1, 'pluck', 0.75], [190, G1, 'pluck', 0.5], [190.5, G1, 'pluck', 0.5], [191, A1, 'pluck', 0.5], [191.5, B1, 'pluck', 0.5, { hard: 1 }],
      // bar 13: unison with the Beast
      [192, E1, 'slap', 1.75, S], [194, E1, 'ghost', 0.6], [195, E1, 'pluck', 1.25, { pop: 2 }], [198, G1, 'pluck', 1.5, { vowel: 'ow' }],
      [201, E1, 'slap', 1, SLIGHT], [202, F1, 'pluck', 1.4, { bendTo: E1 }], [204, B1, 'pluck', 0.75], [205, A1, 'pluck', 0.75],
      [206, G1, 'pluck', 0.5], [206.5, G1, 'pluck', 0.5], [207, A1, 'pluck', 0.5], [207.5, B1, 'pluck', 0.5, { hard: 1 }],
      // bar 14: the call starts... and is cut off by the snap at 212
      [208, E1, 'slap', 1.75, SBIG], [210, E1, 'ghost', 0.6], [211, E1, 'pluck', 1, { pop: 2 }],
    ],
    regions: [
      { step: 0, mode: 'pitched' },
      { step: 12, mode: 'slack', snap: true, to: 0.25, k: 6, crackAmp: 0.9, detail: 'the cable lets go' },
      { step: 16, mode: 'pitched' },
      { step: 64, mode: 'slack', snap: true, to: 0.375, k: 6, detail: 'slack: dotted-eighth round trip (3 against 4)' },
      { step: 80, mode: 'wind', midi: E1 },
      { step: 88, mode: 'bowed', detail: 'bowed talk' },
      { step: 92, mode: 'pitched' },
      { step: 137, mode: 'silent', to: 0.375, glide: 0.6, detail: 'held silent, slackening' },
      { step: 152, mode: 'wind', midi: E1 },
      { step: 160, mode: 'pitched' },
      { step: 212, mode: 'slack', snap: true, to: 0.5, k: 6, gain: [0.93, 0.82], detail: 'the final snap: quarter-note reflections' },
    ],
    strikes: [
      { step: 64, kind: 'pluck', hard: 1, amp: 1.1, pos: 0.13 }, { step: 76, kind: 'pluck', hard: 0.8, amp: 0.8, pos: 0.13 },
      { step: 80, kind: 'slap', hard: 1, amp: 1.2, pos: 0.1, stretch: 0 }, { step: 152, kind: 'slap', hard: 1, amp: 1.2, pos: 0.1, stretch: 0 },
    ],
    grabs: [{ from: 79.6, to: 79.98 }, { from: 136.5, to: 151.95 }, { from: 223.4, to: 226 }],
    talks: [{ from: 88, to: 92, per: 3 }],
  },
  partner: {
    events: [{ step: 12, kind: 'crack', amp: 0.6 }, { step: 64, kind: 'crack', amp: 0.9 }, { step: 212, kind: 'crack', amp: 0.9 }],
    gain: [[0, 0.6], [12, 0.6], [12.1, 0.84], [15.5, 0.84], [16, 0.5], [64, 0.5], [64.1, 0.84], [79, 0.84], [80, 0.5], [212, 0.5], [212.1, 0.84], [222, 0.82], [224, 0.3]],
  },
  beast: {
    phrases: [
      { name: 'answer 1: the hook, imitated', anger: 0.3, cells: [{ step: 52, len: 2, syl: 'WOM', midi: E1 }, { step: 54, len: 1, syl: 'ka', midi: E1 }, { step: 55, len: 2, syl: 'YOI', midi: E2 }, { step: 58, len: 2, syl: 'OW', midi: G1 }] },
      { name: 'answer 2', anger: 0.4, cells: [{ step: 104, len: 2, syl: 'wa', midi: E1 }, { step: 106, len: 2, syl: 'wa', midi: G1 }, { step: 108, len: 3, syl: 'YOW', midi: F1, toMidi: E1 }] },
      { name: 'answer 3: angry', anger: 0.85, cells: [{ step: 120, len: third, syl: 'ya', midi: E1 }, { step: 120 + third, len: third, syl: 'ya', midi: E1 }, { step: 120 + 2 * third, len: third, syl: 'ya', midi: G1 }, { step: 124, len: 4, syl: 'EEYOOW', midi: E2, toMidi: E1, dive: true }] },
      { name: 'solo: the hook, sung', anger: 0.2, cells: [{ step: 140, len: 2, syl: 'WOM', midi: E1 }, { step: 142, len: 1, syl: 'ka', midi: E1 }, { step: 143, len: 2.5, syl: 'YOI', midi: E2 }, { step: 146, len: 3, syl: 'OW', midi: G1, toMidi: E1 }] },
      { name: 'payoff: hocket with the cable', anger: 0.6, cells: [{ step: 162, len: 1, syl: 'ka', midi: E1 }, { step: 166, len: 2, syl: 'OW', midi: G1 }, { step: 170, len: 2, syl: 'YOW', midi: F1, toMidi: E1 }] },
      { name: 'payoff: dive', anger: 0.9, cells: [{ step: 185, len: 3, syl: 'EEYOOW', midi: E2, toMidi: E1, dive: true }] },
      { name: 'payoff: unison with the cable', anger: 0.7, cells: [{ step: 192, len: 2, syl: 'WOM', midi: E1 }, { step: 194, len: 1, syl: 'ka', midi: E1 }, { step: 195, len: 2, syl: 'YOI', midi: E2 }, { step: 198, len: 2, syl: 'OW', midi: G1 }, { step: 202, len: 2, syl: 'YOW', midi: F1, toMidi: E1 }] },
      { name: 'ending: the hook, cut off', anger: 0.7, cells: [{ step: 208, len: 2, syl: 'WOM', midi: E1 }, { step: 210, len: 1, syl: 'ka', midi: E1 }, { step: 211, len: 1, syl: 'YOI', midi: E2 }] },
    ],
    winds: [{ from: 152, to: 160, midi: E1, restPeriod: 0.25 }],
    gasps: [212.5],
    glitches: [{ step: 127, repeats: 3 }],
  },
  drums: {
    kicks: [
      [0, 1], [16, 0.9], [21, 0.8], [24, 0.9], [32, 1], [37, 0.85], [46, 0.85], [48, 1], [53, 0.85],
      [64, 1, 'b'], [71, 0.6, 'g'], [74, 0.9, 'b'], [88, 0.9, 'b'], [92, 0.7, 'g'],
      [96, 1], [101, 0.85], [112, 1], [117, 0.85], [128, 1], [133, 0.85],
      [160, 1], [165, 0.85], [174, 0.85], [176, 1], [181, 0.85], [190, 0.85], [192, 1], [197, 0.85], [206, 0.85], [208, 1],
    ],
    snares: [
      [40, 1], [56, 1],
      [68, 1, 'b'], [76, 0.95, 'b'], [66, 0.18, 'g'], [70, 0.22, 'g'], [73, 0.2, 'g'], [75, 0.15, 'g'], [78, 0.25, 'g'], [79, 0.3, 'g'],
      [90, 0.3, 'g'], [91, 0.35, 'g'], [92, 0.12, 'g'], [92.5, 0.15, 'g'], [93, 0.19, 'g'], [93.5, 0.24, 'g'],
      [136, 1],
      [168, 1], [171, 0.2, 'g'], [175, 0.25, 'g'], [184, 1], [187, 0.2, 'g'], [200, 1],
      [204, 0.15, 'g'], [204.5, 0.18, 'g'], [205, 0.22, 'g'], [205.5, 0.26, 'g'], [206, 0.3, 'g'], [206.5, 0.35, 'g'], [207, 0.4, 'g'], [207.5, 0.45, 'g'],
      [212, 1.1, 'big'],
    ],
    springs: [[168, 0.25], [184, 0.25], [200, 0.25]],
    ticks: [
      { from: 8, to: 16, every: 2, base: 0.3 },
      { from: 16, to: 32, every: 1, base: 0.18, accent: 'eighths', amt: 0.2 },
      { from: 64, to: 80, every: 1, accent: 'cable' },
      { from: 96, to: 128, every: 2, base: 0.25 },
      { from: 160, to: 208, every: 1, base: 0.15, accent: 'five', amt: 0.45 },
    ],
    toms: [[164, 52], [167, 50], [171, 48], [177, 47], [180, 45], [186, 43], [187, 41]],
    clanks: [[88, 0.7], [160, 0.6]],
    bells: [[78, 0.35]],
  },
  ratchets: [
    { from: 80, to: 89, capture: 'ks', gain: [[80, 1], [87, 0.7], [88, 0.5], [89, 0]] },
    { from: 152, to: 161, capture: 'ks', gain: [[152, 1], [159, 0.7], [160, 0.5], [161, 0]] },
    { from: 212, to: 216, capture: 'crack', gain: [[212, 0.85], [216, 0.85]] },
  ],
  holes: [{ from: 136.55, to: 140, label: 'CHOKE' }],
  mix: {},
};
