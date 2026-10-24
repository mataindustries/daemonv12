/** MORPH//08 MOTOR GROOVE: two arrangements around the unchanged HYPNOTIC MOTOR.
 *
 * The motor (MORPH//07 `hypnoticMotor()`, rendered by `motor.ts`) is the timing master.
 * Every other part is an existing DaemonV12 or MORPH one-shot played by the engine's own
 * sampler, placed on the frame where the motor actually struck that sixteenth, so the
 * band inherits the machine's swing, its beat-4 drag and its landing after the brake.
 * Pitched parts are tuned with playbackRate to the motor's just intonation on A1 = 55 Hz,
 * so they never beat against the stator tines. Nothing here synthesizes sound.
 */
import { formatPosition, usPerQuarter } from '../../src/timing/musical-time.ts';
import type { ScheduledEvent } from '../../src/sync/index.ts';

export const BPM = 120, BARS = 4, SLOTS = 64, RATE = 44100;
const TEMPO = usPerQuarter(BPM), SLOT_FRAMES = RATE * 60 / BPM / 4, FRAMES_PER_TICK = RATE * TEMPO / 960 / 1e6;
const METER = { numerator: 4, denominator: 4 };

// Just ratios above A, the same 5-limit tuning as the motor's stator gears.
const RATIOS: Record<string, number> = { A: 1, 'A#': 16 / 15, B: 9 / 8, C: 6 / 5, 'C#': 5 / 4, D: 4 / 3, 'D#': 45 / 32, E: 3 / 2, F: 8 / 5, 'F#': 5 / 3, G: 9 / 5, 'G#': 15 / 8 };
/** Frequency of a scientific pitch name ("E5", "G#3") in just intonation on A1 = 55 Hz. */
export function hz(note: string): number {
  const m = /^([A-G]#?)(-?\d)$/.exec(note);
  if (!m || RATIOS[m[1]!] === undefined) throw new RangeError(`Unknown note ${note}.`);
  const octave = Number(m[2]), letter = m[1]!;
  // Scientific octaves change at C, so C..G# sit above the A of the octave below.
  return 55 * 2 ** (octave - 1 - (letter.startsWith('A') || letter === 'B' ? 0 : 1)) * RATIOS[letter]!;
}

/** A one-shot under examples/assets and the pitch it sounds at playbackRate 1. */
export interface Sound { file: string; hz?: number }
export const sounds = {
  kick: { file: 'orbital-foundry/02-mechanical-kick.wav', hz: 68 },     // falling pitch into a 68 Hz mass
  sub: { file: 'glasshouse/07-sub-cs.wav', hz: 69.296 },                // clean C#2 sine body
  cable: { file: 'morph-v1/cable-pluck.wav', hz: 55 },                  // MORPH cable, already on A1
  glass: { file: 'glasshouse/01-glass-hit.wav', hz: 554.365 },          // C#5 glass strike
  vox: { file: 'glasshouse/04-ghost-vox.wav', hz: 277.183 },            // synthetic "oh-ah" voice, C#4
  clap: { file: 'glasshouse/08-chrome-clap.wav', hz: 207.65 },          // clap with a G#3 body
  hat: { file: 'glasshouse/09-pixel-hat.wav' },                         // 6-12 kHz tick
} satisfies Record<string, Sound>;

export interface Hit { slot: number; velocity: number; note?: string; gate?: string; release?: number; offset?: number }
export interface Duck { depthDb: number; releaseMs: number }
export interface Part {
  id: string; description: string; sound: Sound; hits: Hit[];
  gainDb: number; pan?: number; duck?: boolean;
  stem: string;                 // delivered stem this part is summed into
  roles: string[];              // Sync Pack visual roles for its events
}
export const motorStems = ['tines', 'housing', 'chassis', 'hum', 'room'] as const;
/** The motor bus: its five pre-master stems rebalanced (dB), then MORPH//07's own drive
 * curve, then a level (dB) and optionally the kick-keyed duck. */
export interface MotorMix { balance: Record<typeof motorStems[number], number>; level: number; duck: boolean }
export interface Arrangement {
  id: string; title: string; description: string;
  motor: MotorMix;
  duck: Duck;                   // kick-keyed gain dip on the motor bus and on parts with `duck`
  parts: Part[];
}

/** Drum grid: one character per sixteenth, bars separated by spaces. X 1.0, x 0.85, o 0.6, - 0.35. */
function grid(pattern: string, extra: Omit<Hit, 'slot' | 'velocity'> = {}): Hit[] {
  const cells = pattern.replaceAll(' ', '');
  if (cells.length !== SLOTS) throw new RangeError(`A grid needs ${SLOTS} cells: ${pattern}`);
  const velocity: Record<string, number> = { X: 1, x: 0.85, o: 0.6, '-': 0.35 };
  return [...cells].flatMap((c, slot) => c === '.' ? [] : [{ slot, velocity: velocity[c]!, ...extra }]);
}
/** Pitched hits: [bar, step, note, velocity, gate?]. Bars are 1-based, steps 0-15. */
function line(notes: [number, number, string, number, string?][], extra: Omit<Hit, 'slot' | 'velocity' | 'note' | 'gate'> = {}): Hit[] {
  return notes.map(([bar, step, note, velocity, gate]) => ({ slot: 16 * (bar - 1) + step, note, velocity, ...(gate ? { gate } : {}), ...extra }));
}
/** The clap's tonal body follows the harmony: G#3 under the motor's E7 (bar 3, beats 3-4), else A3. */
const clapBody = (hits: Hit[]) => hits.map(h => ({ ...h, note: h.slot >= 40 && h.slot < 48 ? 'G#3' : 'A3' }));

// ---------------------------------------------------------------------------------------
// The motor's form, which both arrangements follow: bar 1 Am7, bar 2 Fmaj7, bar 3 half
// speed Dm7 -> E7, bar 4 spin-up into the A overtone lock (beats 1-2), brake, Am (beats 3-4).

// A: LOCKSTEP. Minimal and rhythm-first; the motor stays the star. A deep kick on every
// beat locks to the motor's quarter contacts, a sine sub breathes on the offbeats and
// hands the low end to the motor's own A1 hum during the lock. The glass answers the
// motor's arpeggio with one falling cell (E-C-A on its accents 1a, 2&, 3&), sighs F-E in
// the heavy bar and rings the lock's major third, C#, exactly as the rotor locks.
export const lockstep: Arrangement = {
  id: 'lockstep', title: 'A — LOCKSTEP',
  description: 'MORPH//08 A: minimal, hypnotic, rhythm-first. The unchanged HYPNOTIC MOTOR leads; kick, offbeat sub, one glass cell and restrained clap/hat lock to its swung contacts. 120 BPM, A minor, seamless 8 s loop.',
  motor: { balance: { tines: 0, housing: 1, chassis: -5, hum: 2, room: 0 }, level: -12, duck: true },
  duck: { depthDb: 3, releaseMs: 140 },
  parts: [
    { id: 'kick', stem: 'kick', description: 'Orbital Foundry mechanical kick tuned to A1, every beat; drops beat 2 of bar 4 so the lock sings alone.',
      sound: sounds.kick, gainDb: -5.5, roles: ['impact', 'kick', 'low-end'],
      hits: grid('X...x...x...x... x...x...x...x... x...x...x...x... x.......x...x...', { note: 'A1' }) },
    { id: 'sub', stem: 'bass', description: 'GLASSHOUSE sine sub on the offbeat eighths: A1, F1, D2/E2; rests while the motor hum is the bass.',
      sound: sounds.sub, gainDb: -10.5, roles: ['bass', 'low-end', 'pitch'],
      hits: line([
        [1, 2, 'A1', 0.9], [1, 6, 'A1', 0.9], [1, 10, 'A1', 0.9], [1, 14, 'A1', 0.9],
        [2, 2, 'F1', 0.9], [2, 6, 'F1', 0.9], [2, 10, 'F1', 0.9], [2, 14, 'F1', 0.9],
        [3, 2, 'D2', 0.9], [3, 6, 'D2', 0.9], [3, 10, 'E2', 0.9], [3, 14, 'E2', 0.9],
        [4, 10, 'A1', 0.9], [4, 14, 'A1', 0.9],
      ].map(n => [...n, '1/16'] as [number, number, string, number, string]), { release: 0.06 }) },
    { id: 'glass', stem: 'lead', description: 'GLASSHOUSE glass in just intonation: E5-C5-A4 on the motor accents, F5-E5 in the heavy bar, C#5 on the lock.',
      sound: sounds.glass, gainDb: -8.5, pan: 0.15, roles: ['melody', 'hook', 'pitch'],
      hits: line([
        [1, 3, 'E5', 0.8], [1, 6, 'C5', 0.7], [1, 10, 'A4', 0.75],
        [2, 3, 'E5', 0.8], [2, 6, 'C5', 0.7], [2, 10, 'A4', 0.75],
        [3, 2, 'F5', 0.8], [3, 10, 'E5', 0.7],
        [4, 4, 'C#5', 0.85],
      ]) },
    { id: 'clap', stem: 'perc', description: 'GLASSHOUSE chrome clap, body tuned to the chord (A3, G#3 under E7): backbeat, half-time in the heavy bar.',
      sound: sounds.clap, gainDb: -5, pan: -0.1, roles: ['impact', 'backbeat'],
      hits: clapBody(grid('....o.......o... ....o.......o... ........o....... ............o...')) },
    { id: 'hat', stem: 'perc', description: 'GLASSHOUSE pixel hat on the offbeats, a swung ghost into each phrase turn.',
      sound: sounds.hat, gainDb: -8, pan: 0.25, roles: ['hat', 'tick'],
      hits: grid('..o...o...o...o. ..o...o...o...o- ..o...o...o...o. ..........o...o-') },
  ],
};

// B: OVERTONE. Melodic and energetic; the motor is a distinctive rhythmic voice inside a
// complete track. The MORPH cable bass plays the motor's own accent pattern (1, 2&, 3&)
// with an octave pickup; a synthetic voice sings the hook (A-C-E, then D-C / F-E), falls
// through the heavy bar to the leading tone and resolves to A exactly as the motor spins
// up into its A overtone lock, turning the minor loop briefly major before the brake.
export const overtone: Arrangement = {
  id: 'overtone', title: 'B — OVERTONE',
  description: 'MORPH//08 B: melodic and energetic. The unchanged HYPNOTIC MOTOR becomes the rhythmic engine of a full track: four-on-the-floor kick, MORPH cable bass on the motor accents, a sung hook that resolves into the overtone lock. 120 BPM, A minor, seamless 8 s loop.',
  motor: { balance: { tines: -6, housing: 0, chassis: -9, hum: 0, room: -3 }, level: -8, duck: true },
  duck: { depthDb: 4, releaseMs: 160 },
  parts: [
    { id: 'kick', stem: 'kick', description: 'Orbital Foundry mechanical kick tuned to A1, four on the floor.',
      sound: sounds.kick, gainDb: -2, roles: ['impact', 'kick', 'low-end'],
      hits: grid('X...x...x...x... x...x...x...x... x...x...x...x... x...x...x...x...', { note: 'A1' }) },
    { id: 'bass', stem: 'bass', description: 'MORPH cable pluck on the motor accents (1, 2&, 3&) with an octave pickup; half-time in the heavy bar.',
      sound: sounds.cable, gainDb: 8, duck: true, roles: ['bass', 'low-end', 'pitch'],
      hits: line([
        [1, 0, 'A1', 0.95, '1/8'], [1, 6, 'A1', 0.8, '1/8'], [1, 10, 'A1', 0.85, '1/8'], [1, 14, 'A2', 0.7, '1/16'],
        [2, 0, 'F1', 0.95, '1/8'], [2, 6, 'F1', 0.8, '1/8'], [2, 10, 'F1', 0.85, '1/8'], [2, 14, 'F2', 0.7, '1/16'],
        [3, 0, 'D2', 0.95, '3/16'], [3, 6, 'D2', 0.75, '1/8'], [3, 8, 'E2', 0.9, '3/16'], [3, 14, 'E2', 0.75, '1/8'],
        [4, 0, 'A1', 0.95, '1/8'], [4, 8, 'A1', 0.9, '1/8'], [4, 10, 'A1', 0.8, '1/8'], [4, 14, 'A2', 0.7, '1/16'],
      ], { release: 0.03 }) },
    { id: 'vox', stem: 'lead', description: 'GLASSHOUSE ghost voice held on its open "ah", sung in just intonation from A3 to F4.',
      sound: sounds.vox, gainDb: -7, pan: 0, roles: ['melody', 'hook', 'voice', 'pitch'],
      hits: line([
        [1, 0, 'A3', 0.8, '1/8'], [1, 3, 'C4', 0.75, '1/8'], [1, 6, 'E4', 0.85, '3/16'], [1, 10, 'D4', 0.7, '1/16'], [1, 12, 'C4', 0.75, '3/16'],
        [2, 0, 'A3', 0.8, '1/8'], [2, 3, 'C4', 0.75, '1/8'], [2, 6, 'E4', 0.85, '3/16'], [2, 10, 'F4', 0.8, '1/16'], [2, 12, 'E4', 0.75, '3/16'],
        [3, 0, 'F4', 0.85, '3/16'], [3, 6, 'E4', 0.7, '1/8'], [3, 8, 'D4', 0.8, '3/16'], [3, 12, 'B3', 0.7, '1/8'], [3, 14, 'G#3', 0.75, '1/8'],
        [4, 0, 'A3', 0.9, '3/8'], [4, 8, 'E4', 0.8, '1/8'], [4, 11, 'D4', 0.7, '1/16'], [4, 14, 'C4', 0.75, '1/8'],
      ], { offset: 0.2, release: 0.05 }) },
    { id: 'clap', stem: 'perc', description: 'GLASSHOUSE chrome clap on 2 and 4, body tuned to the chord (A3, G#3 under E7); beat 2 of bar 4 lands on the lock.',
      sound: sounds.clap, gainDb: -3.5, pan: -0.1, roles: ['impact', 'backbeat'],
      hits: clapBody(grid('....x.......x... ....x.......x... ....x.......x... ....x.......x...')) },
    { id: 'hat', stem: 'perc', description: 'GLASSHOUSE pixel hat: offbeats with swung "a" ghosts; straight eighths in the heavy bar.',
      sound: sounds.hat, gainDb: -6.5, pan: 0.25, roles: ['hat', 'tick'],
      hits: grid('..o-..o-..o-..o- ..o-..o-..o-..o- ..o...o...o...o. ..o-..o-..o-..o-') },
  ],
};

export const arrangements = [lockstep, overtone];

/** Motor-locked frames for the 64 sixteenths: the motor's own strike (a commutator impact,
 * or the arrival of a scored pitch lock) within ±0.4 sixteenth of the slot, else the
 * motor's cruise swing (odd sixteenths +22.2 ms, the whole grid +1.5 ms). */
export function motorGrid(events: readonly ScheduledEvent[]): { frames: number[]; locked: boolean[] } {
  const anchors = events.filter(e => e.trackId === 'commutator' || e.trackId === 'voice').map(e => e.sampleFrame);
  const frames: number[] = [], locked: boolean[] = [];
  for (let slot = 0; slot < SLOTS; slot++) {
    const nominal = slot * SLOT_FRAMES;
    let best = -1;
    for (const frame of anchors) if (Math.abs(frame - nominal) <= 0.4 * SLOT_FRAMES && (best < 0 || Math.abs(frame - nominal) < Math.abs(best - nominal))) best = frame;
    locked.push(best >= 0);
    frames.push(best >= 0 ? best : Math.round(nominal + (slot % 2 ? 979 : 64)));
  }
  return { frames, locked };
}

const round6 = (x: number) => Number(x.toFixed(6));
/** The engine project for an arrangement: one sampler track per part, one four-bar pattern. */
export function engineProject(a: Arrangement, frames: readonly number[]) {
  const tick = (slot: number) => Math.round(frames[slot]! / FRAMES_PER_TICK);
  return {
    formatVersion: 1, title: a.title, description: a.description, bpm: BPM, timeSignature: '4/4', key: 'A minor', bars: BARS, seed: 8,
    tracks: a.parts.map(part => ({
      id: part.id, description: part.description, instrument: { type: 'sampler', sample: `assets/${part.sound.file}` },
      patterns: [{ id: 'loop', bars: BARS, notes: part.hits.map(h => {
        const rate = h.note && part.sound.hz ? round6(hz(h.note) / part.sound.hz) : 1;
        const articulated = h.gate !== undefined || h.release !== undefined;
        return { start: formatPosition(tick(h.slot), METER), velocity: h.velocity,
          ...(rate !== 1 ? { playbackRate: rate } : {}), ...(h.offset ? { offsetSeconds: h.offset } : {}),
          ...(h.gate ? { gate: h.gate } : {}), ...(articulated ? { envelope: { releaseSeconds: h.release ?? 0.005 } } : {}) };
      }) }],
      clips: [{ bar: 1, pattern: 'loop' }],
    })),
  };
}
