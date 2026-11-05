// Full arrangement builder. Usage: node compose.mjs v1 [v2 ...]  -> writes cue-vN.json
// Form (140 BPM, 4/4, bar = 1.714 s): I exposure 1-2 | II pedal groove 3-6 | III suspension 7-8 |
// IV arrival 9-12 | V final statement 13-14 | VI cadence + bell echo 15-16 (container 28 s).
import { N, T, SRC, project, write } from './score-lib.mjs';

const BARS = 16;
const at = (bar, s = 0) => (bar - 1) * 16 + s; // bar is 1-based, s = sixteenth inside the bar
const KIT = { crack: 38, clap: 39, tick: 42, open: 46 };
const K = (name, i, o = {}) => ({ ...N('crack', i, null, o), pitch: KIT[name] });

export function build(o = {}) {
  const lead = [], signal = [], sighi = [], chrome = [], specter = [], horizon = [], afterglow = [], abyss = [], reactor = [], kick = [], iron = [], drums = [], ascension = [], convergence = [];
  const P = (bar, s, p, g, v, x = {}) => lead.push(N('phantom', at(bar, s), p, { g, v, a: 0.005, r: 0.12, ...x }));
  // ---- HOOK: tresillo call on B4, leap up, falling answer. Leap grows: m6, m6, m7, (withheld), octave, m6, octave->cadence.
  const call = (bar, v) => { P(bar, 0, 'B4', 5, v); P(bar, 6, 'B4', 5, v - 0.03); P(bar, 12, 'B4', 3, v + 0.03); };
  call(1, 0.72); P(2, 0, 'G5', 11, 0.86); P(2, 12, 'F#5', 4, 0.78);
  call(3, 0.76); P(4, 0, 'G5', 11, 0.9); P(4, 12, 'F#5', 4, 0.82);
  call(5, 0.78); P(6, 0, 'A5', 7, 0.92); P(6, 8, 'G5', 4, 0.84); P(6, 12, 'F#5', 4, 0.84);
  call(7, 0.8); // leap withheld: bar 8 lead is silent
  P(9, 0, 'B5', 11, 0.97); P(9, 12, 'A5', 4, 0.86); P(10, 0, 'G5', 11, 0.92); P(10, 12, 'F#5', 4, 0.86);
  call(11, 0.82); P(12, 0, 'G5', 11, 0.94); P(12, 12, 'F#5', 4, 0.88);
  call(13, 0.84); P(14, 0, 'B5', 11, 0.98); P(14, 12, 'A#5', 4, 0.9);
  P(15, 0, 'B5', 14, 0.9, { r: 0.9 });

  // ---- Harmony map per bar: [pad root, sub/kick root, SIGNAL bar pattern, AFTERGLOW voicing]
  const SIG = {
    Bm: 'B3 F#4 D5 B3 F#4 E5 B3 F#4 F#5 B3 F#4 E5 B3 D5 B3 F#4',
    G: 'B3 G4 D5 B3 G4 E5 B3 G4 G5 B3 G4 F#5 B3 D5 B3 G4',
    Em: 'B3 G4 E5 B3 G4 F#5 B3 G4 G5 B3 G4 F#5 B3 E5 B3 G4',
    'F#/B': 'B3 F#4 C#5 B3 F#4 A#4 B3 F#4 C#5 B3 F#4 F#5 B3 C#5 B3 A#4',
    'F#': 'C#4 F#4 A#4 C#4 F#4 C#5 C#4 F#4 F#5 C#4 F#4 C#5 C#4 A#4 C#4 F#4',
  };
  const VOICE = { Bm: ['F#3', 'B3', 'D4'], G: ['G3', 'B3', 'D4'], Em: ['G3', 'B3', 'E4'], 'F#': ['F#3', 'A#3', 'C#4'] };
  const chordOf = { 1: 'Bm', 2: 'Bm', 3: 'G', 4: 'G', 5: 'Em', 6: 'Em', 7: 'F#/B', 8: 'F#/B', 9: 'Bm', 10: 'G', 11: 'Em', 12: 'F#', 13: 'Bm', 14: 'F#' };
  const padRoot = { Bm: 'B2', G: 'G2', Em: 'E2', 'F#/B': 'F#2', 'F#': 'F#2' };
  const bassRoot = { Bm: 'B1', G: 'G1', Em: 'E1', 'F#': 'F#1' };

  // ---- EVENT HORIZON bed: one open fifth per harmony span (two bars in I-III, one bar in IV-V).
  horizon.push(N('horizon', at(1), 'B2', { off: 0.6, g: 32, a: 0.3, r: 1.0, v: 0.62 }));
  for (const [bar, len] of [[3, 32], [5, 32], [7, 32], [9, 16], [10, 16], [11, 16], [12, 16], [13, 16], [14, 16]])
    horizon.push(N('horizon', at(bar), padRoot[chordOf[bar]], { off: 1.6, g: len, a: 0.15, r: 1.0, v: bar >= 9 ? 0.6 : 0.55 }));
  horizon.push(N('horizon', at(15), 'B2', { off: 1.6, g: 16, a: 0.15, r: 1.6, v: 0.55 }));

  // ---- SIGNAL: 3+3+3+3+2+2 grouped ostinato, enters bar 2, stops early at bar 8 (suspension), returns at the arrival.
  const vel = [0.46, 0.36, 0.62, 0.46, 0.36, 0.62, 0.46, 0.36, 0.62, 0.46, 0.36, 0.62, 0.46, 0.58, 0.46, 0.58];
  if (o.pulseIntro) for (const j of [0, 3, 6, 9, 12, 14]) signal.push(N('signal', at(1, j), 'B3', { g: 1, a: 0.001, r: 0.04, v: 0.3 })); // grid under the first call
  for (let bar = 2; bar <= 14; bar++) {
    if (bar === 8 || (o.risk && bar === 14)) continue;
    const scale = bar === 2 ? 0.55 : bar < 9 ? 0.85 : 1;
    SIG[chordOf[bar]].split(' ').forEach((p, j) => (o.splitSignal && bar >= 9 && [2, 5, 8, 11, 13, 15].includes(j) ? sighi : signal)
      .push(N('signal', at(bar, j), p, { g: 1, a: 0.001, r: 0.04, v: +(vel[j] * scale).toFixed(3) })));
  }

  // ---- AFTERGLOW chords only from the arrival (held back for consequence).
  for (let bar = 9; bar <= 14; bar++) for (const p of VOICE[chordOf[bar]]) afterglow.push(N('afterglow', at(bar), p, { g: 16, a: 0.02, r: 0.45, v: 0.5 }));
  for (const p of VOICE.Bm) afterglow.push(N('afterglow', at(15), p, { g: 18, a: 0.02, r: 1.4, v: 0.5 }));

  // ---- SPECTER: suspension choir (B -> A# leading tone -> B) and the closing hush.
  specter.push(N('specter', at(7), 'B3', { off: 1.2, g: 16, a: 0.06, r: 0.4, v: 0.55 }), N('specter', at(7), 'F#3', { off: 1.2, g: 16, a: 0.06, r: 0.4, v: 0.45 }));
  specter.push(N('specter', at(8), 'A#3', { off: 1.2, g: 15, a: 0.06, r: 0.3, v: 0.6 }), N('specter', at(8), 'F#3', { off: 1.2, g: 15, a: 0.06, r: 0.3, v: 0.45 }));
  specter.push(N('specter', at(9), 'B3', { off: 1.2, g: 16, a: 0.03, r: 0.5, v: 0.5 }), N('specter', at(9), 'D4', { off: 1.2, g: 16, a: 0.03, r: 0.5, v: 0.42 }));
  if (o.climax) {
    for (const [s, g, v] of [[0, 5, 0.5], [6, 5, 0.48], [12, 3, 0.54]]) specter.push(N('specter', at(13, s), 'B3', { off: 2.4, g, a: 0.02, r: 0.15, v }));
    specter.push(N('specter', at(14), 'F#3', { off: 1.2, g: 15, a: 0.04, r: 0.3, v: 0.45 }), N('specter', at(14), 'A#3', { off: 1.2, g: 15, a: 0.04, r: 0.3, v: 0.55 }));
    chrome.push(N('chrome', at(14), 'B4', { v: 0.6 }));
  }
  specter.push(N('specter', at(15), 'B3', { off: 1.2, g: 20, a: 0.06, r: 1.2, v: 0.5 }), N('specter', at(15), 'F#3', { off: 1.2, g: 20, a: 0.06, r: 1.2, v: 0.4 }));

  // ---- CHROME: identity strike, phrase marks, arrival, final cadence + tresillo echo (call without its leap -> loops to bar 1).
  chrome.push(N('chrome', at(1), 'B4', { v: 0.72 }), N('chrome', at(3), 'B4', { v: 0.42 }), N('chrome', at(5), 'B4', { v: 0.42 }));
  chrome.push(N('chrome', at(9), 'B4', { v: 0.85 }), N('chrome', at(13), 'B4', { v: 0.55 }));
  chrome.push(N('chrome', at(15), 'B4', { v: 0.8 }), N('chrome', at(15, 6), 'B4', { v: 0.44 }), N('chrome', at(15, 12), 'B4', { v: 0.32 }));

  // ---- LOW END. Kick and ABYSS share onsets and playback rate (pack phase-lock), so they reinforce instead of cancel.
  const low = (i, note, gate, vk, vs) => {
    kick.push(N('kick', i, note, { v: vk, g: gate - 1, a: 0.001, r: 0.04, choke: 'kick' }));
    abyss.push(N('abyss', i, note, { v: vs, g: gate, a: 0.002, r: 0.03, choke: 'sub' }));
  };
  for (let bar = 3; bar <= 6; bar++) {
    if (o.lightPedal && bar <= 4) { // sub alone carries the tresillo; kick only marks the downbeat
      low(at(bar, 0), 'B1', 6, 0.8, 0.5);
      for (const [s, g, v] of [[6, 6, 0.44], [12, 4, 0.47]]) abyss.push(N('abyss', at(bar, s), 'B1', { v, g, a: 0.002, r: 0.03, choke: 'sub' }));
    } else { low(at(bar, 0), 'B1', 6, 0.88, 0.62); low(at(bar, 6), 'B1', 6, 0.72, 0.56); low(at(bar, 12), 'B1', 4, 0.78, 0.58); }
  }
  abyss.push(N('abyss', at(7), 'B1', { v: 0.6, g: 24, a: 0.002, r: 0.06, choke: 'sub' })); // pedal holds, then the floor drops out at 8:3
  for (let bar = 9; bar <= 14; bar++) {
    if (o.risk && bar === 14) continue; // risk: the floor drops out under the climactic leap
    const r = bassRoot[chordOf[bar]];
    low(at(bar, 0), r, 6, 0.95, 0.64); low(at(bar, 6), r, 4, 0.74, 0.56); low(at(bar, 10), r, 6, 0.8, 0.58);
    for (const s of [2, 8, 14]) reactor.push(N('reactor', at(bar, s), r, { g: 1, a: 0.002, r: 0.03, v: s === 14 ? 0.7 : 0.6, choke: 'growl' }));
  }
  kick.push(N('kick', at(15), 'B1', { v: 1 }));
  abyss.push(N('abyss', at(15), 'B1', { v: 0.66, g: 20, a: 0.002, r: 1.0, choke: 'sub' }));
  const ironBars = o.arrivalLow ? [9, 10, 12, 13, 14, 15] : [9, 13, 15]; // Em bar skipped: E1 is below IRON PULSE's range
  for (const bar of ironBars.filter((b) => !(o.risk && b === 14))) iron.push(N('iron', at(bar), bar === 15 ? 'B1' : bassRoot[chordOf[bar]], { v: !o.arrivalLow ? 0.8 : [9, 13, 15].includes(bar) ? 0.85 : 0.68 }));

  // ---- DRUM KIT (crack / clap / tick / open).
  for (let bar = 3; bar <= 6; bar++) {
    drums.push(K('crack', at(bar, 8), { v: 0.82 }));
    for (let s = 0; s < 16; s += bar < 5 ? 2 : 1) drums.push(K('tick', at(bar, s), { v: s % 4 === 0 ? 0.5 : s % 2 === 0 ? 0.34 : 0.22 }));
    if (bar % 2 === 0) drums.push(K('open', at(bar, 14), { v: 0.5, g: '1/8', r: 0.06 }));
  }
  for (let s = 0; s < 16; s++) drums.push(K('tick', at(7, s), { v: +(0.36 - s * 0.012).toFixed(3) }));
  [[0, 0.55], [6, 0.7], [12, 0.82], [13, 0.72], [14, 0.86], [15, 1]].forEach(([s, v]) => drums.push(K('crack', at(8, s), { v, g: '1/32', r: 0.015, choke: 'snare' })));
  for (let bar = 9; bar <= (o.risk ? 13 : 14); bar++) {
    for (const s of [4, 12]) drums.push(K('crack', at(bar, s), { v: 0.9 }), K('clap', at(bar, s), { v: 0.62 }));
    for (let s = 0; s < 16; s++) drums.push(K('tick', at(bar, s), { v: s % 4 === 2 ? 0.2 : s % 2 === 0 ? 0.42 : 0.26 }));
    for (const s of [2, 6, 10, 14]) drums.push(K('open', at(bar, s), { v: 0.4, g: '1/8', r: 0.06 }));
  }

  // ---- Transition + impact: riser ends on its last frame exactly at 9:1 (rate B, 3.4286 s build).
  const riseRate = 1.122462, build = 2 * 4 * 60 / 140;
  ascension.push(N('ascension', at(7), 'B4', { off: +(6 - build * riseRate).toFixed(6), a: 0.3, v: 0.72 }));
  convergence.push(N('convergence', at(9), 'B1', { v: 0.75 }));
  if (o.risk) convergence.push(N('convergence', at(15), 'B1', { v: 0.62, g: 16, a: 0.001, r: 1.8 })); // second arrival, fitted inside 28 s

  const fx = {
    lead: [{ type: 'reverb', roomSize: 0.7, decaySeconds: 2.2, wet: 0.22 }],
    signal: [{ type: 'highpass', frequencyHz: 180 }, { type: 'delay', timeMs: 321, wet: 0.22 }],
    sighi: [{ type: 'highpass', frequencyHz: 180 }, { type: 'delay', timeMs: 321, wet: 0.22 }],
    chrome: [{ type: 'reverb', roomSize: 0.8, decaySeconds: 2.4, wet: 0.28 }],
    specter: [{ type: 'reverb', roomSize: 0.7, decaySeconds: 2.0, wet: 0.25 }],
    horizon: [{ type: 'highpass', frequencyHz: 70 }],
    afterglow: [{ type: 'highpass', frequencyHz: 140 }],
    reactor: [{ type: 'highpass', frequencyHz: 110 }],
  };
  const gain = { lead: -3, signal: -10, sighi: -10, chrome: -7, specter: -7, horizon: -9, afterglow: -10, abyss: -5, reactor: -8, kick: -3, iron: -7, drums: -6, ascension: -9, convergence: -6, ...o.gain };
  const tr = (id, src, notes, extra = {}) => T(id, src, BARS, notes, { mix: { gainDb: gain[id] }, ...(fx[id] ? { effects: fx[id] } : {}), ...extra });
  const sigPan = o.splitSignal ? { automation: { pan: [{ at: { musical: '9:1' }, value: -0.45 }, { at: { musical: '15:1' }, value: 0 }],
    ...(o.wideArrival ? { gainDb: [{ at: { musical: '9:1' }, value: gain.signal + 3 }, { at: { musical: '15:1' }, value: gain.signal }] } : {}) } } : {};
  const tracks = [tr('lead', SRC.phantom, lead), tr('signal', SRC.signal, signal, sigPan), tr('sighi', SRC.signal, sighi, { mix: { gainDb: gain.sighi, pan: 0.45 } }), tr('chrome', SRC.chrome, chrome), tr('specter', SRC.specter, specter),
    tr('horizon', SRC.horizon, horizon), tr('afterglow', SRC.afterglow, afterglow), tr('abyss', SRC.abyss, abyss), tr('reactor', SRC.reactor, reactor),
    tr('kick', SRC.kick, kick), tr('iron', SRC.iron, iron), { ...tr('drums', null, drums), instrument: { type: 'drumkit', kit: 'assets/v12-signature/kit.json' } },
    tr('ascension', SRC.ascension, ascension), tr('convergence', SRC.convergence, convergence)];
  return project(o.title ?? 'entry-k3v9', 140, BARS, tracks, { render: { duration: { seconds: 28 } }, master: { gainDb: o.masterDb ?? -1 } });
}

const V2 = { lightPedal: true, arrivalLow: true, climax: true, splitSignal: true, gain: { convergence: -4 } };
const V3 = { ...V2, pulseIntro: true, wideArrival: true, gain: { ...V2.gain, sighi: -6 } };
const VERSIONS = { v1: {}, v2: V2, v3: V3, v4: { ...V3, risk: true } };
for (const v of process.argv.slice(2)) { write(`cue-${v}.json`, build(VERSIONS[v])); console.log(`cue-${v}.json`); }
