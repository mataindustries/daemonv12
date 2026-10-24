/** MORPH//07 scores. Musical positions use the engine's 960 PPQ rounding rule
 * (ticksToFrames: nearest sample frame, ties later); emergent rotor events are
 * timed by the simulation itself. */
import { ticksToFrames, usPerQuarter } from '../../src/timing/musical-time.ts';
import { RATE, Rotor, laneNames, type Contact, type Curve, type Gear, type LaneName, type Mark, type Motor, type Point, type Score } from './motor.ts';

/** Frames after `origin` for a position in quarter notes on the 960 PPQ grid. */
function clock(bpm: number, origin = 0) {
  const tempo = usPerQuarter(bpm);
  return (quarters: number) => {
    const tick = quarters * 960;
    if (!Number.isInteger(tick)) throw new RangeError(`${quarters} quarters is off the 960 PPQ grid.`);
    return origin + ticksToFrames(tick, tempo);
  };
}
const p = (frame: number, value: number, curve?: Curve, mark?: Mark): Point => ({ frame, value, ...(curve ? { curve } : {}), ...(mark ? { mark } : {}) });
/** Just intonation against a reference, so tines can lock onto rotor harmonics exactly. */
const ji = (reference: number, ...ratios: number[]) => ratios.map(r => reference * r);
const defaults: Record<LaneName, number> = { speed: 0.5, servo: 1, torque: 160, push: 0, cogging: 0, friction: 0.35, load: 0, brush: 1,
  damping: 1, coil: 2600, tines: 1, clicks: 0.55, chassis: 0.9, hum: 0, room: 0.16 };
function lanes(spec: Partial<Record<LaneName, Point[]>>): Record<LaneName, Point[]> {
  return Object.fromEntries(laneNames.map(name => [name, spec[name] ?? [p(0, defaults[name])]])) as Record<LaneName, Point[]>;
}
const housing = [{ hz: 410, q: 3.5, gain: 1 }, { hz: 1150, q: 7, gain: 0.8 }, { hz: 2700, q: 9, gain: 0.5 }];

/** Run only the mechanics, visiting the rotor after each frame until `visit` returns true. */
function runRotor(score: Score, frames: number, visit: (n: number, rotor: Rotor) => boolean | void): void {
  const rotor = new Rotor(score);
  for (let n = 0; n < frames; n++) { rotor.step(n); if (visit(n, rotor)) return; }
}

// ---------------------------------------------------------------------------------------
// A: THE HYPNOTIC MOTOR. 120 BPM, one revolution per bar, 16 contacts = sixteenths.
// The commutator is the groove; cogging (8 detents/rev) swings the sixteenths at cruise
// speed. Bar 3 is put under load at half speed; bar 4 spins the same geometry into an A1
// pitch whose overtones lock the stator, then brakes back onto the grid so it loops.
const hypnoticContacts: Contact[] = [
  { step: 0, amp: 1.0, tine: 0, chassis: 1.0, click: 1.0 },
  { step: 1, amp: 0.3, click: 0.55 },
  { step: 2, amp: 0.55, tine: 2, click: 0.8 },
  { step: 3, amp: 0.7, tine: 1, click: 0.9 },
  { step: 4, amp: 0.42, click: 1.0 },
  { step: 5, amp: 0.3, click: 0.55 },
  { step: 6, amp: 0.85, tine: 3, chassis: 0.65, click: 0.9 },
  { step: 7, amp: 0.32, click: 0.55 },
  { step: 8, amp: 0.6, tine: 0, click: 0.9 },
  { step: 9, amp: 0.3, click: 0.55 },
  { step: 10, amp: 0.8, tine: 2, chassis: 0.55, click: 0.9 },
  { step: 11, amp: 0.65, tine: 4, click: 0.8 },
  { step: 12, amp: 0.45, click: 1.0 },
  { step: 13, amp: 0.55, tine: 3, click: 0.7 },
  { step: 14, amp: 0.7, tine: 1, click: 0.9 },
  { step: 15, amp: 0.38, click: 0.6 },
];
const A1 = 55;
const hypnoticGears: Gear[] = [
  { name: 'i', chord: 'Am7 (just)', hz: ji(A1, 2, 3, 4, 24 / 5, 7) },
  { name: 'VI', chord: 'Fmaj7 (just)', hz: ji(A1, 8 / 5, 12 / 5, 16 / 5, 4, 6) },
  { name: 'iv', chord: 'Dm7 (just)', hz: ji(A1, 4 / 3, 2, 8 / 3, 16 / 5, 24 / 5) },
  { name: 'V', chord: 'E7 (just)', hz: ji(A1, 3 / 2, 9 / 4, 3, 15 / 4, 16 / 3) },
  { name: 'lock', chord: 'A overtones 2:3:4:5:7', hz: ji(A1, 2, 3, 4, 5, 7) },
];
export function hypnoticMotor(): Score {
  // One bar of mechanics-only pre-roll starts the loop mid-groove. Cogging pulls the even
  // sixteenths ~4.5 ms early, so the grid sits 6 ms late: the downbeat lands just after the
  // first sample and the closing downbeat just past the seam, never twice.
  const q = clock(120), preroll = q(4), grid = -0.003;
  const motor: Motor = { steps: 16, contacts: hypnoticContacts, cogs: 8, cogPhase: 0, chassisHz: A1, edgeMs: 1.0, fusionKnee: 4, housing, spark: 0.9, brushHz: 4800, drive: 2.4, seed: 707 };
  // Tempo changes are linear ramps centred on the bar line, so the grid phase is unchanged.
  const ramp = 1378, climb = q(12), arrive = q(13), brakeFrames = Math.round(0.16 * RATE);
  const speed = (brakeStart: number) => [p(0, 0.5), p(q(8) - ramp, 0.5, undefined, { id: 'half-time', roles: ['torque', 'load', 'decelerate'], velocity: 0.5 }),
    p(q(8) + ramp, 0.25, 'linear'), p(climb, 0.25, undefined, { id: 'spin-up', roles: ['torque', 'accelerate'], velocity: 1 }), p(arrive, A1, 'exp'),
    p(brakeStart, A1, undefined, { id: 'brake', roles: ['torque', 'brake'], velocity: 1 }), p(brakeStart + brakeFrames, 0.5, 'smooth')];
  const base = (speedLane: Point[]): Score => ({ id: 'hypnotic-motor', title: 'THE HYPNOTIC MOTOR', bpm: 120, meter: '4/4', frames: q(16),
    tailFrames: Math.round(2.5 * RATE), loop: true, preroll, initial: { angle: grid - 1, speed: 0.5, reference: grid - 1 }, motor, gears: hypnoticGears, gearChanges: [],
    lanes: lanes({ speed: speedLane }), jolts: [], sections: [], notes: [] });
  // The servo locks modulo one revolution: slide the brake so step 8 lands on beat 3 of bar 4.
  const phase = (brakeStart: number) => {
    let reference = 0;
    runRotor(base(speed(brakeStart)), q(14), (n, rotor) => { if (n === q(14) - 1) reference = rotor.reference; });
    return reference;
  };
  let brakeStart = q(14) - brakeFrames - 3500;
  const miss = phase(brakeStart) - grid - 0.5;
  brakeStart -= Math.round((miss - Math.round(miss)) / ((A1 - 0.5) / RATE));
  return {
    ...base(speed(brakeStart)),
    gearChanges: [{ frame: 0, gear: 0, glideMs: 1 }, { frame: q(4), gear: 1, glideMs: 28 }, { frame: q(8), gear: 2, glideMs: 40 },
      { frame: q(10), gear: 3, glideMs: 30 }, { frame: climb, gear: 4, glideMs: 40 }, { frame: q(14), gear: 0, glideMs: 30 }],
    lanes: lanes({
      speed: speed(brakeStart),
      torque: [p(0, 160), p(climb, 160), p(climb + 1, 900, 'step'), p(q(14) + 2205, 900), p(q(14) + 2206, 160, 'step')],
      cogging: [p(0, 3.6), p(q(8) - ramp, 3.6), p(q(8) + ramp, 0.5, 'linear'), p(q(14), 0.5), p(q(14) + 4410, 3.6, 'linear')],
      load: [p(0, 0), p(q(7), 1.3, 'step', { id: 'drag', roles: ['torque', 'load'], velocity: 0.4 }),
        p(q(7.5), 0, 'step', { id: 'release', roles: ['torque', 'release'], velocity: 0.4 })],
      brush: [p(0, 0.92), p(q(4), 1.0, 'smooth'), p(q(8), 1.08, 'smooth'), p(climb, 1.0), p(arrive, 1.25, 'smooth'), p(q(14), 0.92, 'smooth')],
      damping: [p(0, 1.0), p(q(8), 1.25, 'smooth'), p(climb, 1.25), p(arrive, 0.9, 'smooth'), p(q(14), 1.0, 'smooth')],
      tines: [p(0, 0.72), p(climb, 0.72), p(arrive, 0.6, 'smooth'), p(brakeStart, 0.6), p(q(14), 0.72, 'smooth')],
      coil: [p(0, 2600), p(q(8), 2000, 'smooth'), p(climb, 2000), p(arrive, 1900, 'exp'), p(brakeStart, 1900), p(q(14), 2600, 'exp')],
      clicks: [p(0, 0.85), p(q(8), 0.6, 'smooth'), p(climb, 0.6), p(arrive, 1.2, 'smooth'), p(brakeStart, 1.2), p(q(14), 0.85, 'smooth')],
      chassis: [p(0, 1.2), p(q(8), 1.35, 'smooth'), p(climb, 1.35), p(q(14), 1.2, 'smooth')],
      hum: [p(0, 0), p(climb, 0), p(arrive, 0.08, 'smooth'), p(brakeStart, 0.08), p(q(14), 0, 'smooth')],
    }),
    sections: [{ frame: 0, name: 'engage', roles: ['loop-point'] }, { frame: q(4), name: 'shift' }, { frame: q(8), name: 'heavy' },
      { frame: climb, name: 'sing', roles: ['climax'] }, { frame: q(14), name: 'return' }],
    notes: [{ frame: climb, hz: A1, name: 'A1' }],
  };
}

// ---------------------------------------------------------------------------------------
// B: THE AWAKENING. 12/8 at dotted quarter = 96 (bpm records the quarter: 144). Twelve contacts are a
// rolling arpeggio; four strong cogging detents seize the rotor, so scored jolts reveal
// the motif one lurch at a time. The grid then starts where the freed rotor first reaches
// its downbeat contact: the score waits for the motor, and the servo catches it there.
const awakeningContacts: Contact[] = [
  { step: 0, amp: 1.0, tine: 0, chassis: 1.0, click: 1.0 },
  { step: 1, amp: 0.38, click: 0.6 },
  { step: 2, amp: 0.55, tine: 2, click: 0.8 },
  { step: 3, amp: 0.8, tine: 1, chassis: 0.45, click: 0.95 },
  { step: 4, amp: 0.42, click: 0.6 },
  { step: 5, amp: 0.6, tine: 3, click: 0.8 },
  { step: 6, amp: 0.9, tine: 0, chassis: 0.8, click: 1.0 },
  { step: 7, amp: 0.45, tine: 4, click: 0.65 },
  { step: 8, amp: 0.55, tine: 2, click: 0.8 },
  { step: 9, amp: 0.75, tine: 3, chassis: 0.3, click: 0.95 },
  { step: 10, amp: 0.5, tine: 1, click: 0.7 },
  { step: 11, amp: 0.6, tine: 4, click: 0.75 },
];
const D2 = 73.41619, A1j = D2 * 3 / 4, G2 = D2 * 4 / 3;
const awakeningGears: Gear[] = [
  { name: 'sleep', chord: 'Dsus2/4 (just)', hz: ji(D2, 2, 3, 4, 9 / 2, 16 / 3) },
  { name: 'i', chord: 'Dm add9 (just)', hz: ji(D2, 2, 3, 4, 24 / 5, 9 / 2) },
  { name: 'VI', chord: 'Bbmaj7 (just)', hz: ji(D2, 8 / 5, 12 / 5, 16 / 5, 4, 6) },
  { name: 'iv', chord: 'Gm (just)', hz: ji(D2, 4 / 3, 2, 8 / 3, 16 / 5, 4) },
  { name: 'V-lock', chord: 'A overtones 2:3:4:5:7', hz: ji(A1j, 2, 3, 4, 5, 7) },
  { name: 'I-lock', chord: 'D overtones 2:3:4:5:9', hz: ji(D2, 2, 3, 4, 5, 9) },
  { name: 'IV-lock', chord: 'G overtones 2:3:4:5:6', hz: ji(G2, 2, 3, 4, 5, 6) },
];
/** The dormant choreography, tuned against the rotor-only simulation. */
export const dormant = {
  angle: -0.05, cogPhase: 0.95, cogging: 30, friction: 6,
  // [quarters, peak torque rev/s^2, milliseconds, id]
  jolts: [[0.05, 62, 70, 'heartbeat'], [0.7, 54, 70, 'heartbeat-echo'], [2.25, 118, 80, 'jolt'], [3.5, 124, 80, 'jolt-again']] as [number, number, number, string][],
  surge: { at: 4.25, peak: 4.75, end: 5.75, torque: 38 }, relax: 6, cruiseAt: 5.5, catchAfter: 5.5,
};
export function awakening(): Score {
  const free = clock(144), d = dormant;
  const motor: Motor = { steps: 12, contacts: awakeningContacts, cogs: 4, cogPhase: d.cogPhase, chassisHz: D2, edgeMs: 1.1, fusionKnee: 4, housing, spark: 0.8, brushHz: 4800, drive: 2.2, seed: 1207 };
  const surgeAt = free(d.surge.at), cruise = 0.4;
  const freeLanes = {
    speed: [p(0, 0), p(surgeAt, 0, undefined, { id: 'power-on', roles: ['torque', 'accelerate'], velocity: 0.6 }), p(free(d.cruiseAt), cruise, 'smooth')],
    servo: [p(0, 0)], torque: [p(0, 40)],
    push: [p(0, 0), p(surgeAt, 0, undefined, { id: 'surge', roles: ['torque', 'accelerate'], velocity: 0.8 }), p(free(d.surge.peak), d.surge.torque, 'smooth'), p(free(d.surge.end), 0, 'smooth')],
    cogging: [p(0, d.cogging), p(surgeAt, d.cogging), p(free(d.relax), 0.7, 'smooth')],
    friction: [p(0, d.friction), p(surgeAt, d.friction), p(free(d.relax), 0.35, 'smooth')],
  };
  const jolts = d.jolts.map(([at, torque, ms, id], i) => ({ frame: free(at), torque, ms, mark: { id: `${id}-${i + 1}`, roles: ['torque', 'jolt'], velocity: torque / 60 } }));
  const shell: Score = { id: 'awakening', title: 'THE AWAKENING', bpm: 144, meter: '12/8', frames: free(40), tailFrames: 0, loop: false, preroll: 0,
    initial: { angle: d.angle, speed: 0, reference: 0 }, motor, gears: awakeningGears, gearChanges: [], lanes: lanes(freeLanes), jolts, sections: [], notes: [] };
  // Pass 1: let the freed rotor run. The servo catches it on the first beat contact
  // (every third step: the dotted quarters of 12/8) once it cruises, and the bar grid is
  // anchored there.
  let catchAt = -1, step = 0, reference = 0;
  runRotor(shell, free(16), (n, rotor) => {
    if (n < free(d.catchAfter) || Math.abs(rotor.omega - cruise) > 0.25 * cruise) return;
    for (const c of awakeningContacts.filter(c => c.step % 3 === 0)) {
      const a = c.step / motor.steps;
      if (Math.floor(rotor.theta - a) > Math.floor(rotor.before - a)) { catchAt = n; step = c.step; reference = rotor.theta - rotor.reference; return true; }
    }
  });
  if (catchAt < 0) throw new Error('The rotor never woke up.');
  const origin = catchAt - Math.round(step / motor.steps * free(6)), q = clock(144, origin);
  const rise = q(12), ascent = q(15), lockV = q(16.5), lockI = q(17.5), plagal = q(19.5), home = q(20.5), lift = q(22), end = q(25);
  return {
    ...shell, frames: end,
    initial: { ...shell.initial, reference },
    gearChanges: [{ frame: 0, gear: 0, glideMs: 1 }, { frame: catchAt, gear: 1, glideMs: 60 }, { frame: q(9), gear: 2, glideMs: 40 },
      { frame: rise, gear: 3, glideMs: 30 }, { frame: ascent, gear: 4, glideMs: 50 },
      { frame: lockI - 2205, gear: 5, glideMs: 70 }, { frame: plagal - 2205, gear: 6, glideMs: 60 }, { frame: home - 2205, gear: 5, glideMs: 60 }],
    lanes: lanes({
      ...freeLanes,
      speed: [...freeLanes.speed, p(rise - 1838, cruise), p(rise, 0.6, 'linear', { id: 'double-time', roles: ['torque', 'accelerate'], velocity: 0.5 }),
        p(rise + 1838, 0.8, 'linear'), p(ascent, 0.8, undefined, { id: 'spin-up', roles: ['torque', 'accelerate'], velocity: 1 }), p(lockV, A1j, 'exp'),
        p(lockI - 4410, A1j, undefined, { id: 'shift-up', roles: ['torque', 'accelerate'], velocity: 0.7 }), p(lockI, D2, 'smooth'),
        p(plagal - 3528, D2, undefined, { id: 'shift-plagal', roles: ['torque', 'accelerate'], velocity: 0.6 }), p(plagal, G2, 'smooth'),
        p(home - 3528, G2, undefined, { id: 'shift-home', roles: ['torque', 'brake'], velocity: 0.6 }), p(home, D2, 'smooth')],
      servo: [p(0, 0), p(catchAt, 0, undefined, { id: 'catch', track: 'rotor', roles: ['servo-lock', 'downbeat'], velocity: 1 }), p(catchAt + 22050, 1, 'smooth')],
      torque: [p(0, 40), p(catchAt, 40), p(catchAt + 22050, 160, 'smooth'), p(ascent, 160), p(ascent + 1, 900, 'step')],
      load: [p(0, 0), p(q(11), 2.2, 'step', { id: 'drag', roles: ['torque', 'load'], velocity: 0.5 }),
        p(q(11.5), 0, 'step', { id: 'release', roles: ['torque', 'release'], velocity: 0.5 })],
      brush: [p(0, 0.95), p(catchAt, 0.95), p(rise, 1.0, 'smooth'), p(ascent, 1.05), p(lockI, 1.3, 'smooth'),
        p(lift, 1.3, undefined, { id: 'brush-lift', roles: ['release'], velocity: 1 }), p(lift + 6615, 0, 'smooth')],
      damping: [p(0, 0.7), p(catchAt, 0.85, 'smooth'), p(rise, 0.75, 'smooth'), p(ascent, 0.75), p(lockV, 0.8, 'smooth'), p(lift + 6615, 0.8), p(end, 0.4, 'smooth')],
      tines: [p(0, 0.75), p(ascent, 0.75), p(lockV, 0.45, 'smooth'), p(lockI, 0.35, 'smooth')],
      chassis: [p(0, 1.15)],
      coil: [p(0, 2600), p(ascent, 2600), p(lockV, 1900, 'exp'), p(lockI - 4410, 1900), p(lockI, 2800, 'exp')],
      clicks: [p(0, 0.85), p(ascent, 0.85), p(lockV, 1.0, 'smooth'), p(lockI - 4410, 1.0), p(lockI, 1.3, 'smooth')],
      hum: [p(0, 0), p(ascent, 0), p(lockV, 0.08, 'smooth'), p(lift, 0.08), p(lift + 6615, 0, 'smooth')],
      room: [p(0, 0.2), p(lockI, 0.2), p(end, 0.3, 'linear')],
    }),
    sections: [{ frame: 0, name: 'dormant' }, { frame: catchAt, name: 'catch' }, { frame: q(6), name: 'identity', roles: ['downbeat'] },
      { frame: rise, name: 'rise' }, { frame: ascent, name: 'ascent' }, { frame: lockI, name: 'payoff', roles: ['climax'] }, { frame: lift, name: 'release' }],
    notes: [{ frame: ascent, hz: A1j, name: 'A1' }, { frame: lockI - 4410, hz: D2, name: 'D2' }, { frame: plagal - 3528, hz: G2, name: 'G2' }, { frame: home - 3528, hz: D2, name: 'D2-home' }],
  };
}

export const scores = [hypnoticMotor, awakening];
