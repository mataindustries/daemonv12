/** Two 8-second hook/groove auditions over picture 0.000–8.000 (bars 1–5 at 150 BPM).
 * A: rhythm-forward "machine voice" groove. B: cinematic arp + electric cello. */
import { at, round6, type Hit, type Score, type TrackDef } from '../build-lib.ts';
import { bass, cello, choir, hat, kick, pluck, sfx, snare, strings, tom, voice, type VoiceParams } from '../synth/instruments.ts';

const ends: [number, number, boolean?][] = [[7.86, 0, true], [7.99, -40]];
const lane = (g: number) => ends.map(([t, v, l]) => [t, v === 0 ? g : v, l] as [number, number, boolean?]);
const reverb = (roomSize: number, decaySeconds: number, wet: number) => ({ type: 'reverb', roomSize, decaySeconds, wet });

// ------------------------------------------------------------------ shared rhythm section
function drums(halfTime: boolean): [Hit[], Hit[], Hit[]] {
  const k: Hit[] = [], sn: Hit[] = [], hh: Hit[] = [];
  for (let bar = 1; bar <= 5; bar++) {
    const steps = halfTime ? (bar === 4 ? [1, 4, 11] : [1, 11]) : [1, 9];
    for (const s of steps) {
      const time = at(bar, s);
      if (time >= 6.8 && halfTime && bar === 5 && s === 11) continue;
      k.push({ at: time, s: kick(bar === 2 && s === 1 ? 'land' : 'main'), v: s === 1 ? 1 : 0.8 });
    }
    if (halfTime) {
      if (bar < 5) sn.push({ at: at(bar, 9), s: snare('main'), v: 0.9 });
      if (bar >= 2) for (let s = 1; s <= 16; s++) {
        const time = at(bar, s); if (bar === 5 && time >= 6.8) break;
        if (s === 15 && bar % 2 === 0) { hh.push({ at: time, s: hat('open'), v: 0.5, choke: 'hh' }); continue; }
        hh.push({ at: time, s: hat('closed'), v: [0.55, 0.22, 0.38, 0.22][(s - 1) % 4]!, choke: 'hh' });
      }
      for (const s of [3, 7, 11, 15]) { const time = at(bar, s); if (!(bar === 5 && time >= 6.8)) hh.push({ at: time, s: hat('tick'), v: 0.45 }); }
    }
  }
  return [k, sn, hh];
}

// ------------------------------------------------------------------ A: MACHINE VOICE
const V = (midi: number, dur: number, vowels: VoiceParams['vowels'], extra: Partial<VoiceParams> = {}) => voice({ midi, dur, vowels, ...extra });
/** The hook: "wa-da-WAAH . . do-DOOO" — C C Eb … Db C over F minor. `top` lets it climb. */
export function hook(start: number, top = 75, level = 1): Hit[] {
  const s = (step: number) => round6(start + (step - 1) * 0.1);
  return [
    { at: s(1), v: 0.85 * level, s: V(72, 0.14, [[0, 'u'], [0.05, 'a']], { pitch: [[0, -2], [0.045, 0]] }) },
    { at: s(3), v: 0.7 * level, s: V(72, 0.08, [[0, 'a']]) },
    { at: s(4), v: 1 * level, s: V(top, 0.5, [[0, 'a'], [0.28, 'a'], [0.5, 'o']], { pitch: [[0, -1.2], [0.05, 0]], vib: { cents: 28, hz: 5.6, delay: 0.18 } }) },
    { at: s(10), v: 0.75 * level, s: V(73, 0.15, [[0, 'o']]) },
    { at: s(12), v: 0.9 * level, s: V(72, 0.42, [[0, 'o'], [0.3, 'u']], { pitch: [[0, 0], [0.3, 0], [0.42, -1]], vib: { cents: 32, hz: 5.4, delay: 0.1 } }) },
  ];
}
/** The bass riff (F minor): 3-3-2 syncopation answering the voice. */
export function riff(bar: number, variant: 'hook' | 'main' | 'shift', base = 29): Hit[] {
  const pattern: [number, number, number, number, number][] = variant === 'hook'
    ? [[1, 0, 0.3, 1, 0.55], [7, 3, 0.14, 0.4, 0.6], [11, 7, 0.1, 0.3, 0.5], [14, 10, 0.1, 0, 0.45], [16, 12, 0.08, 0, 0.5]]
    : [[1, 0, 0.28, 1, 0.55], [4, 12, 0.08, 0, 0.4], [6, 0, 0.08, 0, 0.35], [7, 3, 0.14, 0.5, 0.6], [10, 0, 0.08, 0, 0.35], [11, 7, 0.12, 0.3, 0.5], [13, 10, 0.1, 0, 0.45], [14, 12, 0.08, 0, 0.4], [16, 8, 0.08, 0, 0.45]];
  return pattern.map(([step, semis, dur, accent, cut]) => ({ at: at(bar, step), v: 0.85 + 0.15 * accent, s: bass({ midi: base + semis, dur, accent, cut, res: 0.6 }), gate: dur + 0.01, release: 0.012, choke: 'bass' }));
}

export function auditionA(): Score {
  const [k, sn, hh] = drums(true);
  const vox: Hit[] = [...hook(at(1)), ...hook(at(3), 75, 0.95), ...hook(at(4), 77, 1)];
  vox.push({ at: at(2, 13), v: 0.45, s: V(73, 0.1, [[0, 'o']]) }, { at: at(2, 14), v: 0.5, s: V(72, 0.3, [[0, 'o'], [0.2, 'u']], { vib: { cents: 30, hz: 5.4, delay: 0.08 } }) });
  // 6.800: the melody turns unstable — a triplet stutter that will not land, then the amber line.
  [0, 1, 2].forEach(i => vox.push({ at: round6(6.8 + i * 0.4 / 3), v: 0.8 - i * 0.1, s: V(73 - (i === 2 ? 1 : 0), 0.09, [[0, 'a'], [0.06, 'e']], { grit: 0.5 }) }));
  vox.push({ at: 7.2, v: 0.8, s: V(70, 0.28, [[0, 'e'], [0.2, 'a']], { grit: 0.3, pitch: [[0, 0], [0.18, 0], [0.28, -0.6]] }) });
  vox.push({ at: 7.5, v: 0.85, s: V(80, 1.5, [[0, 'i'], [0.3, 'a'], [1.5, 'o']], { pitch: [[0, 0.6], [0.08, 0], [0.5, 0], [1.5, -1]], vib: { cents: 22, hz: 5.1, delay: 0.3 } }) });
  const b: Hit[] = [...riff(1, 'hook'), ...riff(2, 'main'), ...riff(3, 'main'), ...riff(4, 'main')];
  // 6.800: the bass slips sideways to Gb and its pattern moves into triplets against the hats.
  b.push({ at: 6.4, v: 1, s: bass({ midi: 29, dur: 0.3, accent: 1, cut: 0.55, res: 0.6 }), gate: 0.31, release: 0.012, choke: 'bass' });
  [0, 3, 5, 6, 8].forEach((i, n) => b.push({ at: round6(6.8 + i * 0.4 / 3), v: n === 0 ? 1 : 0.85, s: bass({ midi: [30, 30, 42, 33, 30][n]!, dur: 0.11, accent: n === 0 ? 1 : 0.3, cut: 0.65, res: 0.65 }), gate: 0.12, release: 0.012, choke: 'bass' }));
  const trip: Hit[] = [];
  for (let t = 6.8; t < 7.99; t = round6(t + 0.4 / 3)) trip.push({ at: t, s: hat('accent'), v: 0.55 }, { at: round6(t + 0.2 / 3), s: hat('tick'), v: 0.3 });
  k.push({ at: 6.8, s: kick('main'), v: 1 }, { at: round6(7.2 + 0.4 / 3), s: kick('main'), v: 0.8 });
  sn.push({ at: round6(7.2 + 0.4 / 3 * 2), s: snare('main'), v: 0.9 });
  const ch: Hit[] = [
    ...[53, 56, 60, 67].map(m => ({ at: at(3), v: 0.5, s: choir({ midi: m, dur: 1.55, vowels: [[0, 'u'], [1, 'o']] }) })),
    ...[53, 56, 60, 63].map(m => ({ at: at(4), v: 0.5, s: choir({ midi: m, dur: 1.55, vowels: [[0, 'o'], [1, 'u']] }) })),
    ...[54, 58, 61, 65].map(m => ({ at: 6.8, v: 0.62, s: choir({ midi: m, dur: 1.2, vowels: [[0, 'a'], [0.8, 'o']], attack: 0.03 }) })),
  ];
  const fx: Hit[] = [{ at: 3.1, s: sfx('seat', 84), v: 0.8 }, { at: 5.5, s: sfx('servo', 54), v: 0.7 }, { at: 6.8, s: pluck({ midi: 66, dur: 0.18, bright: 0.9 }), v: 0.6 }];
  const tracks: TrackDef[] = [
    { id: 'kick', role: 'music', description: 'Machine kick; the unit landing at 1.6 is the bar-2 downbeat.', hits: k, gainDb: -4, effects: [{ type: 'highpass', frequencyHz: 28 }], gain: lane(-4) },
    { id: 'snare', role: 'music', description: 'Mechanical clap on the half-time backbeat; displaced at 6.8.', hits: sn, gainDb: -8, effects: [reverb(0.35, 0.8, 0.18)], gain: lane(-8) },
    { id: 'hats', role: 'music', description: '16th hats + escapement ticks; flip to triplets at 6.8.', hits: [...hh, ...trip], gainDb: -13, effects: [{ type: 'highpass', frequencyHz: 3000 }], gain: lane(-13) },
    { id: 'bass', role: 'music', description: 'Ladder acid bass riff, F minor; slips to Gb triplets at 6.8.', hits: b, gainDb: -7, effects: [{ type: 'highpass', frequencyHz: 30 }, { type: 'saturation', driveDb: 3, mix: 0.25 }], gain: lane(-7) },
    { id: 'voice', role: 'music', description: 'The machine voice hook.', hits: vox, gainDb: -5, effects: [{ type: 'highpass', frequencyHz: 160 }, { type: 'compressor', thresholdDb: -20, ratio: 3, attackMs: 4, releaseMs: 90, makeupGainDb: 2 }, { type: 'delay', timeMs: 300, wet: 0.14 }, reverb(0.5, 1.3, 0.16)], gain: lane(-5) },
    { id: 'choir', role: 'music', description: 'Machine choir chords; Gb (bII) at the contradiction.', hits: ch, gainDb: -12, effects: [{ type: 'highpass', frequencyHz: 140 }, reverb(0.75, 2.2, 0.3)], gain: lane(-12) },
    { id: 'sfx', role: 'sound-design', description: 'Plate seat (3.1), servo slide (5.5-6.8), contradiction stab.', hits: fx, gainDb: -10, effects: [reverb(0.4, 0.9, 0.15)], gain: lane(-10) },
  ];
  return { id: 'audition-a', title: 'PermitPulse challenger - Audition A (machine voice groove)', description: 'Direction A: rhythm-forward 150 BPM half-time groove, ladder acid bass riff, formant machine voice hook. Picture 0.000-8.000.', seconds: 8, tracks,
    master: { gainDb: 3, effects: [{ type: 'compressor', thresholdDb: -16, ratio: 2, attackMs: 15, releaseMs: 160 }] },
    sync: [{ id: 'hook', track: 'voice', at: 0, roles: ['hook'] }, { id: 'unit-lands', track: 'kick', at: 1.6, roles: ['land'] }, { id: 'seat', track: 'sfx', at: 3.1, roles: ['seat'] }, { id: 'b-reveal', track: 'sfx', at: 5.5, roles: ['slide'] }, { id: 'disagree', track: 'bass', at: 6.8, roles: ['shift'] }, { id: 'amber', track: 'voice', at: 7.5, roles: ['trace'] }] };
}

// ------------------------------------------------------------------ B: ELECTRIC CELLO
export function auditionB(): Score {
  const chords: number[][] = [[41, 48, 44, 48, 51, 48, 44, 48], [37, 44, 41, 44, 48, 44, 41, 44], [41, 48, 44, 48, 51, 48, 44, 48], [39, 46, 43, 46, 50, 46, 43, 46], [41, 48, 44, 48, 53, 48, 44, 48]];
  const arp: Hit[] = [];
  for (let bar = 1; bar <= 5; bar++) for (let s = 1; s <= 16; s++) {
    const time = at(bar, s); let midi = chords[bar - 1]![(s - 1) % 8]! + 12;
    if (bar === 5 && time >= 6.8) midi = [42, 49, 46, 49, 53, 49, 46, 49][(s - 1) % 8]! + 12; // Gb: the harmony slips
    arp.push({ at: time, s: pluck({ midi, dur: 0.09, bright: 0.35 + 0.1 * (bar - 1) }), v: [0.9, 0.5, 0.7, 0.5][(s - 1) % 4]! });
  }
  const roots = [29, 25, 29, 27, 29];
  const bs: Hit[] = [];
  for (let bar = 1; bar <= 5; bar++) for (let e = 0; e < 8; e++) {
    const time = round6(at(bar) + e * 0.2), root = bar === 5 && time >= 6.8 ? 30 : roots[bar - 1]!;
    bs.push({ at: time, s: bass({ midi: root + (e % 2 ? 12 : 0), dur: 0.12, cut: 0.25, res: 0.3 }), v: e % 2 ? 0.7 : 0.95, gate: 0.13, release: 0.015, choke: 'bass' });
  }
  const C = (midi: number, dur: number, extra = {}) => cello({ midi, dur, ...extra });
  const lead: Hit[] = [
    { at: 0, s: C(65, 0.65, { scoop: -1 }), v: 0.9 }, { at: 0.7, s: C(68, 0.25), v: 0.8 }, { at: 1.0, s: C(72, 0.55, { swell: 0.8 }), v: 0.9 },
    { at: 1.6, s: C(73, 0.95, { scoop: -1, swell: 1 }), v: 1 }, { at: 2.6, s: C(72, 0.28), v: 0.8 }, { at: 2.9, s: C(70, 0.28), v: 0.8 },
    { at: 3.2, s: C(68, 0.58), v: 0.85 }, { at: 3.8, s: C(67, 0.18), v: 0.7 }, { at: 4.0, s: C(68, 0.18), v: 0.75 }, { at: 4.2, s: C(72, 0.55), v: 0.85 },
    { at: 4.8, s: C(75, 1.1, { swell: 1 }), v: 1 }, { at: 6.0, s: C(74, 0.35), v: 0.8 },
    { at: 6.4, s: C(77, 0.38, { scoop: -2, swell: 0.6 }), v: 1 }, { at: 6.8, s: C(78, 0.5, { scoop: 1, swell: 0.2 }), v: 1 }, { at: 7.4, s: C(77, 0.55, { scoop: 1 }), v: 0.85 },
  ];
  const toms: Hit[] = [];
  for (let bar = 1; bar <= 5; bar++) for (const [s, m] of [[1, 41], [7, 48], [11, 44]] as const) toms.push({ at: at(bar, s), s: tom({ midi: m }), v: s === 1 ? 1 : 0.7 });
  const k: Hit[] = [1, 2, 3, 4, 5].map(bar => ({ at: at(bar), s: kick(bar === 2 ? 'land' : 'deep'), v: 1 }));
  k.push({ at: 6.8, s: kick('main'), v: 1 });
  const pad: Hit[] = [[41, 44, 48], [37, 41, 44], [41, 44, 48], [39, 43, 46], [41, 44, 48]].flatMap((chord, i) => chord.map(m => ({ at: at(i + 1), s: strings({ midi: m + 12, dur: i === 4 ? 0.38 : 1.55 }), v: 0.6 })));
  pad.push(...[42, 46, 49].map(m => ({ at: 6.8, s: strings({ midi: m + 12, dur: 1.2 }), v: 0.7 })));
  const fx: Hit[] = [{ at: 3.1, s: sfx('seat', 84), v: 0.8 }, { at: 5.5, s: sfx('servo', 54), v: 0.7 }, { at: 6.8, s: snare('big'), v: 0.8 }];
  const tracks: TrackDef[] = [
    { id: 'drums', role: 'music', description: 'Deep kicks and tuned toms (F, C, Ab).', hits: [...k, ...toms], gainDb: -6, effects: [{ type: 'highpass', frequencyHz: 28 }, reverb(0.5, 1.2, 0.12)], gain: lane(-6) },
    { id: 'bass', role: 'music', description: 'Pulsing 8th-note octave bass.', hits: bs, gainDb: -9, effects: [{ type: 'highpass', frequencyHz: 30 }], gain: lane(-9) },
    { id: 'arp', role: 'music', description: '16th-note plucked arpeggio: Fm, Db, Fm, Eb, Fm, then Gb at 6.8.', hits: arp, gainDb: -10, effects: [{ type: 'highpass', frequencyHz: 150 }, { type: 'delay', timeMs: 300, wet: 0.18 }, reverb(0.6, 1.6, 0.2)], gain: lane(-10) },
    { id: 'cello', role: 'music', description: 'Electric cello melody, climbing to F5 and crying a semitone up at 6.8.', hits: lead, gainDb: -5, effects: [{ type: 'highpass', frequencyHz: 120 }, reverb(0.7, 2.0, 0.24)], gain: lane(-5) },
    { id: 'strings', role: 'music', description: 'Detuned string-synth chords.', hits: pad, gainDb: -14, effects: [{ type: 'highpass', frequencyHz: 160 }, reverb(0.8, 2.6, 0.3)], gain: lane(-14) },
    { id: 'sfx', role: 'sound-design', description: 'Plate seat, servo slide, contradiction crack.', hits: fx, gainDb: -10, effects: [reverb(0.5, 1.2, 0.2)], gain: lane(-10) },
  ];
  return { id: 'audition-b', title: 'PermitPulse challenger - Audition B (electric cello pulse)', description: 'Direction B: cinematic-electronic 150 BPM arp pulse, tuned toms, electric cello melody. Picture 0.000-8.000.', seconds: 8, tracks,
    master: { gainDb: 3, effects: [{ type: 'compressor', thresholdDb: -16, ratio: 2, attackMs: 15, releaseMs: 160 }] },
    sync: [{ id: 'hook', track: 'cello', at: 0, roles: ['hook'] }, { id: 'unit-lands', track: 'drums', at: 1.6, roles: ['land'] }, { id: 'seat', track: 'sfx', at: 3.1, roles: ['seat'] }, { id: 'b-reveal', track: 'sfx', at: 5.5, roles: ['slide'] }, { id: 'disagree', track: 'cello', at: 6.8, roles: ['shift'] }] };
}
