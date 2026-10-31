// Write the LOWRIDER//2099 DaemonV12 projects: hook.json (the 2-bar hook, twice),
// candidate-a-bounce.json and candidate-b-takeover.json. Run: node make-projects.mjs
import { writeFileSync } from 'node:fs';
import { line, hits, hookLead, hookTalkbox, hook808 } from './score.mjs';

const DIR = new URL('./', import.meta.url).pathname;
const SWING = 40; // A's 16th swing: odd 16ths +40 ticks (58.3 %)

const kit = name => ({ type: 'drumkit', kit: `assets/${name}/kit.json` });
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
/** One whole-length pattern per track; empty tracks are dropped. */
function track(id, description, kitName, notes, bars, mix, effects) {
  return { id, description, instrument: kit(kitName), mix, effects, clips: [{ bar: 1, pattern: 'main' }], patterns: [{ id: 'main', bars, notes }] };
}
function project({ title, description, bars, tracks, master }) {
  return {
    formatVersion: 1, title, description, bpm: 96, timeSignature: '4/4', key: 'F minor', bars, seed: 2099,
    render: { duration: { bars }, tail: 'none' }, master, tracks: tracks.filter(t => t.patterns[0].notes.length),
  };
}

// No limiter exists in the engine. The final tanh saturation (drive 0, mix 1) is a soft clipper:
// its output can never reach full scale, and input peaks up to ~+3 dBFS land under -1 dBFS.
const master = gainDb => ({ gainDb, effects: [
  { type: 'highpass', frequencyHz: 28 },
  { type: 'compressor', thresholdDb: -12, ratio: 2, attackMs: 30, releaseMs: 160, makeupGainDb: 0 },
  { type: 'saturation', driveDb: 0, mix: 1 },
] });

// ======================================================================================
// A: BOUNCE. Shared by hook.json (the hook alone) and candidate A.
// ======================================================================================
const A_MIX = {
  kick: [{ gainDb: 0 }, [{ type: 'highpass', frequencyHz: 40 }]],
  'bass-808': [{ gainDb: 0 }, [{ type: 'highpass', frequencyHz: 26 }]],
  clap: [{ gainDb: -3 }, [{ type: 'highpass', frequencyHz: 180 }]],
  hats: [{ gainDb: -3, pan: -0.5 }, [{ type: 'highpass', frequencyHz: 4500 }]],
  shaker: [{ gainDb: -9, pan: 0.6 }, [{ type: 'highpass', frequencyHz: 3000 }]],
  rim: [{ gainDb: -4, pan: -0.55 }, [{ type: 'highpass', frequencyHz: 500 }, { type: 'reverb', roomSize: 0.3, decaySeconds: 0.6, wet: 0.15 }]],
  lead: [{ gainDb: -7, pan: -0.15 }, [{ type: 'highpass', frequencyHz: 280 }, { type: 'delay', timeMs: 468.75, wet: 0.16 }, { type: 'reverb', roomSize: 0.55, decaySeconds: 1.6, wet: 0.18 }]],
  talkbox: [{ gainDb: 0, pan: 0.15 }, [{ type: 'highpass', frequencyHz: 190 }, { type: 'compressor', thresholdDb: -20, ratio: 3, attackMs: 5, releaseMs: 80, makeupGainDb: 2 }, { type: 'reverb', roomSize: 0.4, decaySeconds: 1.2, wet: 0.1 }]],
  keys: [{ gainDb: -12 }, [{ type: 'highpass', frequencyHz: 220 }, { type: 'reverb', roomSize: 0.6, decaySeconds: 2, wet: 0.32 }]],
  hop: [{ gainDb: -9, pan: 0.2 }, [{ type: 'highpass', frequencyHz: 60 }, { type: 'reverb', roomSize: 0.5, decaySeconds: 1, wet: 0.2 }]],
};
const KITS_A = { kick: 'drums', 'bass-808': '808', clap: 'drums', hats: 'drums', shaker: 'drums', rim: 'drums', lead: 'lead', talkbox: 'voice', keys: 'keys', hop: 'fx' };
const DESC_A = {
  kick: 'Short knock kick riding the 808 hits (1, the swung "a" of 2, the "and" of 3)',
  'bass-808': '808: root, octave pop, walk-ups, slides home',
  clap: 'Dry clap + snap on 2 and 4',
  hats: 'Swung 8th hats with ghost 16ths, open hat into the turnaround',
  shaker: 'Swung 16th shaker, push/pull',
  rim: 'Modal rim, swung pushes',
  lead: 'Whine lead: the call',
  talkbox: 'Talkbox through the MORPH//03 vocal tract: the answer',
  keys: 'FM keys, rootless voicings, barely there',
  hop: 'Hydraulics: pneumatic pssht and chassis clunk',
};
function bandA(parts, bars) {
  return Object.keys(A_MIX).map(id => track(id, DESC_A[id], KITS_A[id], parts[id] ?? [], bars, ...A_MIX[id]));
}

// per-bar figures (bar = absolute bar, hook pairs start on odd bars)
const kickBar = (bar, steps = [0, 7, 10]) => steps.map(s => ({ bar, step: s, pitch: 'kick', vel: s === 0 ? 1 : s === 7 ? 0.82 : 0.9 }));
const clapBar = (bar, steps = [4, 12]) => steps.flatMap(s => [{ bar, step: s, pitch: 'clap', vel: 0.95 }, { bar, step: s, pitch: 'snap', vel: 0.55 }]);
const hatBar = (bar, { open = false, upTo = 16 } = {}) => [
  ...[0, 2, 4, 6, 8, 10, 12, 14].filter(s => s < upTo && !(open && s === 14)).map(s => ({ bar, step: s, pitch: 'hat', vel: s % 4 === 2 ? 0.7 : 0.5, chokeGroup: 'hats' })),
  ...[3, 11].filter(s => s < upTo).map(s => ({ bar, step: s, pitch: 'hat-tick', vel: 0.32, chokeGroup: 'hats' })),
  ...(open ? [{ bar, step: 14, pitch: 'hat-open', vel: 0.55, chokeGroup: 'hats' }] : []),
];
const shakerBar = (bar, upTo = 16) => range(0, upTo - 1).map(s => ({ bar, step: s, pitch: s % 2 ? 'shaker-pull' : 'shaker', vel: [0.5, 0.3, 0.75, 0.35][s % 4] }));
const keysPair = bar => [
  { bar, step: 0, pitch: 'fm9', vel: 0.7, gate: '3/8', envelope: { releaseSeconds: 0.3 } },
  { bar: bar + 1, step: 0, pitch: 'dbmaj9', vel: 0.7, gate: '5/8', envelope: { releaseSeconds: 0.2 } },
  { bar: bar + 1, step: 12, pitch: 'c7b9', vel: 0.65, gate: '1/4', envelope: { releaseSeconds: 0.1 } },
];

function hookProject() {
  const sw = { swing: SWING }, two = [1, 3];
  return project({
    title: 'LOWRIDER//2099 hook',
    description: 'The two-bar hook, played twice: whine lead call (C6-Ab5-F5 tresillo, scooped and bent), talkbox answer through the MORPH//03 vocal tract (ooh-WEE / yeah-YEAH with the shrinking mouth), 808 with octave pop and slide home, bounce drums. Fm9 | Dbmaj9 . . C7b9.',
    bars: 4, master: master(2),
    tracks: bandA({
      kick: hits(range(1, 4).flatMap(b => kickBar(b)), sw),
      'bass-808': line(two.flatMap(b => hook808(b)), { ...sw, release: 0.02, attack: 0.006 }),
      clap: hits(range(1, 4).flatMap(b => clapBar(b)), sw),
      hats: hits(range(1, 4).flatMap(b => hatBar(b, { open: b % 2 === 0 })), sw),
      shaker: hits(range(1, 4).flatMap(b => shakerBar(b)), sw),
      lead: line(two.flatMap(b => hookLead(b)), sw),
      talkbox: hits(two.flatMap(b => hookTalkbox(b))),
      keys: hits(two.flatMap(keysPair)),
    }, 4),
  });
}

function candidateA() {
  const sw = { swing: SWING };
  // 808: hook, then a walk-up variation (F-Ab-Bb into Db) for the verse-mode pair, hook, and a stop
  const bass = [
    ...hook808(1),
    { bar: 3, step: 0, pitch: 'F1', len: 5.5, vel: 0.95 }, { bar: 3, step: 7, pitch: 'F2', len: 1.5, vel: 0.8 },
    { bar: 3, step: 10, pitch: 'F1', len: 2, vel: 0.9 }, { bar: 3, step: 12, pitch: 'Ab1', len: 2, vel: 0.85 }, { bar: 3, step: 14, pitch: 'Bb1', len: 2, vel: 0.85 },
    ...hook808(3).filter(n => n.bar === 4),
    ...hook808(5),
    ...hook808(7).filter(n => n.bar === 7),
    { bar: 8, step: 0, pitch: 'Db2', len: 5.5, vel: 0.95 }, { bar: 8, step: 7, pitch: 'Db2', len: 1, vel: 0.75 },
  ];
  // lead: hook; verse mode keeps only the whoop (bar 3) and lets the talkbox answer alone (bar 4);
  // hook; the last call reaches up to Eb6 and falls to C6
  const lead = [
    ...hookLead(1),
    ...hookLead(3).filter(n => n.bar === 3 && n.step < 6),
    ...hookLead(5),
    ...hookLead(7).filter(n => n.bar === 7),
    { bar: 8, step: 0, pitch: 'C6', len: 2.5, vel: 0.92, scoop: 4, scoopLen: 0.5 },
    { bar: 8, step: 3, pitch: 'Ab5', len: 1.5, vel: 0.8 },
    { bar: 8, step: 6, pitch: 'Eb6', len: 4, vel: 0.9, scoop: 2, scoopLen: 0.5, fall: { at: 2.5, to: -3, over: 1 } },
  ];
  // the stop: bar 8 beat 3 everything but the talkbox, one keys chord and the hop drops out
  return project({
    title: 'LOWRIDER//2099 A: BOUNCE',
    description: 'Candidate A, irresistible West Coast bounce: 8 bars at 96 BPM, 58% swing. Hook (1-2), verse mode with space for a rapper (3-4: whoop only, talkbox answers, rim, 808 walk-up, hydraulic hop), hook (5-6), hook with an Eb6 reach and a dead stop on bar 8 beat 3 where the shrinking-mouth talkbox plays alone over C7b9.',
    bars: 8, master: master(2),
    tracks: bandA({
      kick: hits([...range(1, 7).flatMap(b => kickBar(b, b === 3 ? [0, 7, 10, 13] : [0, 7, 10])), ...kickBar(8, [0, 7])], sw),
      'bass-808': line(bass, { ...sw, release: 0.02, attack: 0.006 }),
      clap: hits([...range(1, 7).flatMap(b => clapBar(b)), { bar: 4, step: 15, pitch: 'clap', vel: 0.42 }, ...clapBar(8, [4])], sw),
      hats: hits([...range(1, 7).flatMap(b => hatBar(b, { open: b % 2 === 0 })), ...hatBar(8, { upTo: 8 })], sw),
      shaker: hits([...range(1, 7).flatMap(b => shakerBar(b)), ...shakerBar(8, 8)], sw),
      rim: hits(range(3, 8).flatMap(b => [6, 15].filter(s => b < 8 || s < 8).map(s => ({ bar: b, step: s, pitch: 'rim', vel: s === 6 ? 0.6 : 0.45 }))), sw),
      lead: line(lead, sw),
      talkbox: hits([1, 3, 5, 7].flatMap(b => hookTalkbox(b))),
      keys: hits([1, 3, 5, 7].flatMap(keysPair)),
      hop: hits([{ bar: 4, step: 13.25, pitch: 'hop', vel: 0.8 }, { bar: 8, step: 7.25, pitch: 'hop', vel: 0.9 }]), // clunk (+0.12 s) lands on s14 / s8
    }, 8),
  });
}

// ======================================================================================
// B: TAKEOVER. Straight 16ths, dirty 808, the Wobble Beast answers.
// ======================================================================================
function candidateB() {
  const lead = [
    ...hookLead(1), ...hookLead(3), ...hookLead(5), ...hookLead(7).filter(n => n.bar === 7),
    { bar: 8, step: 0, pitch: 'C6', len: 2.5, vel: 0.92, scoop: 4, scoopLen: 0.5 },
    { bar: 8, step: 3, pitch: 'Ab5', len: 1.5, vel: 0.8 },
  ];
  const leadNotes = line(lead);
  // bar 8: the last call's Db6 is a tape stop (rate 1 -> 0.25 over a half note) into silence
  leadNotes.push(...line([{ bar: 8, step: 6, pitch: 'Db6', len: 8, vel: 0.9, scoop: 1, scoopLen: 0.5 }]).map(n => ({ ...n, glide: { to: 0.25, duration: '1/2' }, playbackRate: 0.943874 })));

  // 808 calls on beats 1-2.5 and rests while the Beast answers (beats 3-4)
  const odd808 = bar => [
    { bar, step: 0, pitch: 'F1', len: 3, vel: 1, scoop: 7, scoopLen: 0.5 },
    { bar, step: 3, pitch: 'F2', len: 2, vel: 0.85, fall: { at: 1, to: -12, over: 1 } },
    { bar, step: 6, pitch: 'F1', len: 3.5, vel: 0.95 },
  ];
  const even808 = bar => [
    { bar, step: 0, pitch: 'Db2', len: 3, vel: 1 },
    { bar, step: 3, pitch: 'Db2', len: 1, vel: 0.8 },
    { bar, step: 4, pitch: 'Ab1', len: 2, vel: 0.85 },
    { bar, step: 6, pitch: 'C2', len: 3.5, vel: 0.95, fall: { at: 2, to: -12, over: 1.5 } },
  ];
  const bass = [...[3, 5, 7].flatMap(odd808), ...[4, 6].flatMap(even808),
    { bar: 8, step: 0, pitch: 'Db2', len: 3, vel: 1 }, { bar: 8, step: 3, pitch: 'Db2', len: 1, vel: 0.8 }, { bar: 8, step: 4, pitch: 'Ab1', len: 2, vel: 0.85 },
    { bar: 8, step: 6, pitch: 'Db2', len: 10, vel: 0.95, fall: { at: 2, to: -12, over: 8 } }];

  // kick/snare/clap from the drop
  const kicksB = range(3, 8).flatMap(b => (b === 8 ? [0, 3, 6] : b % 2 ? [0, 6, 10] : [0, 3, 6, 11, 14]).map(s => ({ bar: b, step: s, pitch: 'kick', vel: s === 0 ? 1 : 0.88 })));
  const snareB = range(3, 8).flatMap(b => (b === 8 ? [4] : [4, 12]).flatMap(s => [{ bar: b, step: s, pitch: 'snare', vel: 0.9 }, { bar: b, step: s, pitch: 'clap', vel: 0.75 }]));
  // hats: soft ticks in the intro, 16ths after the drop, rolls only at phrase ends; rolls climb in pitch
  const roll = (bar, from, to, every, v0, v1, r1 = 1) => {
    const out = [], nHits = Math.round((to - from) / every);
    for (let k = 0; k < nHits; k++) out.push({ bar, step: +(from + k * every).toFixed(4), pitch: 'hat-tick', vel: +(v0 + (v1 - v0) * k / Math.max(1, nHits - 1)).toFixed(3), playbackRate: +(1 + (r1 - 1) * k / Math.max(1, nHits - 1)).toFixed(4), chokeGroup: 'hats' });
    return out;
  };
  const hats16 = (bar, upTo = 16) => range(0, upTo - 1).map(s => ({ bar, step: s, pitch: 'hat', vel: [0.72, 0.4, 0.55, 0.42][s % 4], chokeGroup: 'hats' }));
  const hatsB = [
    ...[1, 2].flatMap(b => [0, 2, 4, 6, 8, 10, 12, 14].map(s => ({ bar: b, step: s, pitch: 'hat-tick', vel: 0.38, chokeGroup: 'hats' }))),
    ...hats16(3), ...hats16(4, 14), ...roll(4, 14, 16, 0.5, 0.4, 0.85, 1.25),
    ...hats16(5), ...hats16(6, 12), ...roll(6, 12, 16, 2 / 3, 0.35, 0.9, 1.5),
    ...hats16(7, 6), ...roll(7, 6, 8, 0.5, 0.45, 0.75), ...range(8, 15).map(s => ({ bar: 7, step: s, pitch: 'hat', vel: [0.72, 0.4, 0.55, 0.42][s % 4], chokeGroup: 'hats' })),
    ...roll(8, 0, 4, 2 / 3, 0.5, 0.8), ...hats16(8, 6).filter(h => h.step >= 4),
  ];
  // the Beast answers from the drop; the talkbox only in the intro (its mouth grows into the drop)
  const beastAt = (bar, name) => ({ bar, step: 9.5, pitch: name, vel: 0.95 }); // file starts a 32nd early: the inhale
  const beast = [beastAt(3, 'beast-wom'), beastAt(4, 'beast-dive'), beastAt(5, 'beast-wom'), beastAt(6, 'beast-wa-wa'), beastAt(7, 'beast-wom')];
  const talk = [{ bar: 1, step: 10, pitch: 'wow', vel: 0.9 }, { bar: 2, step: 10, pitch: 'yeah-shrink', vel: 0.95 }];

  const B = [
    track('kick', 'Knock kick, from the drop', 'drums', hits(kicksB), 8, { gainDb: 1 }, [{ type: 'highpass', frequencyHz: 40 }]),
    track('bass-808', 'Dirty 808: calls on beats 1-2.5 with octave dives, rests for the Beast', '808-dirty', line(bass, { release: 0.02, attack: 0.004 }), 8,
      { gainDb: -1 }, [{ type: 'highpass', frequencyHz: 26 }]),
    track('snare', 'Snare + clap on 2 and 4', 'drums', hits(snareB), 8, { gainDb: -3 }, [{ type: 'highpass', frequencyHz: 150 }, { type: 'reverb', roomSize: 0.25, decaySeconds: 0.5, wet: 0.08 }]),
    track('hats', 'Straight 16ths; rolls at phrase ends, climbing in pitch', 'drums', hits(hatsB), 8, { gainDb: -6, pan: -0.25 }, [{ type: 'highpass', frequencyHz: 5000 }]),
    track('lead', 'Whine lead, driven: the call; tape stop at the end', 'lead', leadNotes, 8,
      { gainDb: -11, pan: -0.1 }, [{ type: 'highpass', frequencyHz: 300 }, { type: 'saturation', driveDb: 9, mix: 0.35 }, { type: 'delay', timeMs: 312.5, wet: 0.14 }, { type: 'reverb', roomSize: 0.6, decaySeconds: 1.8, wet: 0.16 }]),
    track('talkbox', 'Talkbox intro answers; the mouth grows into the drop', 'voice', hits(talk), 8,
      { gainDb: 0, pan: 0.1 }, [{ type: 'highpass', frequencyHz: 190 }, { type: 'compressor', thresholdDb: -20, ratio: 3, attackMs: 5, releaseMs: 80, makeupGainDb: 2 }, { type: 'reverb', roomSize: 0.5, decaySeconds: 1.4, wet: 0.14 }]),
    track('beast', 'Wobble Beast (bowed cable through the vocal tract): the answers, with its own sub', 'voice', hits(beast), 8,
      { gainDb: 2 }, [{ type: 'highpass', frequencyHz: 28 }, { type: 'compressor', thresholdDb: -16, ratio: 3, attackMs: 3, releaseMs: 90, makeupGainDb: 1 }]),
    track('fx', 'Riser into the takeover', 'fx', hits([{ bar: 2, step: 0, pitch: 'riser', vel: 0.55 }]), 8, { gainDb: -10, pan: 0.15 }, [{ type: 'highpass', frequencyHz: 300 }]),
  ];
  return project({
    title: 'LOWRIDER//2099 B: TAKEOVER',
    description: 'Candidate B, aggressive futuristic trap takeover: 8 bars at 96 BPM, straight 16ths. Two bars of hook (lead, talkbox, ticks, riser) whose talkbox mouth grows to giant size into the drop; from bar 3 a distorted 808 calls with octave dives and the MORPH Wobble Beast answers in the bass register every bar while the 808 rests. Hat rolls only at phrase ends, climbing in pitch. Tape stop to silence.',
    bars: 8, master: master(1), tracks: B,
  });
}

const write = (name, p) => writeFileSync(DIR + name, JSON.stringify(p, null, 2) + '\n');
write('hook.json', hookProject());
write('candidate-a-bounce.json', candidateA());
write('candidate-b-takeover.json', candidateB());
console.log('wrote hook.json, candidate-a-bounce.json, candidate-b-takeover.json');
