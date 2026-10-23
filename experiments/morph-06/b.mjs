// CABLE//BEAST, Experiment B: THE OVERLOAD. Experiment A (the 125 ms gasp) with only the final
// four seconds (24.0-28.0 s, steps 192-224) redesigned: the hook in unison, then the machine
// gets excited (hook in 32nds, in 8ths, in 16th quintuplets), the cable is wound past its note
// while the drums ratchet up with it, and at 27.600 s everything is cut to digital silence.
// The snap that ended V3 never comes.
import { withGasp } from './a.mjs';
import { score as v3 } from '../morph-05/v3.mjs';

export const E1 = 28, F1 = 29, G1 = 31, A1 = 33, B1 = 35, E2 = 40, F2 = 41, G2 = 43, A2 = 45, B2 = 47, C3 = 48, D3 = 50, E3 = 52, F3 = 53, G3 = 55, A3 = 57;
export const CUT = 27.6, CUT_STEP = CUT / 0.125; // 220.8: just after the "e" of beat 4, mid-gesture

/** Replace everything from step 192 on with the overload ending. */
export function withOverload(base, name) {
  const s = structuredClone(base);
  s.name = name;
  const keep = list => list.filter(x => (Array.isArray(x) ? x[0] : x.step) < 192);
  const S = { amp: 1.5, stretch: 0.3 }, SBIG = { amp: 1.7, stretch: 0.45 }, SLIGHT = { amp: 1.2, stretch: 0.18 };

  // ---- the cable: the hook in unison (as V3), then its slap+pop pair in 32nds climbing E-G-A-B,
  // the hook's head again, then in 8ths climbing, then wound past its note (overwind to E3)
  s.cable.notes = [...keep(s.cable.notes),
    [192, E1, 'slap', 1.75, S], [194, E1, 'ghost', 0.6], [195, E1, 'pluck', 1.25, { pop: 2 }], [198, G1, 'pluck', 1.5, { vowel: 'ow' }],
    [201, E1, 'slap', 1, SLIGHT], [202, F1, 'pluck', 1.4, { bendTo: E1 }],
    [204, E1, 'slap', 0.5, { amp: 1.3, stretch: 0.25 }], [204.5, E1, 'pluck', 0.5, { pop: 2, hard: 1 }],
    [205, G1, 'slap', 0.5, { amp: 1.3, stretch: 0.25 }], [205.5, G1, 'pluck', 0.5, { pop: 2, hard: 1 }],
    [206, A1, 'slap', 0.5, { amp: 1.4, stretch: 0.3 }], [206.5, A1, 'pluck', 0.5, { pop: 2, hard: 1 }],
    [207, B1, 'slap', 0.5, { amp: 1.5, stretch: 0.3 }], [207.5, B1, 'pluck', 0.5, { pop: 3, hard: 1 }],
    [208, E1, 'slap', 1.75, SBIG], [210, E1, 'ghost', 0.6], [211, E1, 'pluck', 1, { pop: 2 }],
    [212, E1, 'slap', 0.9, { amp: 1.6, stretch: 0.45 }], [213, E1, 'pluck', 0.9, { pop: 2, hard: 1 }],
    [214, G1, 'slap', 0.9, { amp: 1.6, stretch: 0.4 }], [215, G1, 'pluck', 0.9, { pop: 3, hard: 1 }],
  ];
  s.cable.regions = [...s.cable.regions.filter(r => r.step < 192), { step: 192, mode: 'pitched' },
    { step: 216, mode: 'overwind', midi: E3, strikeAmp: [0.3, 0.7], detail: 'wound past its note' },
    { step: CUT_STEP, mode: 'silent', detail: 'cut' }];
  s.cable.strikes = [...s.cable.strikes.filter(x => x.step < 192), { step: 216, kind: 'slap', hard: 1, amp: 1.4, pos: 0.1, stretch: 0.2 }];
  s.cable.grabs = [...s.cable.grabs.filter(g => g.from < 192), { from: CUT_STEP, to: 226 }];

  // ---- the second cable: metallic chirps from the right, more and more often
  s.partner.events = [...keep(s.partner.events), { step: 204, kind: 'crack', amp: 0.7 }, { step: 212, kind: 'crack', amp: 0.8 },
    { step: 216, kind: 'crack', amp: 0.8 }, { step: 218, kind: 'crack', amp: 0.75 }, { step: 219.5, kind: 'crack', amp: 0.75 }];
  s.partner.gain = [...s.partner.gain.filter(([st]) => st < 192), [192, 0.84], [204, 0.5], [204.1, 0.86], [CUT_STEP, 0.86]];

  // ---- the Beast: unison hook (as V3), then answers that get faster and stranger: triplets and
  // chokes over the 32nd climb, the hook's head, a 16th hocket against the cable's 8ths,
  // quintuplet chokes climbing E2-B2, a scream to E3 that breaks (glitch) and is cut off
  const third = 4 / 3, q = 0.8;
  s.beast.phrases = [...s.beast.phrases.filter(p => p.cells[0].step < 192),
    { name: 'payoff: unison with the cable', anger: 0.7, cells: [{ step: 192, len: 2, syl: 'WOM', midi: E1 }, { step: 194, len: 1, syl: 'ka', midi: E1 }, { step: 195, len: 2, syl: 'YOI', midi: E2 }, { step: 198, len: 2, syl: 'OW', midi: G1 }, { step: 202, len: 2, syl: 'YOW', midi: F1, toMidi: E1 }] },
    { name: 'overload: climbing with the 32nds', anger: 0.85, cells: [{ step: 204, len: third, syl: 'ya', midi: E1 }, { step: 204 + third, len: third, syl: 'ya', midi: G1 }, { step: 204 + 2 * third, len: 0.67, syl: 'ka', midi: A1 }, { step: 207.33, len: 0.67, syl: 'ka', midi: B1 }] },
    { name: 'overload: the hook\'s head, hocket in 16ths', anger: 0.9, cells: [{ step: 208, len: 2, syl: 'WOM', midi: E1 }, { step: 210, len: 1, syl: 'ka', midi: E1 }, { step: 211, len: 1, syl: 'YOI', midi: E2 },
      { step: 212.5, len: 0.5, syl: 'ka', midi: E1 }, { step: 213.5, len: 0.5, syl: 'YOI', midi: E2 }, { step: 214.5, len: 0.5, syl: 'ka', midi: G1 }, { step: 215.5, len: 0.5, syl: 'YOI', midi: G2 }] },
    { name: 'overload: quintuplet chokes, then the scream', anger: 1, cells: [
      ...[E2, F2, G2, A2, B2].map((m, k) => ({ step: 216 + k * q, len: q, syl: k % 2 ? 'YOI' : 'ka', midi: m, sputter: k === 3 })),
      { step: 220, len: 0.8, syl: 'ya', midi: B2, toMidi: E3, glide: 0.06 }] },
  ];
  s.beast.gasps = (s.beast.gasps ?? []).filter(g => g < 192);
  s.beast.glitches = [...(s.beast.glitches ?? []).filter(g => g.step < 192), { step: 220.2, repeats: 3 }];

  // ---- drums: the groove's own parts, faster and faster
  const roll = (from, to, every, v0, v1, kind = 'g') => { const out = []; for (let st = from, k = 0, n = Math.round((to - from) / every); k < n; k++, st += every) out.push([+st.toFixed(3), +(v0 + (v1 - v0) * k / Math.max(1, n - 1)).toFixed(3), kind]); return out; };
  s.drums.kicks = [...keep(s.drums.kicks),
    [192, 1], [197, 0.85], [201, 0.8], [204, 0.9], [206, 0.9], // the groove, then 8ths under the 32nd climb
    [208, 1], [210, 0.7, 'b'], [214, 0.9], // 8ths; the big snare at 212 stands alone, as in V3
    [216, 0.7, 'b'], [217, 0.65, 'b'], [218, 0.7, 'b'], [218.5, 0.5, 'g'], [219, 0.7, 'b'], [219.5, 0.55, 'g'], [220, 0.75, 'b'], [220.5, 0.6, 'g']]; // quarters, 16ths, then 32nds, lighter as they multiply
  s.drums.snares = [...keep(s.drums.snares),
    [200, 1], [203, 0.3, 'g'], [203.5, 0.35, 'g'], ...roll(204, 208, 0.5, 0.25, 0.7), // V3's roll, harder
    [212, 1.1, 'big'], [214, 0.5, 'b'], [215, 0.6, 'b'], [215.5, 0.4, 'g'], // where V3 snapped: the big snare, no snap
    ...roll(216, 220.75, 0.5, 0.25, 0.45), [216, 0.45, 'b'], [218, 0.45, 'b'], [220, 0.5, 'b']]; // 32nd roll with break accents
  s.drums.springs = [...keep(s.drums.springs ?? []), [200, 0.25], [212, 0.4], [216, 0.35], [220, 0.5]];
  // ticks: V3's 16ths (and their 5-step accent phase) to 25.0 s, then 32nds
  s.drums.ticks = [...s.drums.ticks.filter(t => t.from < 192).map(t => ({ ...t, to: Math.min(t.to, 200) })),
    { from: 200, to: 208, every: 0.5, base: 0.18, accent: 'eighths', amt: 0.2 },
    { from: 208, to: CUT_STEP, every: 0.5, base: 0.2, accent: 'five', amt: 0.25 }];
  s.drums.toms = [...keep(s.drums.toms ?? []), [216, F2, 0.5], [216.5, G2, 0.55], [217, A2, 0.6], [217.5, B2, 0.6], [218, C3, 0.65], [218.5, D3, 0.7], [219, E3, 0.7], [219.5, F3, 0.75], [220, G3, 0.8], [220.5, A3, 0.8]]; // the payoff's walk-down, now walking up
  s.drums.bells = [...keep(s.drums.bells ?? []), [192.5, 0.4], [208.5, 0.4], [214, 0.3], [216, 0.3], [218, 0.33], [219, 0.35], [220, 0.4]];
  s.drums.clanks = [...keep(s.drums.clanks ?? []), [213, 0.4], [217.5, 0.4], [219.75, 0.45]];

  // ---- ratchet: the drums repeat once per round trip of the overwinding cable (a rising metallic buzz)
  s.ratchets = [...s.ratchets.filter(r => r.from < 192), { from: 216, to: CUT_STEP, capture: 'crack', gain: [[216, 0.4], [CUT_STEP, 0.8]] }];

  // ---- mix rides: the payoff rides continue into the overload, then the drums step back as they
  // multiply (more hits, not louder hits) and the over-winding cable steps forward
  const ride = (pts, v, late) => [...pts.filter(([st]) => st < 192), [192, v], [211.9, v], [212, 0], [216, late], [CUT_STEP, late]];
  s.automation = {
    ...s.automation,
    kick: ride(s.automation.kick, 1.5, -3), snare: ride(s.automation.snare, 2, -2), perc: ride(s.automation.perc, 2, 0), toms: ride(s.automation.toms, 2, 0),
    // the Beast keeps V3's level through the unison; its new overload phrases sing hotter than V3's,
    // so they ride lower (from the downbeat of the excitement), down to meet the over-winding cable
    beastMid: [...s.automation.beastMid.filter(([st]) => st < 192), [192, 3], [204, 3], [204.5, -1], [207, -1], [208, 1], [212, 0.5], [216, -6], [CUT_STEP, -7]],
    cable: [...s.automation.cable, [215.9, 0], [216.5, 3.5], [CUT_STEP, 3.5]],
  };

  // the whole overload sits 2 dB under where its parts would put it: the climax keeps rising inside
  // that, and the first 24 s stay closer to V3 once integrated loudness is matched
  s.mixTrim = [[0, 0], [208, 0], [212, -2], [CUT_STEP, -2]];
  s.silences = [...(s.silences ?? []), { from: CUT, to: 28, fadeOut: 0.004, label: 'CUT' }];
  s.sections = [...s.sections.filter(x => x.step < 192),
    { step: 192, name: 'Unison', detail: 'cable and Beast play the whole hook as one voice' },
    { step: 204, name: 'Excitement', detail: 'slap-pop pairs in 32nds climbing E-G-A-B; the Beast in triplets and chokes' },
    { step: 208, name: 'VII. The overload', detail: 'the hook\'s head, then in 8ths against a 16th Beast hocket' },
    { step: 216, name: 'Overwind', detail: 'cable wound past its note to E3; drums ratchet with it; quintuplet chokes; toms walk up' },
    { step: CUT_STEP, name: 'CUT', detail: 'digital silence to 28.000 s' }];
  return s;
}

export const CHANGES = [
  'Pre-payoff: Experiment A\'s 125 ms gasp (19.875-20.000 s), unchanged.',
  '24.0-25.5 s: the unison hook as in V3 (cable and Beast unchanged); from 25.0 s the ticks double to 32nds, a kick at 25.125 s and ghost snares at 25.375 and 25.4375 s lead into the climb.',
  '25.5-26.0 s: V3\'s 16th run becomes slap-pop pairs in 32nds climbing E-G-A-B; the Beast answers in triplets and chokes; the snare roll is harder; ticks go to 32nds; the second cable cracks on the right.',
  '26.0-26.5 s: the hook\'s head (slap, ghost, pop) with the Beast, as in V3.',
  '26.5-27.0 s: where V3 snapped, the big snare hits but the cable does not snap: the hook\'s head again in 8ths climbing E-G against a 16th Beast hocket (ka-YOI); kicks in 8ths.',
  '27.0-27.6 s: the cable is wound past its note (E1 to E3, re-struck every round trip, brighter and more dispersive), the drums ratchet with it into a rising metallic buzz, the Beast chokes in quintuplets climbing E2-B2 and screams toward E3 until its voice breaks (beat-repeat + crush at 27.525 s); kicks go from quarters to 16ths to 32nds (lighter as they multiply), a 32nd snare roll with break accents, toms walk up F2-A3, alarm bells and clanks; the drums ride down 2-3 dB, the Beast down to -6/-7 dB and the cable up 3.5 dB, so the over-winding cable and the Beast meet as equals at the climax.',
  'Level: the whole mix is trimmed 2 dB across 26.0-26.5 s and stays there to the cut, so the ending does not push the rest of the record down after loudness matching.',
  '27.600 s: everything (instruments, rooms, echo) fades out over 4 ms and is exactly zero to 28.000 s.',
];
export const score = withOverload(withGasp(v3, 125, 'CABLE//BEAST B'), 'CABLE//BEAST B: the overload');
