// STILL HERE V3 — P: PROPULSION. Tempo map: bars 1-2 at 120 BPM, bars 3-7 at 150 BPM; ignition at
// pos 32 = 4.000 s = frame 176,400. D major; the intro sits on the dominant pedal (A).
// Hook (A's call/answer, recomposed): the machine calls 1-5-8, the lead answers 3-5-6, both in the
// 3+3+2 tresillo; at ignition the call goes tutti in D; the end climbs bVI-bVII and completes 6 -> 8.
import { SR, mtof, norm, split, shape, filt } from '../lib/dsp.mjs';
import { cable } from '../lib/cable.mjs';
import { notesOf, notePoints, noteEvents, muteLane, grabGain, harmonicLanes, buzzLane, zapDisp, periodLane } from '../lib/perform.mjs';
import { eKick, backbeat, eSnare, eHat, eCrash, synthNote, PATCH } from '../src/synths.mjs';
import { room, hp4 } from '../src/instruments.mjs';
import { duckLane } from '../src/project.mjs';
import { PROPULSION_MAP, CONTROL_120_MAP } from '../src/tempo-map.mjs';
import { P, TRESILLO, heartbeat, press, tickKit, turbine, pitchedKit, gatedNotes, sendSum, zero } from './v3-common.mjs';

const SECONDS = 12;
const D2 = 38, A2 = 45, D3 = 50, A1 = 33, Cs2 = 37, Fs2 = 42, G2 = 43, G3 = 55, Bb1 = 34, F2 = 41, Bb2 = 46, C2 = 36, C3 = 48, E2 = 40;

/**
 * The post-ignition bars as roles, so the fixed-120 control can drop one bar and keep the idea.
 * Each role: chord, bass call (root, fifth, octave) or a split bar, lead notes, pad voicing, arp tones.
 */
const ROLES = {
  hook1: { chord: 'D', bass: [[0, D2, 2, 1], [3, A2, 2, 0.9], [6, D3, 2, 0.9], [9, D2, 1, 0.6], [10, D2, 1, 0.7], [13, A1, 1, 0.65], [15, Cs2, 1, 0.75]],
    lead: [[0, 62, 2], [3, 69, 2], [6, 74, 2], [8, 78, 3], [11, 81, 3], [14, 83, 2]] },
  hook2: { chord: 'D', bass: [[0, D2, 2, 1], [3, A2, 2, 0.9], [6, D3, 2, 0.9], [9, D2, 1, 0.6], [10, D2, 1, 0.7], [13, A1, 1, 0.65], [15, Fs2, 1, 0.75]],
    lead: [[0, 62, 2], [3, 69, 2], [6, 74, 2], [8, 78, 3], [11, 81, 3], [14, 83, 1], [15, 85, 1]] },
  four: { chord: 'G', bass: [[0, G2, 2, 1], [3, D3, 2, 0.9], [6, G3, 2, 0.9], [9, G2, 1, 0.6], [10, G2, 1, 0.7], [13, 38, 1, 0.65], [15, A2, 1, 0.75]],
    lead: [[0, 67, 2], [3, 74, 2], [6, 79, 2], [8, 83, 3], [11, 81, 3], [14, 79, 2]] },
  climb: { chord: 'Bb|C', bass: [[0, Bb1, 2, 1], [3, F2, 2, 0.9], [6, Bb2, 1, 0.9], [8, C2, 2, 1], [11, G2, 2, 0.9], [14, C3, 1, 0.9], [15, Cs2, 1, 0.85]],
    lead: [[0, 74, 3], [3, 77, 3], [6, 79, 2], [8, 76, 3], [11, 79, 3], [14, 81, 2]] },
  payoff: { chord: 'D', bass: [[0, D2, 2, 1], [3, A2, 2, 0.95], [6, D3, 2, 0.95], [8, D2, 6, 1]],
    lead: [[0, 78, 3], [3, 81, 3], [6, 83, 2], [8, 86, 7]] },
};
const PAD = { D: [50, 57, 62, 64, 66], G: [55, 59, 62, 69], Bb: [53, 58, 62, 65], C: [55, 60, 64, 67], Dfin: [50, 57, 62, 66, 69, 76] };
const ARP = { D: [62, 66, 69, 74], G: [55, 59, 62, 67], Bb: [58, 62, 65, 70], C: [60, 64, 67, 72] };
const ARP_STEPS = [0, 1, 2, 0, 1, 2, 3, 1, 0, 1, 2, 0, 1, 2, 3, 2];

export function score(version = 'v1') {
  // V2 is the one revision after the V1 critique (REVIEW-V3.md), "the 3+3+2 is the spine": the machine's precision
  // leads the intro, the call rises above the chord at ignition, the end is a tutti 3+3+2. 'control120' is V2 at a fixed 120 BPM.
  const R2 = { machineIntro: true, ignition: true, tuttiEnd: true };   // the three edits answer P1, P2 and P3
  const V = { v1: {}, v2: R2, control120: { ...R2, fixed120: true } }[version];
  if (!V) throw new Error(`unknown version ${version}`);
  const M = V.fixed120 ? CONTROL_120_MAP() : PROPULSION_MAP();
  const t = pos => M.sec(pos);
  const order = V.fixed120 ? ['hook1', 'four', 'climb', 'payoff'] : ['hook1', 'hook2', 'four', 'climb', 'payoff'];
  const IGN = P(3), END = P(3 + order.length), FINAL = END - 8;             // final hit on beat 3 of the last bar
  const at = (k, x) => P(3 + k) + x;
  const isHook = r => r.startsWith('hook');

  // ---------------- notes
  const introBass = V.machineIntro ? 0.7 : 1;                               // V2: the statements step back (-3 dB) behind the ticks
  const bass = [
    ...[[0, A1, 2, 0.5], [3, E2, 2, 0.45], [6, A2, 2, 0.45]].map(([x, m, len, vel]) => ({ pos: x, midi: m, len, vel: vel * introBass, dark: true })),  // 0.0 s, dormant
    ...[[0, A1, 2, 0.75], [3, E2, 2, 0.68], [6, A2, 2, 0.68]].map(([x, m, len, vel]) => ({ pos: P(2) + x, midi: m, len, vel: vel * introBass })),       // 2.0 s, waking
    ...order.flatMap((r, k) => ROLES[r].bass.map(([x, m, len, vel]) => ({ pos: at(k, x), midi: m, len, vel }))),
  ];
  // V2: in the hook bars the call sounds an octave higher and legato (D5-A5-D6), above the pad and stab register,
  // so the ignition downbeat is a melodic arrival; the answer (3-5-6) stays where it was and reaches D6 only at the end
  const HIGH_CALL = [[0, 74, 3], [3, 81, 3], [6, 86, 2]];
  const leadOf = r => (V.ignition && isHook(r) ? [...HIGH_CALL, ...ROLES[r].lead.filter(([x]) => x >= 8)] : ROLES[r].lead);
  const callVel = (r, k, x) => (V.ignition && isHook(r) ? (k === 0 && x === 0 ? 0.95 : 0.8) : 0.72);
  const lead = order.flatMap((r, k) => leadOf(r).map(([x, m, len]) => ({ pos: at(k, x), midi: m, len, vel: x < 8 && r !== 'climb' && r !== 'payoff' ? callVel(r, k, x) : 0.9 })));
  const blips = [[P(1, 3), 73], [P(1, 3, 3), 76], [P(1, 4, 2), 78]].map(([pos, midi], k) => ({ pos, midi, len: 2, vel: 0.55 + 0.05 * k }));

  // ---------------- one-shots (each a native trigger in DaemonV12)
  const bassDark = { ...PATCH.bass, filter: { ...PATCH.bass.filter, cutoff: 230, env: 1.5 } };
  const kitBass = [
    ...pitchedKit('b', bass.filter(n => !n.dark).map(n => n.midi), m => synthNote({ midis: [m], seconds: 0.9, gate: 0.8, patch: PATCH.bass, seed: m })),
    ...pitchedKit('bd', bass.filter(n => n.dark).map(n => n.midi), m => synthNote({ midis: [m], seconds: 0.5, gate: 0.4, patch: bassDark, seed: m + 1 }), { pitchOffset: -24 }),
  ];
  const kitLead = pitchedKit('l', lead.map(n => n.midi), m => synthNote({ midis: [m], seconds: 1.0, gate: 0.85, patch: PATCH.pluckLead, seed: 40 + m }));
  const kitBlip = pitchedKit('k', blips.map(n => n.midi), m => synthNote({ midis: [m], seconds: 0.4, gate: 0.12, patch: PATCH.blip, seed: 70 + m }));
  const chordSpans = order.flatMap((r, k) => (ROLES[r].chord === 'Bb|C' ? [['Bb', at(k, 0), 8], ['C', at(k, 8), 8]] : [[r === 'payoff' ? 'Dfin' : ROLES[r].chord, at(k, 0), 16]]));
  // the pad holds through repeated chords (D for two bars) and rings out at the end
  const padSpans = [];
  for (const [c, pos, len] of chordSpans) {
    const last = padSpans[padSpans.length - 1];
    if (last && last.chord === c) last.len += len; else padSpans.push({ chord: c, pos, len });
  }
  const kitPad = padSpans.map((s, k) => {
    const dur = M.span(s.pos, s.len), tail = s.chord === 'Dfin' ? M.sec(END) - M.sec(s.pos) : dur + 0.35;
    return { name: `pad-${k + 1}-${s.chord.toLowerCase()}`, pitch: 60 + k, audio: synthNote({ midis: PAD[s.chord], seconds: tail, gate: s.chord === 'Dfin' ? tail - 0.36 : dur, patch: PATCH.pad, seed: 90 + k }), span: s };
  });
  // V2: the D stab joins the call's 3+3+2 in the hook bars (bass, stab and lead call together) and in the tutti ending
  const tutti = (k, vel) => [[at(k, 3), 'D', vel], [at(k, 6), 'D', vel + 0.05]];
  const stabAt = [[IGN, 'D', 1], ...order.flatMap((r, k) => (r === 'four' ? [[at(k, 0), 'G', 0.85]] : r === 'climb' ? [[at(k, 0), 'Bb', 0.85], [at(k, 8), 'C', 0.9]]
    : r === 'payoff' ? [[at(k, 0), 'D', 0.9], ...(V.tuttiEnd ? tutti(k, 0.85) : []), [FINAL, 'Dfin', 1]]
    : V.ignition ? [...(k > 0 ? [[at(k, 0), 'D', 0.8]] : []), ...tutti(k, 0.7)] : []))];
  const kitStab = [...new Set(stabAt.map(s => s[1]))].map((c, k) => ({ name: `stab-${c.toLowerCase()}`, pitch: 70 + k,
    audio: synthNote({ midis: PAD[c].map(m => m + (c === 'Dfin' ? 0 : 12 * (m < 57))), seconds: c === 'Dfin' ? 0.9 : 0.6, gate: c === 'Dfin' ? 0.45 : 0.16, patch: PATCH.stab, seed: 110 + k }) }));
  const arpChordAt = pos => { const s = chordSpans.find(([, p, len]) => pos >= p && pos < p + len); return s[0] === 'Dfin' ? 'D' : s[0]; };
  const arpFrom = at(order.indexOf('four'), 0), arpNotes = [];
  for (let pos = arpFrom; pos < FINAL; pos++) {
    const tones = ARP[arpChordAt(pos)], m = tones[ARP_STEPS[pos % 16]], ramp = Math.min(1, 0.5 + 0.5 * (pos - arpFrom) / 32);
    arpNotes.push({ pos, midi: m, len: 1, vel: (TRESILLO.includes(pos % 16) ? 1 : 0.62) * ramp, release: 0.05 });
  }
  const kitArp = pitchedKit('a', arpNotes.map(n => n.midi), m => synthNote({ midis: [m], seconds: 0.45, gate: 0.2, patch: PATCH.arp, seed: 150 + m }));

  // drums
  const kitKick = [{ name: 'kick', pitch: 36, audio: eKick({ f0: 52, decay: 0.34, seed: 1 }) }, { name: 'kick-big', pitch: 35, audio: eKick({ f0: 50, fStart: 260, decay: 0.55, click: 1, drive: 2.3, seed: 2 }) }];
  const kitSnare = [{ name: 'clap', pitch: 39, audio: backbeat({ seed: 3 }) }, { name: 'clap-big', pitch: 40, audio: backbeat({ seed: 4, tail: 0.3, snare: 0.9 }) }, { name: 'roll', pitch: 38, audio: eSnare({ seed: 9, noiseDecay: 0.09, toneDecay: 0.06 }) }];
  const kitHats = [{ name: 'hat-1', pitch: 42, audio: eHat({ seed: 7 }) }, { name: 'hat-2', pitch: 44, audio: eHat({ seed: 8, tune: 1.63 }) }, { name: 'ohat', pitch: 46, audio: eHat({ seed: 9, decay: 0.26 }) }];
  const kitCrash = [{ name: 'crash', pitch: 49, audio: eCrash({ seed: 11 }) }];
  const kitHeart = [{ name: 'heart', pitch: 60, audio: heartbeat(55, { seed: 3 }) }, { name: 'lock', pitch: 61, audio: heartbeat(110, { seed: 5, plate: 0.8 }) },
    ...(V.ignition ? [{ name: 'press', pitch: 62, audio: press(55, { seed: 3 }) }] : [])];
  const kitTicks = tickKit();

  // ---------------- the cable (industrial): A's dormant statements under the synth bass, then the turbine
  const CUT = M.sec(P(2, 4, 3));                                                      // 3.875 s: the hand grabs it
  const cableNotes = notesOf([[0, A1, 'pluck', 3, { amp: 0.5 }], [3, E2, 'pluck', 3, { amp: 0.45 }], [6, A1, 'pluck', 2, { amp: 0.42, pop: 2 }],
    [16, A1, 'slap', 3, { amp: 0.6 }], [19, E2, 'pluck', 3, { amp: 0.55 }], [22, A1, 'pluck', 2, { amp: 0.5, pop: 2 }]]);  // 120 BPM steps = 0.125 s
  const grabs = [{ from: 24, to: 40 }], mute = muteLane(cableNotes, { from: 0, to: 24, grabs }), grab = grabGain(grabs);
  const intro = cable({ seconds: 3.1, period: periodLane(notePoints(cableNotes), 1 / mtof(A1)), disp: zapDisp(-0.22, cableNotes), gain: x => 0.992 * grab(x),
    bright: 4600, damp: x => mute(x) * 0.85, drive: 2.4, buzz: buzzLane(cableNotes, () => 0.05), ...harmonicLanes(cableNotes), bow: 0, events: noteEvents(cableNotes), stages: 160, seed: 31 }).out;
  const { hi } = split(intro, 140), cableTrack = new Float64Array(SECONDS * SR);
  for (let i = 0, g = V.machineIntro ? 1.2 : 0.7; i < hi.length; i++) cableTrack[i] += g * hi[i];   // V2: +4.7 dB (the turbine still sets the peak)
  const spool = turbine({ from: M.sec(P(2, 3)), pitched: M.sec(P(2, 4, 1)), cut: CUT, target: A1 });
  for (let i = 0, s0 = Math.round(M.sec(P(2, 3)) * SR); i < spool.audio.length; i++) cableTrack[s0 + i] += spool.audio[i];
  norm(cableTrack, 0.9);
  zero([cableTrack], CUT, M.sec(IGN));

  // ---------------- patterns
  const kicks = [], claps = [], hats = [], crashes = [], ticks = [], hearts = [];
  const payBar = at(order.length - 1, 0);
  for (let pos = IGN; pos < (V.tuttiEnd ? payBar : FINAL); pos += 4) kicks.push({ pos, hit: pos === IGN || pos === payBar ? 'kick-big' : 'kick', vel: pos === IGN ? 1 : 0.9 });
  // V2: the last bar stops the four on the floor; kick, clap, stab, bass and lead hit the 3+3+2 together into the final hit
  if (V.tuttiEnd) kicks.push({ pos: payBar, hit: 'kick-big', vel: 0.9 }, { pos: payBar + 3, hit: 'kick', vel: 0.95 }, { pos: payBar + 6, hit: 'kick', vel: 0.95 });
  const climbBar = at(order.indexOf('climb'), 0);
  kicks.push({ pos: climbBar + 14, hit: 'kick', vel: 0.7 }, { pos: FINAL, hit: 'kick-big', vel: 1 });
  for (let k = 0; k < order.length; k++) {
    const r = order[k], b = at(k, 0);
    if (r === 'payoff') {
      claps.push(...(V.tuttiEnd ? [{ pos: b + 3, hit: 'clap', vel: 0.8 }, { pos: b + 6, hit: 'clap', vel: 0.85 }] : [{ pos: b + 4, hit: 'clap', vel: 0.95 }]), { pos: FINAL, hit: 'clap-big', vel: 1 });
      continue;
    }
    claps.push({ pos: b + 4, hit: 'clap', vel: 0.95 });
    if (r === 'climb') for (let x = 8; x < 16; x++) claps.push({ pos: b + x, hit: 'roll', vel: 0.3 + 0.6 * (x - 8) / 7 });
    else claps.push({ pos: b + 12, hit: 'clap', vel: 0.95 });
  }
  for (let pos = IGN; pos < FINAL; pos++) {
    const x = pos % 16, k = Math.floor((pos - IGN) / 16), open = x % 4 === 2 && k > 0;
    hats.push({ pos, hit: open ? 'ohat' : `hat-${(pos % 2) + 1}`, vel: open ? 0.62 : x % 4 === 0 ? 0.7 : x % 2 ? 0.42 : 0.55 });
  }
  crashes.push({ pos: IGN, vel: 0.95 }, { pos: at(order.indexOf('four'), 0), vel: 0.6 }, { pos: at(order.length - 1, 0), vel: 0.85 }, { pos: FINAL, vel: 0.9 });
  // precision ticks: 3+3+2 before ignition, ratchet with the turbine, then only the accents (quiet) until the climb
  // V2: the 3+3+2 ticks run one eighth further (3.0 and 3.125 s), into the turbine's first slap; its ratchet takes over from ~3.4 s
  for (let pos = 0; pos < (V.ignition ? P(2, 3, 2) : P(2, 3)); pos++) ticks.push({ pos, hit: `tick-${(pos % 4) + 1}`, vel: V.machineIntro ? (TRESILLO.includes(pos % 16) ? 1 : 0.45) : (TRESILLO.includes(pos % 16) ? 0.85 : 0.4) * (pos < 16 ? 0.8 : 1) });
  spool.trips.slice(1).forEach((tt, k) => { if (tt < CUT - 0.012) ticks.push({ sec: tt, hit: `tick-${(k % 4) + 1}`, vel: Math.min(0.95, 0.4 + 0.05 * k),
    endSeconds: Math.round(Math.min(0.11, CUT - tt - 0.006) * 1e6) / 1e6, envelope: { attackSeconds: 0, releaseSeconds: 0.003 } }); });
  for (let pos = IGN; pos < climbBar; pos++) if (TRESILLO.includes(pos % 16)) ticks.push({ pos, hit: `tick-${(pos % 4) + 1}`, vel: 0.35 });
  const snapped = ticks.map(({ sec, ...n }) => (sec === undefined ? n : { ...n, tick: M.tickOfSeconds(sec) }));  // physics-timed: nearest engine tick (< 0.42 ms)
  // V2: at 3.0 s only the heartbeat's press (no kick, no sub) marks the turbine's start, so the last second before ignition sits lower
  hearts.push(...[0, 8, 16, ...(V.ignition ? [] : [24])].map((pos, k) => ({ pos, hit: 'heart', vel: 0.7 + 0.07 * k, gate: M.duration(pos === 24 ? 0.125 : 0.5), envelope: { attackSeconds: 0.0005, releaseSeconds: pos === 24 ? 0.06 : 0.12 } })));
  if (V.ignition) hearts.push({ pos: 24, hit: 'press', vel: 0.8, gate: M.duration(0.3), envelope: { attackSeconds: 0.0005, releaseSeconds: 0.1 } });
  hearts.push({ pos: FINAL + 4, hit: 'lock', vel: 0.6, gate: M.duration(0.25), envelope: { attackSeconds: 0.0005, releaseSeconds: 0.12 } });  // ends before 12.0 s, no crop

  const kitPadNotes = kitPad.map((k, i) => ({ pos: k.span.pos, hit: k.name, vel: 0.85 }));
  const leadNotes = gatedNotes(M, 'l', lead, { release: 0.09 }), arpGated = gatedNotes(M, 'a', arpNotes, { release: 0.05 }), blipNotes = gatedNotes(M, 'k', blips, { release: 0.06 });
  const bassNotes = bass.map(n => ({ pos: n.pos, hit: `${n.dark ? 'bd' : 'b'}${n.midi}`, vel: n.vel, gate: M.duration(M.span(n.pos, n.len)), envelope: { attackSeconds: 0.001, releaseSeconds: 0.03 } }));
  // FDN room: lead, pad, arp and the intro blips, re-created at their exact frames (a send)
  const sends = [sendSum(M, kitLead, leadNotes), sendSum(M, kitPad, kitPadNotes), sendSum(M, kitArp, arpGated), sendSum(M, kitBlip, blipNotes)];
  const sL = Float64Array.from(sends[0].L, (v, i) => v + 0.5 * sends[1].L[i] + 0.6 * sends[2].L[i] + 0.8 * sends[3].L[i]);
  const sR = Float64Array.from(sends[0].R, (v, i) => v + 0.5 * sends[1].R[i] + 0.6 * sends[2].R[i] + 0.8 * sends[3].R[i]);
  const wet = room(sL, sR, { rt60: 1.4, predelay: 0.02, seed: 9 });
  zero([wet.L, wet.R], CUT, M.sec(IGN));

  const kickTimes = kicks.map(k => M.sec(k.pos));
  const tracks = [
    { id: 'heart', description: V.ignition ? 'The factory heartbeat: the kick asleep inside the MORPH press clank on the A pedal at 0, 1 and 2 s; at 3 s the press alone as the turbine takes over; the lock at the end.'
      : 'The factory heartbeat: the kick asleep inside the MORPH press clank, once per second on the A pedal; the lock at the end.', kit: kitHeart, notes: hearts, mix: { gainDb: -6 } },
    { id: 'kick', description: 'Electronic kick (swept sine, click, drive), four on the floor from ignition.', kit: kitKick, notes: kicks, mix: { gainDb: -3 } },
    { id: 'clap', description: 'Clap layered on an electronic snare on 2 and 4; a 16th roll in the climb.', kit: kitSnare, notes: claps, mix: { gainDb: -7 }, effects: [{ type: 'reverb', roomSize: 0.4, decaySeconds: 0.9, wet: 0.1 }] },
    { id: 'hats', description: '808-style metallic hats in 16ths, open on the off-beat eighths from bar 4.', kit: kitHats, notes: hats, mix: { gainDb: -15, pan: 0.2 } },
    { id: 'ticks', description: 'MORPH//04 cable ticks: the 3+3+2 precision rhythm, the turbine ratchet, quiet accents after ignition.', kit: kitTicks, notes: snapped, mix: { gainDb: V.machineIntro ? -8 : -14, pan: -0.3 } },
    { id: 'crash', description: 'Electronic crash (metallic squares and noise, different per side).', kit: kitCrash, notes: crashes.map(c => ({ ...c, hit: 'crash' })), mix: { gainDb: -11 } },
    { id: 'bass', description: 'Analog-style bass one-shots (saw + square + sine, 24 dB low-pass), gated natively; the call 1-5-8 in tresillo; ducked under the kick.', kit: kitBass, notes: bassNotes,
      mix: { gainDb: -5 }, automation: { gainDb: duckLane(-5, kickTimes, { depth: V.ignition ? 10 : 7, recover: 0.09 }) } },
    { id: 'lead', description: V.ignition ? 'Resonant square/saw pluck-lead with a pitch blip: the call D5-A5-D6 above the chord, the answer 3-5-6, the 6->8 completion.'
      : 'Resonant square/saw pluck-lead with a pitch blip: the call in octaves, the answer 3-5-6, the 6->8 completion.', kit: kitLead, notes: leadNotes,
      mix: { gainDb: -7, pan: 0.05 }, effects: [{ type: 'delay', timeMs: 300, wet: 0.16 }] },
    { id: 'blip', description: 'The intro robot answer: a triangle blip C#5-E5-F#5.', kit: kitBlip, notes: blipNotes, mix: { gainDb: -9, pan: 0.35 }, effects: [{ type: 'delay', timeMs: 375, wet: 0.25 }] },
    { id: 'stabs', description: V.ignition ? 'Saw stabs: with the call (3+3+2) in the hook bars, on the chord changes (G, Bb, C), the tutti ending and the final D.'
      : 'Saw stabs on the chord changes (D, G, Bb, C) and the final D.', kit: kitStab, notes: stabAt.map(([pos, c, vel]) => ({ pos, hit: `stab-${c.toLowerCase()}`, vel })), mix: { gainDb: -12 } },
    { id: 'pad', description: 'Warm polysynth pad under the groove (Dadd9, Gadd9, Bb, C, D), ducked by the kick.', kit: kitPad.map(({ span, ...k }) => k), notes: kitPadNotes,
      mix: { gainDb: -15 }, automation: { gainDb: duckLane(-15, kickTimes, { depth: 6, recover: 0.16 }) } },
    { id: 'arp', description: 'Pulse/saw pluck arpeggio in 16ths with 3+3+2 accents, from the IV bar, dotted-eighth echo.', kit: kitArp, notes: arpGated,
      mix: { gainDb: -15, pan: -0.35 }, effects: [{ type: 'delay', timeMs: 300, wet: 0.22 }] },
    { id: 'cable', description: 'EXTERNAL: MORPH//03 Tempo String: A\'s dormant statements under the bass (0-2.8 s) and the turbine wound into A1 (3.0-3.875 s).', sample: cableTrack, notes: [{ pos: 0, vel: 1 }], mix: { gainDb: -11 } },
    { id: 'room', description: 'EXTERNAL: MORPH FDN room of lead, pad, arpeggio and blips, re-created at their exact frames.', sample: [wet.L, wet.R], notes: [{ pos: 0, vel: 1 }], mix: { gainDb: -16 } },
  ];
  const bars = M.engineBars;
  return {
    name: `still-here-p-${version}`, title: `STILL HERE P: PROPULSION (${version.toUpperCase()})`,
    description: V.fixed120 ? 'CONTROL: P V2 at a fixed 120 BPM (four bars after ignition instead of five), same idea, arrangement and palette.'
      : 'P: PROPULSION. Two bars at 120 BPM (the factory on an A pedal), then five at 150 BPM in D, carried by a fixed 150 BPM engine project (2/4) whose ticks hold both tempos exactly. Ignition 4.000 s = frame 176,400.',
    bpm: M.engineBpm, timeSignature: M.engineMeter, bars, key: 'D major', seed: 3, grid: M, tempoMap: M.sections.map(s => ({ bpm: s.bpm, bars: s.bars })),
    master: { gainDb: 0, effects: [{ type: 'highpass', frequencyHz: 24 }, { type: 'compressor', thresholdDb: -14, ratio: 2, attackMs: 12, releaseMs: 110 }] },
    tracks,
    silence: [{ from: CUT, to: M.sec(IGN), fade: 0.004 }],
    cues: [
      { pos: 0, cue: 'statement (dormant)', what: V.machineIntro ? '3+3+2 ticks at full strength; heartbeat; dark synth bass A1-E2-A2 under the cable' : 'Heartbeat + dark synth bass A1-E2-A2 over the cable; 3+3+2 ticks' },
      { pos: P(1, 3), cue: 'robot answer', what: 'Blips C#5-E5-F#5' },
      { pos: P(2), cue: 'statement (waking)', what: 'Brighter bass statement' },
      { pos: P(2, 3), cue: 'turbine', what: V.ignition ? 'The heartbeat hands over to the turbine: cable wound into A1; ticks ratchet with it' : 'Cable wound into A1; ticks ratchet with it' },
      { pos: P(2, 4, 3), cue: 'breath', what: 'Exact silence until ignition' },
      { pos: IGN, cue: 'IGNITION', what: `Tempo ${V.fixed120 ? 'stays 120' : '150'}: ${V.ignition ? 'the call tutti in D, the lead D5-A5-D6 above bass and stabs' : 'the call tutti in D (bass, lead, D stab, pad)'}, big kick, crash; four on the floor` },
      { pos: P(3, 3), cue: 'first answer', what: 'Lead F#5-A5-B5' },
      ...(V.fixed120 ? [] : [{ pos: P(4), cue: 'hook again', what: 'Call; answer climbs to C#6' }]),
      { pos: at(order.indexOf('four'), 0), cue: 'IV', what: 'G: call G, answer B5-A5-G5; the arpeggio enters' },
      { pos: climbBar, cue: 'climb', what: 'bVI-bVII (Bb, C): bass and lead in rhythmic unison; snare roll' },
      { pos: payBar, cue: 'BREAKTHROUGH', what: V.tuttiEnd ? 'D: the band hits the 3+3+2 together (kick, clap, stab, bass) under the lead F#5-A5-B5; hats and arpeggio keep running' : 'D: bass call under the lead F#5-A5-B5' },
      { pos: FINAL, cue: 'completion', what: 'B5 -> D6 (6 -> 8): final hit, D stab, crash' },
      { pos: FINAL + 4, cue: 'lock', what: 'The heartbeat locks; ring-out to 12.0 s' },
    ],
  };
}
