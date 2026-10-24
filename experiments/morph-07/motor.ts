/** MORPH//07 HARMONIC MOTOR: an offline instrument kept outside the DaemonV12 engine.
 *
 * A servo drives a rotor against cogging, friction and load. Its commutator carries
 * contacts at fixed angles; every contact crossing fires one band-limited current pulse.
 * The pulse strikes a tuned stator tine, a hardening chassis mode and the housing. Slow
 * rotation is therefore rhythm (the contact geometry is the groove), fast rotation fuses
 * the same geometry into a pitch at the revolution rate, and the tines bloom when their
 * tuning lands on the rotor's harmonics. Everything is Float64 and seeded; there is no
 * global state, wall clock or audio tool.
 */
import type { JsonValue, ScheduledEvent, SourceProvenance } from '../../src/sync/index.ts';

export const RATE = 44100;
export const PICTURE_STRIDE = 735; // 44,100 / 60: telemetry is sampled on 60 fps picture boundaries
const TAU = 2 * Math.PI, DT = 1 / RATE;

export type Curve = 'step' | 'linear' | 'smooth' | 'exp';
export interface Mark { id: string; track?: string; roles: string[]; velocity?: number }
/** A lane value at an absolute sample frame; `curve` shapes the segment that ends here. */
export interface Point { frame: number; value: number; curve?: Curve; mark?: Mark }
export const laneNames = ['speed', 'servo', 'torque', 'push', 'cogging', 'friction', 'load', 'brush', 'damping', 'coil', 'tines', 'clicks', 'chassis', 'hum', 'room'] as const;
export type LaneName = typeof laneNames[number];
/** One commutator contact: angle in steps, pulse strength and where its pulse goes. */
export interface Contact { step: number; amp: number; tine?: number; chassis?: number; click?: number }
export interface Gear { name: string; chord: string; hz: number[] }
export interface Motor {
  steps: number;               // commutator divisions per revolution
  contacts: Contact[];
  cogs: number;                // cogging detents per revolution
  cogPhase: number;            // detent offset, as a fraction of one cog period
  chassisHz: number;           // low chassis mode, tuned to the key
  edgeMs: number;              // band-limited pulse length
  fusionKnee: number;          // rev/s where per-pulse energy halves (brush contact time ~ 1/speed)
  housing: { hz: number; q: number; gain: number }[];
  spark: number;               // seeded brush noise per pulse
  brushHz: number;             // centre of the brush-noise band
  drive: number;               // master saturation
  seed: number;
}
export interface Score {
  id: string; title: string;
  bpm: number; meter: string;
  frames: number;              // composition length; contacts stop firing here
  tailFrames: number;          // extra ring-out
  loop: boolean;               // wrap the ring-out onto the start for a seamless loop
  initial: { angle: number; speed: number; reference: number }; // rev, rev/s, servo grid phase at -preroll
  preroll: number;             // mechanics-only frames before frame 0, so a loop starts in its steady state
  motor: Motor;
  gears: Gear[];
  gearChanges: { frame: number; gear: number; glideMs: number }[];
  lanes: Record<LaneName, Point[]>;
  jolts: { frame: number; torque: number; ms: number; mark: Mark }[];
  sections: { frame: number; name: string; roles?: string[] }[];
  notes: { frame: number; hz: number; name: string }[];
}
export interface TelemetryFrame { pictureFrame: number; sampleFrame: number; angle: number; speed: number; torque: number; load: number; gear: number; chassis: number; regime: string }
export const stemNames = ['tines', 'housing', 'chassis', 'hum', 'room'] as const;
export interface Performance { left: Float64Array; right: Float64Array; events: ScheduledEvent[]; telemetry: TelemetryFrame[]; stats: Record<string, JsonValue>;
  stems?: Record<typeof stemNames[number], [Float64Array, Float64Array]> }

// mulberry32, the integer PRNG used throughout the MORPH experiments.
function noise(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2147483648 - 1;
  };
}

class Lane {
  readonly points: Point[];
  private i = 0;
  constructor(name: string, points: Point[]) {
    if (!points.length || points[0]!.frame !== 0) throw new RangeError(`Lane ${name} must start at frame 0.`);
    points.forEach((p, i) => { if (i && p.frame < points[i - 1]!.frame) throw new RangeError(`Lane ${name} is not ordered at ${i}.`); });
    this.points = points;
  }
  at(n: number): number {
    const ps = this.points;
    while (this.i + 1 < ps.length && ps[this.i + 1]!.frame <= n) this.i++;
    const a = ps[this.i]!, b = ps[this.i + 1];
    if (!b || b.curve === 'step' || b.curve === undefined) return a.value;
    const x = (n - a.frame) / (b.frame - a.frame);
    if (b.curve === 'smooth') return a.value + (b.value - a.value) * x * x * (3 - 2 * x);
    if (b.curve === 'exp' && a.value > 0 && b.value > 0) return a.value * (b.value / a.value) ** x;
    return a.value + (b.value - a.value) * x;
  }
}

const hann = (x: number) => 0.5 - 0.5 * Math.cos(TAU * x);
const round = (x: number, digits: number) => Number(x.toFixed(digits));

/** Complex one-pole resonator: stays stable and keeps its ring while the tuning glides. */
class Mode {
  re = 0; im = 0;
  step(input: number, hz: number, decaySeconds: number): number {
    const r = Math.exp(-1 / (decaySeconds * RATE)), w = TAU * hz / RATE;
    const c = r * Math.cos(w), s = r * Math.sin(w), re = this.re;
    this.re = c * re - s * this.im + input; this.im = s * re + c * this.im;
    return this.im;
  }
}
class Bandpass {
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  private readonly b0: number; private readonly a1: number; private readonly a2: number;
  constructor(hz: number, q: number) {
    const w = TAU * hz / RATE, alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha;
    this.b0 = alpha / a0; this.a1 = -2 * Math.cos(w) / a0; this.a2 = (1 - alpha) / a0;
  }
  step(x: number): number {
    const y = this.b0 * (x - this.x2) - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** A small four-line feedback delay network: a dark machine room, not a hall. */
class Room {
  private readonly lines = [1153, 1559, 1867, 2269].map(n => new Float64Array(n));
  private readonly gains: number[];
  private readonly damp = [0, 0, 0, 0];
  private i = 0; private hp = 0; private previous = 0;
  constructor(seconds: number) { this.gains = this.lines.map(line => 10 ** (-3 * line.length / (seconds * RATE))); }
  step(x: number): [number, number] {
    // Keep the low end dry: one-pole high-pass at ~180 Hz before the network.
    this.hp = 0.9747 * (this.hp + x - this.previous); this.previous = x;
    const outs = this.lines.map(line => line[this.i % line.length]!);
    const sum = (outs[0]! + outs[1]! + outs[2]! + outs[3]!) * 0.5;
    this.lines.forEach((line, k) => {
      const fed = (outs[k]! - sum) * this.gains[k]!;
      this.damp[k]! += 0.45 * (fed - this.damp[k]!);
      line[this.i % line.length] = this.damp[k]! + this.hp * (k % 2 ? -0.5 : 0.5);
    });
    this.i++;
    return [outs[0]! - outs[2]! * 0.6, outs[1]! - outs[3]! * 0.6];
  }
}

const makeLanes = (score: Score) => Object.fromEntries(laneNames.map(name => [name, new Lane(name, score.lanes[name])])) as Record<LaneName, Lane>;
const Kp = (TAU * 1.2) ** 2, Kv = 2 * 0.6 * TAU * 1.2, COULOMB = 0.4, HOUSING_GAIN = 15, SPARK_SECONDS = 0.008, RESOLVABLE_FRAMES = Math.round(0.03 * RATE);

/** The mechanical half: a servo with feed-forward drives the rotor against cogging,
 * viscous and Coulomb friction, load and scored jolts. Units: revolutions, rev/s, rev/s^2
 * (unit inertia). The servo phase error wraps, so it locks the grid modulo one revolution. */
export class Rotor {
  theta: number; omega: number; before: number; drive = 0; load = 0;
  private thetaRef: number; private previousRef: number; private joltIndex = 0;
  private readonly active: { start: number; length: number; torque: number }[] = [];
  private readonly lanes: Record<LaneName, Lane>;
  private readonly score: Score;
  constructor(score: Score) {
    this.score = score; this.lanes = makeLanes(score);
    this.theta = this.before = score.initial.angle; this.omega = score.initial.speed;
    this.thetaRef = score.initial.reference; this.previousRef = this.lanes.speed.at(0);
    for (let n = -score.preroll; n < 0; n++) this.step(n);
  }
  /** The servo's grid phase in revolutions. */
  get reference(): number { return this.thetaRef; }
  step(n: number): void {
    const l = this.lanes, m = this.score.motor, jolts = this.score.jolts;
    const speedRef = l.speed.at(n), limit = l.torque.at(n), viscous = l.friction.at(n);
    const accelRef = (speedRef - this.previousRef) * RATE; this.previousRef = speedRef;
    this.thetaRef += speedRef * DT;
    let error = this.thetaRef - this.theta; error -= Math.round(error);
    const command = l.servo.at(n) * Kp * error + Kv * (speedRef - this.omega) + accelRef + viscous * speedRef + (speedRef > 0 ? COULOMB : 0);
    let drive = Math.max(-limit, Math.min(limit, command)) + l.push.at(n);
    while (this.joltIndex < jolts.length && jolts[this.joltIndex]!.frame <= n) {
      const j = jolts[this.joltIndex++]!; this.active.push({ start: j.frame, length: Math.max(2, Math.round(j.ms * RATE / 1000)), torque: j.torque });
    }
    for (let k = this.active.length - 1; k >= 0; k--) {
      const j = this.active[k]!, x = (n - j.start) / j.length;
      if (x >= 1) this.active.splice(k, 1); else drive += j.torque * hann(x);
    }
    const cog = -l.cogging.at(n) * Math.cos(TAU * (m.cogs * this.theta + m.cogPhase));
    this.load = l.load.at(n);
    let next = this.omega + (drive + cog - this.load - viscous * this.omega) * DT;
    next = Math.abs(next) <= COULOMB * DT ? 0 : next - Math.sign(next) * COULOMB * DT;
    this.before = this.theta; this.omega = next; this.theta += next * DT; this.drive = drive;
  }
}

interface Pulse { start: number; length: number; amp: number; tine: number; chassis: number; click: number; pan: number; spark: number }

/** `stems` keeps each source's pre-master stereo signal for analysis. */
export function perform(score: Score, options: { stems?: boolean } = {}): Performance {
  const m = score.motor, total = score.frames + score.tailFrames;
  const lanes = makeLanes(score);
  const random = noise(m.seed);
  const contacts = m.contacts.map((c, index) => ({ ...c, index, angle: c.step / m.steps }));
  const tineCount = Math.max(...score.gears.map(g => g.hz.length));
  const tinePan = Array.from({ length: tineCount }, (_, k) => 0.5 + 0.38 * Math.sin(TAU * (k + 0.5) / tineCount));
  const tineHz = [...score.gears[0]!.hz], tineFrom = [...tineHz], tineTo = [...tineHz];
  let glideStart = 0, glideFrames = 1, gear = 0, gearIndex = 0;
  const lowModes = Array.from({ length: tineCount }, () => new Mode());
  const highModes = Array.from({ length: tineCount }, () => new Mode());
  const pingModes = Array.from({ length: tineCount }, () => new Mode());
  const housing = [0, 1].map(() => m.housing.map(h => new Bandpass(h.hz, h.q)));
  const brushes = [0, 1].map(() => new Bandpass(m.brushHz, 1.2));
  const room = new Room(0.85);
  const left = new Float64Array(total), right = new Float64Array(total);
  const events: ScheduledEvent[] = [], telemetry: TelemetryFrame[] = [];
  const pulses: Pulse[] = [], excTine = new Float64Array(tineCount);
  const stems = options.stems ? Object.fromEntries(stemNames.map(name => [name, [new Float64Array(total), new Float64Array(total)]])) as NonNullable<Performance['stems']> : undefined;
  const edge = Math.max(4, Math.round(m.edgeMs * RATE / 1000));
  const tineNorm = 2 / edge, w0 = TAU * m.chassisHz, chassisKick = w0 / (0.5 * edge * DT);
  const seen = new Map<string, number>();
  const source = (kind: string, extra: Record<string, JsonValue>): SourceProvenance => ({ score: score.id, kind, ...extra });
  const emit = (sampleFrame: number, trackId: string, eventId: string, velocity: number, visualRoles: string[], extra: Record<string, JsonValue>) => {
    if (sampleFrame >= score.frames) return; // ring-out is audio only
    const count = seen.get(trackId + '\u0000' + eventId) ?? 0;
    seen.set(trackId + '\u0000' + eventId, count + 1);
    events.push({ sampleFrame, trackId, eventId: count ? `${eventId}.again${count}` : eventId, velocity: round(velocity, 4), visualRoles, source: source(trackId, extra) });
  };

  // Scored, sample-frame-exact marks: torque changes, gear shifts, sections.
  for (const name of laneNames) for (const p of score.lanes[name]) if (p.mark)
    emit(p.frame, p.mark.track ?? 'drive', p.mark.id, p.mark.velocity ?? 1, p.mark.roles, { lane: name, value: p.value });
  for (const j of score.jolts) emit(j.frame, j.mark.track ?? 'drive', j.mark.id, j.mark.velocity ?? 1, j.mark.roles, { lane: 'jolt', torque: j.torque, ms: j.ms });
  for (const [i, change] of score.gearChanges.entries()) {
    const g = score.gears[change.gear]!;
    emit(change.frame, 'harmony', `shift-${i}-${g.name}`, 1, ['harmonic-transition'], { gear: g.name, chord: g.chord, tineHz: g.hz.map(h => round(h, 3)), glideMs: change.glideMs });
  }
  for (const s of score.sections) emit(s.frame, 'form', s.name, 1, ['section', ...(s.roles ?? [])], { section: s.name });

  const rotor = new Rotor(score);
  let maxRevolution = Math.floor(rotor.theta), fused = false, restRun = rotor.omega === 0 ? 1 : 0, moving = rotor.omega !== 0;
  let chassisX = 0, chassisV = 0, coilL = 0, coilR = 0, peakChassis = 0, maxSpeed = 0, noteIndex = 0, smooth = Math.abs(rotor.omega);
  let firedContacts = 0, exportedImpacts = 0, lastContact = -Infinity;

  for (let n = 0; n < total; n++) {
    const live = n < score.frames;
    rotor.step(n);
    const { theta, omega, drive, before } = rotor;
    maxSpeed = Math.max(maxSpeed, omega);
    smooth += (Math.abs(omega) - smooth) * 0.0005; // ~45 ms: lurches are not a change of regime

    // --- Emergent motion events: rest/breakaway, regime fusion, revolutions, pitch arrival.
    if (omega === 0) restRun++;
    else {
      if (!moving && restRun >= RATE * 0.03) emit(n, 'rotor', `breakaway-${n}`, 1, ['breakaway', 'torque'], { restFrames: restRun });
      moving = true; restRun = 0;
    }
    if (moving && restRun === Math.round(RATE * 0.03)) { emit(n - restRun + 1, 'rotor', `rest-${n}`, 1, ['rest'], { angle: round(theta, 5) }); moving = false; }
    const rate = smooth * contacts.length;
    if (!fused && rate > 34) { fused = true; emit(n, 'regime', `fusion-${n}`, 1, ['fusion', 'rhythm-to-pitch'], { revolutionsPerSecond: round(omega, 3), contactsPerSecond: round(rate, 2) }); }
    else if (fused && rate < 28) { fused = false; emit(n, 'regime', `separation-${n}`, 1, ['separation', 'pitch-to-rhythm'], { revolutionsPerSecond: round(omega, 3), contactsPerSecond: round(rate, 2) }); }
    if (live && Math.floor(theta) > maxRevolution) {
      maxRevolution = Math.floor(theta);
      if (omega <= 30) emit(n, 'rotor', `rev-${maxRevolution}`, 1, ['revolution'], { revolution: maxRevolution, revolutionsPerSecond: round(omega, 3) });
    }
    const note = score.notes[noteIndex];
    if (note && n >= note.frame && Math.abs(omega - note.hz) / note.hz < 0.01) {
      emit(n, 'voice', `note-${noteIndex}-${note.name}`, 1, ['pitch', 'harmonic-lock'], { note: note.name, hz: note.hz, scheduledFrame: note.frame, arrivalFrames: n - note.frame });
      noteIndex++;
    }

    // --- Stator tuning: gear changes glide each tine to its new chord tone.
    while (gearIndex < score.gearChanges.length && score.gearChanges[gearIndex]!.frame <= n) {
      const change = score.gearChanges[gearIndex++]!; gear = change.gear;
      for (let k = 0; k < tineCount; k++) { tineFrom[k] = tineHz[k]!; tineTo[k] = score.gears[gear]!.hz[k] ?? tineHz[k]!; }
      glideStart = n; glideFrames = Math.max(1, Math.round(change.glideMs * RATE / 1000));
    }
    const glide = Math.min(1, (n - glideStart) / glideFrames);
    for (let k = 0; k < tineCount; k++) tineHz[k] = tineFrom[k]! * (tineTo[k]! / tineFrom[k]!) ** (glide * glide * (3 - 2 * glide));

    // --- Commutator: each forward contact crossing fires one pulse; reverse motion re-arms it.
    const energy = 1 / (1 + Math.abs(omega) / m.fusionKnee), strain = 0.85 + 0.3 * Math.tanh(Math.abs(drive) / 60);
    const brush = lanes.brush.at(n);
    if (live && theta > before) for (const c of contacts) {
      const k = Math.floor(theta - c.angle);
      if (k <= Math.floor(before - c.angle)) continue;
      const start = n - 1 + (k + c.angle - before) / (theta - before), amp = c.amp * brush * strain;
      // Brush contact time shrinks with speed; equal-area pulses brighten without getting louder.
      const length = Math.max(3, edge / (1 + Math.abs(omega) / 48));
      pulses.push({ start, length, amp: amp * energy * edge / length, tine: c.tine ?? -1, chassis: c.chassis ?? 0, click: c.click ?? 1,
        pan: 0.5 + 0.22 * Math.sin(TAU * c.angle), spark: m.spark * amp * energy * energy * (c.click ?? 1) * (0.6 + 0.4 * random()) });
      firedContacts++;
      // Export impacts a picture can resolve (>= 30 ms apart); fused pitch is a regime, not events.
      const resolvable = n - lastContact >= RESOLVABLE_FRAMES; lastContact = n;
      if (resolvable && amp > 0) {
        exportedImpacts++;
        const id = `r${k}.s${c.step}`, extra = { revolution: k, step: c.step, contact: c.index, revolutionsPerSecond: round(omega, 4) };
        emit(n, 'commutator', id, amp, ['impact', ...(c.amp >= 0.75 ? ['accent'] : [])], extra);
        if ((c.chassis ?? 0) > 0) emit(n, 'chassis', id, amp * c.chassis!, ['impact', 'low-end'], extra);
        if (c.tine !== undefined) emit(n, 'tines', id, amp, ['tine', 'melody'], { ...extra, tine: c.tine, hz: round(tineHz[c.tine]!, 3), gear: score.gears[gear]!.name });
      }
    }

    // --- Excitation: sum active Hann pulses into tines, chassis and the two housing channels.
    excTine.fill(0);
    let excChassis = 0, houseL = 0, houseR = 0, sparkL = 0, sparkR = 0;
    for (let k = pulses.length - 1; k >= 0; k--) {
      const p = pulses[k]!, x = (n - p.start) / p.length, age = (n - p.start) * DT;
      if (age >= SPARK_SECONDS) { pulses.splice(k, 1); continue; }
      if (x < 0) continue;
      const h = x < 1 ? hann(x) * p.amp : 0, crackle = p.spark * random() * Math.exp(-age / (0.2 * SPARK_SECONDS));
      if (p.tine >= 0) excTine[p.tine]! += h * tineNorm;
      excChassis += h * p.chassis;
      const panL = Math.cos(p.pan * Math.PI / 2), panR = Math.sin(p.pan * Math.PI / 2);
      houseL += h * p.click * panL; houseR += h * p.click * panR; sparkL += crackle * panL; sparkR += crackle * panR;
    }

    // --- Tuned stator tines: fundamental, a 4:1 bar partial and a brief inharmonic ping.
    const damping = lanes.damping.at(n);
    let tL = 0, tR = 0;
    for (let k = 0; k < tineCount; k++) {
      const hz = tineHz[k]!, decay = damping * 0.6 * (220 / hz) ** 0.35;
      const y = lowModes[k]!.step(excTine[k]!, hz, decay) + 0.16 * highModes[k]!.step(excTine[k]!, 4 * hz, decay / 3.5)
        + 0.1 * pingModes[k]!.step(excTine[k]!, 9.2 * hz, 0.018);
      tL += y * Math.cos(tinePan[k]! * Math.PI / 2); tR += y * Math.sin(tinePan[k]! * Math.PI / 2);
    }
    // --- Chassis: hardening low mode, so a hard strike starts sharp and settles onto chassisHz.
    chassisV += (-w0 * w0 * (1 + 4 * chassisX * chassisX) * chassisX - 2 * 0.02 * w0 * chassisV + chassisKick * excChassis) * DT;
    chassisX += chassisV * DT;
    peakChassis = Math.max(peakChassis, Math.abs(chassisX));
    const body = Math.tanh(1.1 * chassisX + 0.12 * chassisX * chassisX);
    // --- Housing: inductive smoothing of the pulse current, then three shell resonances.
    const coil = 1 - Math.exp(-TAU * lanes.coil.at(n) / RATE);
    coilL += coil * (houseL - coilL); coilR += coil * (houseR - coilR);
    let hL = 0.35 * coilL + brushes[0]!.step(sparkL), hR = 0.35 * coilR + brushes[1]!.step(sparkR);
    m.housing.forEach((h, i) => { hL += h.gain * housing[0]![i]!.step(coilL); hR += h.gain * housing[1]![i]!.step(coilR); });
    hL *= HOUSING_GAIN; hR *= HOUSING_GAIN;
    // --- Rotor tone: the spinning mass itself, only audible once rotation is pitched.
    const audible = Math.min(1, Math.max(0, (Math.abs(omega) - 12) / 25));
    const hum = lanes.hum.at(n) * audible * audible * (Math.sin(TAU * theta) + 0.3 * Math.sin(2 * TAU * theta + 0.4));

    const tines = lanes.tines.at(n), clicks = lanes.clicks.at(n), chassis = lanes.chassis.at(n);
    const dryL = tines * tL + clicks * hL, dryR = tines * tR + clicks * hR, center = chassis * body + hum;
    const [wetL, wetR] = room.step(dryL + dryR);
    const wet = lanes.room.at(n);
    left[n] = dryL + center + wet * wetL; right[n] = dryR + center + wet * wetR;
    if (stems) {
      const put = (name: typeof stemNames[number], l: number, r: number) => { stems[name][0][n] = l; stems[name][1][n] = r; };
      put('tines', tines * tL, tines * tR); put('housing', clicks * hL, clicks * hR); put('chassis', chassis * body, chassis * body);
      put('hum', hum, hum); put('room', wet * wetL, wet * wetR);
    }

    if (live && n % PICTURE_STRIDE === 0) telemetry.push({ pictureFrame: n / PICTURE_STRIDE, sampleFrame: n, angle: round(theta, 6), speed: round(omega, 4),
      torque: round(drive, 3), load: round(rotor.load, 3), gear, chassis: round(chassisX, 4), regime: omega === 0 ? 'rest' : fused ? 'pitch' : 'rhythm' });
  }
  if (noteIndex !== score.notes.length) throw new Error(`${score.id}: the rotor never reached note ${score.notes[noteIndex]!.name}.`);
  return { left, right, events, telemetry, ...(stems ? { stems } : {}), stats: { firedContacts, exportedImpacts, maxRevolutionsPerSecond: round(maxSpeed, 3), peakChassisDisplacement: round(peakChassis, 4) } };
}

/** Wrap the ring-out (loop) or trim, saturate gently, remove DC and set a fixed peak. */
export function master(p: Performance, score: Score, peakDbfs = -1): { left: Float64Array; right: Float64Array; gain: number } {
  const n = score.frames, left = p.left.slice(0, n), right = p.right.slice(0, n);
  for (let i = n; i < p.left.length; i++) {
    const j = score.loop ? (i - n) % n : -1;
    if (j >= 0) { left[j]! += p.left[i]!; right[j]! += p.right[i]!; }
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(left[i]!), Math.abs(right[i]!));
  const d = score.motor.drive, norm = Math.tanh(d);
  for (const ch of [left, right]) {
    for (let i = 0; i < n; i++) ch[i] = Math.tanh(d * ch[i]! / peak) / norm;
    // DC blocker; a loop runs it twice so the seam starts from its own steady state.
    let x1 = 0, y1 = 0;
    const out = new Float64Array(n);
    for (let pass = score.loop ? 0 : 1; pass < 2; pass++)
      for (let i = 0; i < n; i++) { const y = ch[i]! - x1 + 0.99972 * y1; x1 = ch[i]!; y1 = y; out[i] = y; }
    ch.set(out);
  }
  if (!score.loop) { // a quarter-second cosine release under the natural ring-out
    const fade = Math.round(0.25 * RATE);
    for (let i = 0; i < fade; i++) { const g = 0.5 - 0.5 * Math.cos(Math.PI * i / fade); left[n - 1 - i]! *= g; right[n - 1 - i]! *= g; }
  }
  let finalPeak = 0;
  for (let i = 0; i < n; i++) finalPeak = Math.max(finalPeak, Math.abs(left[i]!), Math.abs(right[i]!));
  const gain = 10 ** (peakDbfs / 20) / finalPeak;
  for (let i = 0; i < n; i++) { left[i]! *= gain; right[i]! *= gain; }
  return { left, right, gain };
}

export function encodeWav(left: Float64Array, right: Float64Array): Buffer {
  const frames = left.length, bytes = Buffer.alloc(44 + frames * 4);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8); bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(2, 22); bytes.writeUInt32LE(RATE, 24); bytes.writeUInt32LE(RATE * 4, 28);
  bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i++) {
    for (const [c, ch] of [left, right].entries()) {
      const x = ch[i]!;
      if (!Number.isFinite(x)) throw new Error('Nonfinite synthesis');
      bytes.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x * 32767))), 44 + 4 * i + 2 * c);
    }
  }
  return bytes;
}
