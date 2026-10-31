// LOWRIDER//2099 v2: the two candidates as DaemonV12 projects.
//   node arrange.mjs                 write crest.json and hover.json (final projects)
//   node arrange.mjs --prepass crest write crest.prepass.json (bars 1-6, no master processing), the
//                                    beat the Mouth Drop swallows; see build-mouth.mjs
// Steps are 16ths 0-15 (fractions allowed), bars are absolute. Swing: odd 16ths +40 ticks (58.3%).
import { writeFileSync } from 'node:fs';
import { line, hits, hookLead, hook808 } from '../../../../experiments/lowrider-2099/score.mjs';

const DIR = new URL('./', import.meta.url).pathname;
const SW = 40;
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
const kit = name => ({ type: 'drumkit', kit: `assets/${name}/kit.json` });

// ---------- shared figures ----------
/** The hook's lead, with the octave whoop (C5 -> C6 over a 16th) on its first bar. */
const leadHook = (bar, whoop = true) => hookLead(bar).map((nt, k) => (k === 0 && whoop ? { ...nt, scoop: 12, scoopLen: 1 } : nt));
const leadBar = (bar, which, whoop = true) => leadHook(which === 1 ? bar : bar - 1, whoop).filter(nt => nt.bar === bar);
const hook808bar = (bar, which) => hook808(which === 1 ? bar : bar - 1).filter(nt => nt.bar === bar);
const k = (bar, steps, v = 0.88) => steps.map(s => ({ bar, step: s, pitch: 'kick', vel: s === 0 ? 1 : v }));
const clapSnap = (bar, steps = [4, 12]) => steps.flatMap(s => [{ bar, step: s, pitch: 'clap', vel: 0.95 }, { bar, step: s, pitch: 'snap', vel: 0.5 }]);
const snareClap = (bar, steps, v = 0.92) => steps.flatMap(s => [{ bar, step: s, pitch: 'snare', vel: v }, { bar, step: s, pitch: 'clap', vel: v * 0.8 }]);
const bounceHats = (bar, { open = false, upTo = 16 } = {}) => [
  ...[0, 2, 4, 6, 8, 10, 12, 14].filter(s => s < upTo && !(open && s === 14)).map(s => ({ bar, step: s, pitch: 'hat', vel: s % 4 === 2 ? 0.72 : 0.5, chokeGroup: 'hats' })),
  ...[3, 11].filter(s => s < upTo).map(s => ({ bar, step: s, pitch: 'hat-tick', vel: 0.34, chokeGroup: 'hats' })),
  ...(open ? [{ bar, step: 14, pitch: 'hat-open', vel: 0.58, chokeGroup: 'hats' }] : []),
];
const hats16 = (bar, from = 0, upTo = 16) => range(from, upTo - 1).map(s => ({ bar, step: s, pitch: 'hat', vel: [0.74, 0.38, 0.55, 0.42][s % 4], chokeGroup: 'hats' }));
/** Rolls climb in pitch: playbackRate rises from 1 to r1 across the roll. */
const roll = (bar, from, to, every, v0, v1, r1 = 1, pitch = 'hat-tick') => {
  const out = [], m = Math.round((to - from) / every);
  for (let i = 0; i < m; i++) out.push({ bar, step: +(from + i * every).toFixed(4), pitch, vel: +(v0 + (v1 - v0) * i / Math.max(1, m - 1)).toFixed(3), playbackRate: +(1 + (r1 - 1) * i / Math.max(1, m - 1)).toFixed(4), chokeGroup: 'hats' });
  return out;
};
const shakerBar = (bar, v = 1) => range(0, 15).map(s => ({ bar, step: s, pitch: s % 2 ? 'shaker-pull' : 'shaker', vel: +([0.5, 0.3, 0.75, 0.35][s % 4] * v).toFixed(3) }));
const keysPair = bar => [
  { bar, step: 0, pitch: 'fm9', vel: 0.7, gate: '3/8', envelope: { releaseSeconds: 0.3 } },
  { bar: bar + 1, step: 0, pitch: 'dbmaj9', vel: 0.7, gate: '5/8', envelope: { releaseSeconds: 0.2 } },
  { bar: bar + 1, step: 12, pitch: 'c7b9', vel: 0.65, gate: '1/4', envelope: { releaseSeconds: 0.1 } },
];
// takeover 808: calls on beats 1-2.5 (dive-in from a fifth below, octave drop), rests for the answer
const call808odd = bar => [
  { bar, step: 0, pitch: 'F1', len: 3, vel: 1, scoop: 7, scoopLen: 0.5 },
  { bar, step: 3, pitch: 'F2', len: 2, vel: 0.85, fall: { at: 1, to: -12, over: 1 } },
  { bar, step: 6, pitch: 'F1', len: 3.5, vel: 0.95 },
];
const call808even = bar => [
  { bar, step: 0, pitch: 'Db2', len: 3, vel: 1 }, { bar, step: 3, pitch: 'Db2', len: 1, vel: 0.8 },
  { bar, step: 4, pitch: 'Ab1', len: 2, vel: 0.85 },
  { bar, step: 6, pitch: 'C2', len: 3.5, vel: 0.95, fall: { at: 2, to: -12, over: 1.5 } },
];
const answer = (bar, name, step = 9.5) => ({ bar, step, pitch: name, vel: 0.95 }); // Beast files start a 32nd early (the inhale)

// ---------- mix (track order is the stem order) ----------
const MIX = {
  kick: [{ gainDb: -3 }, [{ type: 'highpass', frequencyHz: 38 }]],
  'bass-808': [{ gainDb: -2.5 }, [{ type: 'highpass', frequencyHz: 26 }]],
  clap: [{ gainDb: -3 }, [{ type: 'highpass', frequencyHz: 170 }]],
  snare: [{ gainDb: -4 }, [{ type: 'highpass', frequencyHz: 150 }, { type: 'reverb', roomSize: 0.25, decaySeconds: 0.5, wet: 0.08 }]],
  hats: [{ gainDb: -1 }, [{ type: 'highpass', frequencyHz: 5000 }]],
  shaker: [{ gainDb: -7, pan: 0.35 }, [{ type: 'highpass', frequencyHz: 4000 }]],
  rim: [{ gainDb: -5, pan: -0.5 }, [{ type: 'highpass', frequencyHz: 500 }, { type: 'reverb', roomSize: 0.3, decaySeconds: 0.6, wet: 0.15 }]],
  lead: [{ gainDb: -9.5 }, [{ type: 'highpass', frequencyHz: 280 }, { type: 'delay', timeMs: 468.75, wet: 0.14 }, { type: 'reverb', roomSize: 0.55, decaySeconds: 1.6, wet: 0.16 }]],
  talkbox: [{ gainDb: -1, pan: 0.12 }, [{ type: 'highpass', frequencyHz: 190 }, { type: 'compressor', thresholdDb: -20, ratio: 3, attackMs: 5, releaseMs: 80, makeupGainDb: 2 }, { type: 'reverb', roomSize: 0.45, decaySeconds: 1.3, wet: 0.12 }]],
  beast: [{ gainDb: 0 }, [{ type: 'highpass', frequencyHz: 28 }, { type: 'compressor', thresholdDb: -16, ratio: 3, attackMs: 3, releaseMs: 90, makeupGainDb: 1 }]],
  keys: [{ gainDb: -13 }, [{ type: 'highpass', frequencyHz: 220 }, { type: 'reverb', roomSize: 0.6, decaySeconds: 2, wet: 0.3 }]],
  fx: [{ gainDb: -5 }, [{ type: 'highpass', frequencyHz: 25 }]],
  mouth: [{ gainDb: 4 }, [{ type: 'highpass', frequencyHz: 26 }]], // the prepass master's -6 dB back, less 2 dB headroom
};
const KITS = { kick: 'drums', 'bass-808': '808x', clap: 'drums', snare: 'drums', hats: 'drums', shaker: 'drums', rim: 'drums', lead: 'lead', talkbox: 'voice', beast: 'voice', keys: 'keys', fx: 'fx', mouth: 'mouth' };
// no limiter or soft clip here: the engine renders a clean pre-master; master.mjs masters it
const MASTER = { gainDb: -5, effects: [
  { type: 'highpass', frequencyHz: 28 },
  { type: 'compressor', thresholdDb: -14, ratio: 2, attackMs: 30, releaseMs: 160, makeupGainDb: 0 },
] };

function project(id, title, description, bars, parts, { master = MASTER, mixOverride = {} } = {}) {
  const tracks = Object.keys(MIX).filter(t => parts[t]?.length).map(t => {
    const [mix, effects] = mixOverride[t] ?? MIX[t];
    return { id: t, description: parts[`${t}:about`] ?? t, instrument: kit(KITS[t]), mix, effects, clips: [{ bar: 1, pattern: 'main' }], patterns: [{ id: 'main', bars, notes: parts[t] }] };
  });
  return { formatVersion: 1, title, description, bpm: 96, timeSignature: '4/4', key: 'F minor', bars, seed: 2099, render: { duration: { bars }, tail: 'none' }, master, tracks };
}

// ======================================================================================
// CREST: A's bounce, the Mouth Drop, a swung takeover. Rapper pockets in 3-4 and 9-10.
// ======================================================================================
function crestParts(upToBar = 10) {
  const sw = { swing: SW };
  const P = {
    kick: hits([...k(1, [0, 3, 6, 10]), ...k(2, [0, 7, 10]), ...k(3, [0, 7, 10, 13]), ...k(4, [0, 7, 10]), ...k(5, [0, 3, 6, 10]), ...k(6, [0, 7, 10]),
      ...k(7, [0, 7, 10]), ...k(8, [0, 3, 6, 10, 14]), ...k(9, [0, 7, 10, 13]), ...k(10, [0, 3, 6, 10])], sw),
    'bass-808': line([
      { bar: 1, step: 0, pitch: 'F1', len: 2.5, vel: 1 }, { bar: 1, step: 3, pitch: 'F2', len: 1.5, vel: 0.85 }, { bar: 1, step: 6, pitch: 'F1', len: 3.5, vel: 0.95 },
      { bar: 1, step: 10, pitch: 'F1', len: 3.5, vel: 0.9 }, { bar: 1, step: 14, pitch: 'Ab1', len: 2, vel: 0.85 },
      ...hook808bar(2, 2),
      { bar: 3, step: 0, pitch: 'F1', len: 5.5, vel: 0.95 }, { bar: 3, step: 7, pitch: 'F2', len: 1.5, vel: 0.8 }, { bar: 3, step: 10, pitch: 'F1', len: 2, vel: 0.9 },
      { bar: 3, step: 12, pitch: 'Ab1', len: 2, vel: 0.85 }, { bar: 3, step: 14, pitch: 'Bb1', len: 2, vel: 0.85 },
      ...hook808bar(4, 2),
      { bar: 5, step: 0, pitch: 'F1', len: 2.5, vel: 1 }, { bar: 5, step: 3, pitch: 'F2', len: 1.5, vel: 0.85 }, { bar: 5, step: 6, pitch: 'F1', len: 3.5, vel: 0.95 },
      { bar: 5, step: 10, pitch: 'F1', len: 3.5, vel: 0.9 }, { bar: 5, step: 14, pitch: 'Ab1', len: 2, vel: 0.85 },
      ...hook808bar(6, 2),
      ...call808odd(7), ...call808even(8), ...call808odd(9), ...call808even(10),
    ], { ...sw, release: 0.02, attack: 0.004 }),
    clap: hits([...range(1, 6).flatMap(b => clapSnap(b)), { bar: 4, step: 15, pitch: 'clap', vel: 0.42 }, ...range(7, 10).flatMap(b => [4, 12].map(s => ({ bar: b, step: s, pitch: 'clap', vel: 0.8 })))], sw),
    snare: hits(range(7, 10).flatMap(b => [4, 12].map(s => ({ bar: b, step: s, pitch: 'snare', vel: 0.92 })).concat(b === 8 ? [{ bar: 8, step: 15, pitch: 'snare', vel: 0.35 }] : [])), sw),
    hats: hits([...range(1, 6).flatMap(b => bounceHats(b, { open: b % 2 === 0 })),
      ...hats16(7), ...hats16(8), ...hats16(9), ...hats16(10, 0, 12), ...roll(10, 12, 16, 0.5, 0.4, 0.85, 1.25)], sw),
    shaker: hits([...range(1, 6).flatMap(b => shakerBar(b)), ...range(7, 10).flatMap(b => shakerBar(b, 0.7))], sw),
    rim: hits([3, 4, 9, 10].flatMap(b => [6, 15].map(s => ({ bar: b, step: s, pitch: 'rim', vel: s === 6 ? 0.6 : 0.45 }))), sw),
    lead: line([...leadBar(1, 1), ...leadBar(2, 2), ...leadBar(5, 1), ...leadBar(6, 2), ...leadBar(7, 1), ...leadBar(8, 2)], sw),
    talkbox: hits([{ bar: 1, step: 10, pitch: 'ooh-wee', vel: 0.9 }, { bar: 2, step: 10, pitch: 'yeah-shrink', vel: 0.9 },
      { bar: 4, step: 12, pitch: 'wa-stutter', vel: 0.85 }, { bar: 5, step: 10, pitch: 'ooh-wee', vel: 0.9 }, { bar: 6, step: 10, pitch: 'yeah-shrink', vel: 0.9 }]),
    beast: hits([answer(7, 'beast-wom'), { bar: 8, step: 10, pitch: 'talk-waah-ow', vel: 0.95 }, answer(9, 'beast-wa-wa'), answer(10, 'beast-dive')]),
    keys: hits([1, 3, 5].flatMap(keysPair)),
    fx: hits([{ bar: 4, step: 13.25, pitch: 'hop', vel: 0.8 }, { bar: 7, step: 0, pitch: 'slam', vel: 0.95 }, { bar: 10, step: 13.25, pitch: 'hop', vel: 0.85 }]),
    mouth: upToBar >= 7 ? hits([{ bar: 6, step: 0, pitch: 'swallow', vel: 1 }]) : [],
    'lead:about': 'Whine lead: the call. Octave whoop on each hook head',
    'talkbox:about': 'Talkbox (MORPH//03 vocal tract): ooh-WEE, the shrink, a wa-wa fill',
    'beast:about': 'Takeover answers: the Wobble Beast and the talking 808',
    'mouth:about': 'THE MOUTH DROP: bar 6 of this beat, swallowed by the vocal tract (build-mouth.mjs)',
  };
  // final: bar 6 belongs to the mouth, so every other part rests there. Prepass: only bar 6's own
  // notes (bar 5's tails already play dry in the final; swallowing them too would double them)
  for (const t of Object.keys(P)) if (Array.isArray(P[t]) && t !== 'mouth') {
    P[t] = P[t].filter(nt => { const bar = +nt.start.split(':')[0]; return upToBar >= 7 ? bar !== 6 : bar === 6; });
  }
  return P;
}

// ======================================================================================
// HOVER: takeover from 0:00, the hover spin-up, a hydraulic slam into a half-time bounce.
// ======================================================================================
function hoverParts() {
  const sw = { swing: SW };
  // straight half (bars 1-6) and swung half-time half (bars 7-10) are written separately
  const straight = {
    kick: hits([...k(1, [0, 6, 10]), ...k(2, [0, 3, 6, 11, 14]), ...k(3, [0, 6, 10]), ...k(4, [0, 3, 6, 11, 14]), ...k(5, [0])]),
    'bass-808': line([...call808odd(1), ...call808even(2), ...call808odd(3), ...call808even(4),
      { bar: 5, step: 0, pitch: 'F1', len: 8, vel: 1, scoop: 7, scoopLen: 0.5, fall: { at: 4, to: -12, over: 4 } }], { release: 0.02, attack: 0.004 }),
    clap: hits(range(1, 4).flatMap(b => [4, 12].map(s => ({ bar: b, step: s, pitch: 'clap', vel: 0.75 })))),
    snare: hits([...range(1, 5).flatMap(b => [4, 12].map(s => ({ bar: b, step: s, pitch: 'snare', vel: 0.92 }))),
      // bar 6: the build, 8ths -> 16ths -> 32nds, then an eighth of nothing before the slam
      ...roll(6, 0, 8, 2, 0.3, 0.45, 1, 'snare'), ...roll(6, 8, 12, 1, 0.5, 0.7, 1.06, 'snare'), ...roll(6, 12, 14, 0.5, 0.72, 0.95, 1.12, 'snare')]),
    hats: hits([...hats16(1), ...hats16(2, 0, 14), ...roll(2, 14, 16, 0.5, 0.4, 0.85, 1.25),
      ...hats16(3), ...hats16(4, 0, 12), ...roll(4, 12, 16, 2 / 3, 0.35, 0.9, 1.5),
      ...[0, 2, 4, 6, 8, 10, 12, 14].map(s => ({ bar: 5, step: s, pitch: 'hat', vel: 0.5, chokeGroup: 'hats' }))]),
    lead: line([...leadBar(1, 1), ...leadBar(2, 2), ...leadBar(5, 1)]),
    talkbox: hits([{ bar: 1, step: 10, pitch: 'ooh-wee', vel: 0.9 }, { bar: 2, step: 10, pitch: 'yeah-shrink', vel: 0.9 }, { bar: 5, step: 10, pitch: 'ooh-wee', vel: 0.85 }]),
    beast: hits([answer(3, 'beast-wom'), answer(4, 'beast-dive')]),
    // the spin-up is cut at the gasp (two bars minus an eighth), leaving the eighth of silence before the slam
    fx: hits([{ bar: 5, step: 0, pitch: 'hover', vel: 0.9, gate: '15/8', envelope: { attackSeconds: 0.002, releaseSeconds: 0.015 } }, { bar: 6, step: 15.23, pitch: 'hop', vel: 0.8 }]),
  };
  // the drop: half time (snare on beat 3), A's swing back, long sliding 808, keys return
  const halfKick = b => k(b, b % 2 ? [0, 7, 10, 13] : [0, 3, 10, 14]);
  const swung = {
    kick: hits(range(7, 10).flatMap(halfKick), sw),
    'bass-808': line([
      { bar: 7, step: 8, pitch: 'F1', len: 3, vel: 0.95 }, { bar: 7, step: 11, pitch: 'Ab1', len: 2.5, vel: 0.9, scoop: 3, scoopLen: 0.5 }, { bar: 7, step: 14, pitch: 'F1', len: 2, vel: 0.85 },
      { bar: 8, step: 0, pitch: 'Db2', len: 6, vel: 1, scoop: 5, scoopLen: 1 }, { bar: 8, step: 7, pitch: 'Db2', len: 1.5, vel: 0.8 },
      { bar: 8, step: 10, pitch: 'C2', len: 6, vel: 0.95, fall: { at: 3, to: -7, over: 3 } },
      { bar: 9, step: 0, pitch: 'F1', len: 5.5, vel: 1 }, { bar: 9, step: 7, pitch: 'F2', len: 1.5, vel: 0.85 }, { bar: 9, step: 10, pitch: 'F1', len: 2, vel: 0.9 },
      { bar: 9, step: 12, pitch: 'Ab1', len: 2, vel: 0.85 }, { bar: 9, step: 14, pitch: 'Bb1', len: 2, vel: 0.85 },
      { bar: 10, step: 0, pitch: 'Db2', len: 5.5, vel: 1 }, { bar: 10, step: 6, pitch: 'C2', len: 4, vel: 0.9 },
      { bar: 10, step: 10, pitch: 'C2', len: 6, vel: 0.95, fall: { at: 0.5, to: -12, over: 5.5 } }, // the tape-stop dive into the loop
    ], { ...sw, release: 0.02, attack: 0.004 }),
    clap: hits(range(7, 10).flatMap(b => [{ bar: b, step: 8, pitch: 'clap', vel: 0.9 }, { bar: b, step: 8, pitch: 'snap', vel: 0.5 }]), sw),
    snare: hits([...range(7, 10).map(b => ({ bar: b, step: 8, pitch: 'snare', vel: 0.95 })), { bar: 8, step: 15, pitch: 'snare', vel: 0.32 }, { bar: 9, step: 13, pitch: 'snare', vel: 0.28 }], sw),
    hats: hits([...range(7, 9).flatMap(b => bounceHats(b, { open: b === 8 })), ...roll(8, 12, 14, 1 / 3, 0.3, 0.7, 1.3), ...bounceHats(10, { upTo: 10 })], sw),
    shaker: hits(range(7, 10).flatMap(b => shakerBar(b)), sw),
    rim: hits([9, 10].flatMap(b => [6, 15].filter(s => b < 10 || s < 10).map(s => ({ bar: b, step: s, pitch: 'rim', vel: s === 6 ? 0.6 : 0.45 }))), sw),
    lead: line([...leadBar(7, 1), ...leadBar(8, 2)], sw),
    beast: hits([{ bar: 7, step: 0, pitch: 'talk-drop', vel: 1 }, answer(9, 'beast-wa-wa'), answer(10, 'beast-dive')]),
    keys: hits([7, 9].flatMap(keysPair)),
    fx: hits([{ bar: 7, step: 0, pitch: 'slam', vel: 1 }]),
  };
  const P = {};
  for (const t of Object.keys(MIX)) P[t] = [...(straight[t] ?? []), ...(swung[t] ?? [])];
  // hats chokes and the half-time roll overlap step 12-14 of bar 8 with the bounce figure: drop those
  P.hats = P.hats.filter(h => !(h.start.startsWith('8:4') && h.pitch === 'hat'));
  Object.assign(P, {
    'lead:about': 'Whine lead: the call, octave whoop; out for the Beast and for the second half of the drop',
    'beast:about': 'Wobble Beast answers and the talking-808 drop',
    'fx:about': 'Hover spin-up (Beast cable, pulses to pitch over bars 5-6), hydraulic pssht, the slam',
  });
  return P;
}

const write = (name, p) => writeFileSync(DIR + name, JSON.stringify(p, null, 2) + '\n');
if (process.argv[2] === '--prepass') {
  if (process.argv[3] !== 'crest') throw new Error('only crest has a prepass');
  write('crest.prepass.json', project('crest', 'LOWRIDER//2099 v2 CREST prepass', 'Bars 1-6 of CREST with no master processing: the beat the Mouth Drop swallows (bar 6).', 6, crestParts(6), { master: { gainDb: -6 } }));
  console.log('wrote crest.prepass.json');
} else {
  write('crest.json', project('crest', 'LOWRIDER//2099 v2 CREST',
    'Candidate 1. A\'s West Coast bounce with a stronger hook (octave whoop, band tresillo hits), a verse pocket, then THE MOUTH DROP: bar 6 of the beat is fed through the MORPH//03 vocal tract, which swallows it (ah - oo - mm) and inhales, into a swung takeover where a distorted 808 calls and the Wobble Beast and a talking 808 answer. 10 bars, 96 BPM, F minor.', 10, crestParts(10)));
  write('hover.json', project('hover', 'LOWRIDER//2099 v2 HOVER',
    'Candidate 2. B\'s takeover from 0:00 (hook over dirty 808 and hard drums, Beast answers), then the hover spin-up: the Beast cable winds from countable pulses into F3 over two bars under a snare build, a hydraulic pssht and a gasp, and a slam into a half-time version of A\'s swung bounce with a talking 808 WOOOW, ending in a tape-stop dive. 10 bars, 96 BPM, F minor.', 10, hoverParts()));
  console.log('wrote crest.json, hover.json');
}
