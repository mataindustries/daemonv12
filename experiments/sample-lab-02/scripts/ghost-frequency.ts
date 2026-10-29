/** Sketch A — GHOST FREQUENCY. 96 BPM, one bar of 6/4 (3.750 s), E minor, felt as 3 + 3: a call and its answer.
 *
 * Everything is cut from one radio recording (intercept.wav) and the radio's own hum (hum.wav).
 *  - Call: the announcer's "E-CHO", as received (monotone B3). Its "cho" then comes back three times a dotted eighth
 *    apart, and each echo climbs: D4, E4, G4. Real echoes fall away; these climb the station's interval signal, so
 *    the word turns into a tune while you listen.
 *  - Answer: "NI-NER" (E4, D4) in the clear, then "O-VER" from the drifted second message, where the receiver had
 *    shifted every partial by +262 Hz: an inharmonic "duck" voice with the pilot whistle singing C4 inside it, then B3
 *    as the word sinks. The bar ends with the tuning sweep falling into zero beat exactly at the loop point, so the
 *    station comes back into tune on the next "E-CHO".
 *  - Drums are radio artifacts: the transmitter key-up thump is the kick, a lightning crash and the CW-filter crash are
 *    the snares, squelch-tail grains are the hats, and static ringing in the narrow filter is retuned into chord tones.
 *  - Bass: the receiver's 60 Hz ground-loop buzz, played as E | C -> B (i | VI -> V).
 * Run: node experiments/sample-lab-02/scripts/ghost-frequency.ts (writes projects/ghost-frequency.json) */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { clock, rate, type Ev, type Note } from './score.ts';
import { INTERCEPT_REGIONS as R, HUM_HZ, PING_HZ } from './ghost-sources.ts';

export const c = clock(96, '6/4', 1);
const RADIO = 'assets/sources/intercept.wav', HUM = 'assets/sources/hum.wav';
type Region = keyof typeof R;
/** A chop of the intercept: the named region at a pitch (semitones from the recording), with gate and envelope. */
function cut(name: Region | string, o: { semis?: number; playbackRate?: number; velocity: number; gate: string; attack?: number; release?: number; into?: number; end?: number; group?: string; glide?: [semis: number, duration: string] }): Omit<Note, 'start'> {
  const r = R[name as Region]; if (!r) throw new Error(`no region ${name}`);
  const pr = o.playbackRate ?? rate(o.semis ?? 0);
  return {
    velocity: o.velocity, offsetSeconds: r.start + (o.into ?? 0), endSeconds: o.end ?? r.end, ...(pr !== 1 ? { playbackRate: pr } : {}),
    gate: o.gate, envelope: { attackSeconds: o.attack ?? 0.002, releaseSeconds: o.release ?? 0.03 }, ...(o.group ? { chokeGroup: o.group } : {}),
    ...(o.glide ? { glide: { to: +(pr * 2 ** (o.glide[0] / 12)).toFixed(6), duration: o.glide[1] } } : {}),
  };
}
const ev = (beat: number, sixteenths: number, ms: number, note: Omit<Note, 'start'>): Ev => ({ ...c.at(beat, sixteenths, ms), note });

// ---------------------------------------------------------------- the hook (one track: the radio as found)
const RADIO_EVENTS: Ev[] = [
  // Call: "E-CHO" as received, then its echo climbing the interval signal.
  ev(1, 0, 0, cut('a.echo1.e', { velocity: 0.95, gate: '1/16', release: 0.02 })),
  ev(1, 1, 7, cut('a.echo1.cho', { velocity: 0.92, gate: '3/16', release: 0.05 })),
  ev(2, 0, 9, cut('a.echo2.cho', { semis: 3, velocity: 0.8, gate: '1/8', release: 0.06 })),
  ev(2, 3, 12, cut('a.echo1.cho', { semis: 5, velocity: 0.7, gate: '1/8', release: 0.06 })),
  ev(3, 2, 6, cut('a.echo2.cho', { semis: 8, velocity: 0.6, gate: '1/8', release: 0.08 })),
  // Answer: NI-NER in the clear, pushed; O-VER from the drifted message, sinking.
  ev(4, 0, -8, cut('a.niner.ni', { semis: 5, velocity: 0.9, gate: '1/8' })),
  ev(4, 2, 6, cut('a.niner.ner', { semis: 3, velocity: 0.84, gate: '3/16', release: 0.05 })),
  ev(5, 0, 14, cut('b.over.o', { velocity: 0.92, gate: '1/8' })),
  ev(5, 2, 10, cut('b.over.ver', { semis: -1, velocity: 0.86, gate: '3/16', release: 0.05, glide: [-2, '1/8'] })),
  // The dial: the last 0.46 s of the tuning sweep (470 Hz down to zero beat) lands on the loop point.
  { t: 5069, nominal: 5040, note: cut('sweep', { velocity: 0.72, gate: '3/16', into: 0.5, attack: 0.03, release: 0.01 }) },
];

// ---------------------------------------------------------------- static: snares, hats and tuned pings
const pingTo = (midi: number) => +(440 * 2 ** ((midi - 69) / 12) / PING_HZ).toFixed(6);
const hat = (beat: number, s: number, ms: number, v: number, into: number) => ev(beat, s, ms, cut('squelch1', { velocity: v, gate: '1/32', attack: 0.001, release: 0.012, into }));
const STATIC_EVENTS: Ev[] = [
  ev(3, 0, 22, cut('crash1', { velocity: 0.95, gate: '1/16', release: 0.05 })),
  ev(6, 0, 16, cut('crash2', { velocity: 0.9, gate: '1/16', release: 0.06 })),
  ev(4, 3, 8, cut('squelch2', { velocity: 0.32, gate: '1/32', release: 0.01 })),
  hat(1, 2, 12, 0.55, 0), hat(2, 1, 6, 0.28, 0.05), hat(2, 2, 16, 0.6, 0.02), hat(3, 2, 10, 0.48, 0.04),
  hat(4, 2, 14, 0.55, 0.01), hat(5, 2, 12, 0.6, 0.03), hat(5, 3, 8, 0.28, 0.06), hat(6, 2, 18, 0.5, 0),
  ev(1, 3, 5, cut('ping1', { playbackRate: pingTo(76), velocity: 0.5, gate: '1/8', release: 0.05 })),   // E5
  ev(3, 3, 8, cut('ping2', { playbackRate: pingTo(83), velocity: 0.42, gate: '1/8', release: 0.05 })),  // B5
  ev(6, 3, 6, cut('ping4', { playbackRate: pingTo(81), velocity: 0.42, gate: '1/8', release: 0.05 })),  // A5 into the turn
];

// ---------------------------------------------------------------- kick: the transmitter key-up thump
const kick = (beat: number, s: number, ms: number, v: number) => ev(beat, s, ms, cut('thump1', { playbackRate: 0.9, velocity: v, gate: '1/8', release: 0.03 }));
const KICK_EVENTS: Ev[] = [kick(1, 0, 0, 1), kick(2, 3, 14, 0.55), kick(4, 0, -4, 0.95), kick(4, 3, 10, 0.5), kick(5, 2, 6, 0.72)];

// ---------------------------------------------------------------- bass: the receiver's hum, retuned
const humRate = (midi: number) => +(440 * 2 ** ((midi - 69) / 12) / HUM_HZ).toFixed(6);
const E2 = 40, D2 = 38, C2 = 36, B1 = 35, G2 = 43, Ds2 = 39;
function bass(midi: number, velocity: number, gate: string, from?: number): Omit<Note, 'start'> {
  return { velocity, gate, playbackRate: humRate(from ?? midi), ...(from !== undefined ? { glide: { to: humRate(midi), duration: '1/16' } } : {}),
    envelope: { attackSeconds: 0.004, releaseSeconds: 0.045 }, chokeGroup: 'bass' };
}
const HUM_EVENTS: Ev[] = [
  ev(1, 0, 6, bass(E2, 0.95, '3/16')), ev(2, 0, 10, bass(E2, 0.55, '1/16')), ev(2, 3, 8, bass(G2, 0.6, '1/16')),
  ev(3, 0, 6, bass(E2, 0.82, '1/8')), ev(3, 3, 4, bass(D2, 0.6, '1/16')),
  ev(4, 0, 4, bass(C2, 0.95, '3/16')), ev(5, 0, 8, bass(C2, 0.6, '1/16')), ev(5, 2, 6, bass(B1, 0.9, '3/16', C2)),
  ev(6, 2, 4, bass(B1, 0.55, '1/16')), ev(6, 3, -6, bass(Ds2, 0.62, '1/16')),
];

export const TRACK_EVENTS: Record<string, Ev[]> = { radio: RADIO_EVENTS, static: STATIC_EVENTS, kick: KICK_EVENTS, hum: HUM_EVENTS };

/** `cycles` identical one-bar cycles: the delivered project uses two, the seam proof three. */
export function ghostFrequency(cycles = 2) {
  const o = { cycles };
  return {
    formatVersion: 1,
    title: 'GHOST FREQUENCY (SAMPLE LAB 02, sketch A)',
    description: 'A numbers-station voice turned into a hook: E-CHO and its climbing echoes, NI-NER, a frequency-shifted O-VER and the dial falling into zero beat at the loop point. Drums from radio artifacts, bass from the radio hum. 96 BPM, 6/4, one 3.75 s cycle; two cycles plus a bar of tail room, the deliverable is the second cycle.',
    bpm: c.bpm, timeSignature: c.ts, key: 'E minor', bars: cycles, seed: 1,
    render: { duration: { bars: cycles + 1 }, tail: 'auto' },
    master: {
      gainDb: -3.2,
      effects: [
        { type: 'highpass', frequencyHz: 30 },
        { type: 'compressor', thresholdDb: -17, ratio: 2.2, attackMs: 12, releaseMs: 140, makeupGainDb: 1.9 },
        { type: 'saturation', driveDb: 3, mix: 0.25 },
      ],
    },
    tracks: [
      c.track('radio', 'The hook: syllables of the intercepted announcement, a climbing echo, a drifted answer and the tuning sweep.', RADIO, RADIO_EVENTS,
        { ...o, gainDb: 0, effects: [{ type: 'highpass', frequencyHz: 170 }, { type: 'saturation', driveDb: 4, mix: 0.25 }, { type: 'reverb', roomSize: 0.35, decaySeconds: 0.9, wet: 0.12 }] }),
      c.track('static', 'Lightning crash and CW-crash snares, squelch-tail hats, static pings retuned to E5, B5 and A5.', RADIO, STATIC_EVENTS,
        { ...o, gainDb: 0.5, pan: 0.12, effects: [{ type: 'highpass', frequencyHz: 300 }] }),
      c.track('kick', 'The transmitter key-up thump, a little slower and deeper.', RADIO, KICK_EVENTS,
        { ...o, gainDb: -4.5, effects: [{ type: 'lowpass', frequencyHz: 1800 }, { type: 'saturation', driveDb: 6, mix: 0.4 }] }),
      c.track('hum', 'The receiver hum (60 Hz ground-loop buzz) retuned into a bassline: E | C -> B.', HUM, HUM_EVENTS,
        { ...o, gainDb: -5, effects: [{ type: 'lowpass', frequencyHz: 1400 }, { type: 'saturation', driveDb: 5, mix: 0.3 }] }),
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'projects', 'ghost-frequency.json');
  writeFileSync(out, JSON.stringify(ghostFrequency(), null, 2) + '\n');
  console.log(out);
}
