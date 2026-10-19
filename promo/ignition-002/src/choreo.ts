// The choreography: every moving quantity of THE INFINITE REACTOR as a pure, exactly periodic
// function of time, derived from the locked grid and the music's measured hits.
//
//   ACTIVE      bars 1–2   reactor already running: ratchet ticks on kicks, core pulses, rings spin
//   ACCELERATE  bars 3–4   rings speed up, odd tunnel rails and mounts open new energy pathways,
//                          LED chase on sixteenths, clamps unlatch one per sixteenth through bar 4
//   OPEN        bars 5–6   clamps slam back, stator tilts and turns once, gyro rings open into an
//                          armillary cage, polar jets erupt, field expands, cage precesses on bar 6
//   CONVERGE    bars 7–8   everything closes in sequence, rings slow until their index marks align,
//                          clamps zip shut one per sixteenth through bar 8, landing on the loop point
import type {SyncData} from './sync/contract.ts';
import {BAR, BEAT, LOOP, SECTION, STEP, bar, wrap} from './timeline.ts';
import {SPRINGS, TAU, cycleSpring, hitEnv, integratedAngle, lastHit, ratchet, sampleSeries, smoothstep, type Hit, type Move} from './motion/periodic.ts';

export const S2 = SECTION;
export const S3 = 2 * SECTION;
export const S4 = 3 * SECTION;

export const CLAMPS = 16;
export const RAILS = 8;
export const GYROS = 3;

const sixteenth = (b: number, k: number) => bar(b) + k * STEP;

export type Arc = {seed: number; age: number; life: number; s: number; angle: number; reach: number};
export type Pulse = {age: number; s: number};

export const makeChoreo = (sync: SyncData) => {
  const kicks = sync.kick;
  const snares = sync.snare;
  const hats = sync.hat;
  const accents = sync.accents;

  // Macro shape of the loop. Each list of moves sums to zero, so every curve returns to its
  // base by the loop point and keeps its velocity through it.
  const powerMoves: Move[] = [
    {t: S2, d: 0.12, p: SPRINGS.swell},
    {t: bar(3), d: 0.06, p: SPRINGS.swell},
    {t: S3, d: 0.16, p: {freq: 3, damping: 0.7}},
    {t: S4, d: -0.17, p: SPRINGS.swell},
    {t: bar(7), d: -0.17, p: SPRINGS.swell},
  ];
  const speedMoves: Move[] = [
    {t: S2, d: 0.8, p: SPRINGS.swell},
    {t: bar(3), d: 0.5, p: SPRINGS.swell},
    {t: S3, d: 1.4, p: {freq: 2.2, damping: 0.8}},
    {t: S4, d: -1.6, p: SPRINGS.heavy},
    {t: bar(7), d: -1.1, p: SPRINGS.swell},
  ];
  const ringOpenMoves = (i: number): Move[] => [
    {t: S2 + i * BEAT, d: 0.3, p: SPRINGS.gimbal},
    {t: S3 + i * 0.05, d: 0.7, p: SPRINGS.heavy},
    {t: S4 + i * 2 * BEAT, d: -0.6, p: SPRINGS.heavy},
    {t: bar(7) + i * BEAT, d: -0.4, p: SPRINGS.gimbal},
  ];
  const openMoves: Move[] = [
    {t: S2, d: 0.16, p: SPRINGS.gimbal},
    {t: S3, d: 0.84, p: SPRINGS.heavy},
    {t: S4, d: -0.5, p: SPRINGS.heavy},
    {t: bar(7), d: -0.5, p: SPRINGS.gimbal},
  ];
  const statorTiltMoves: Move[] = [
    {t: S3, d: 1, p: {freq: 1.3, damping: 0.6}},
    {t: S4, d: -1, p: {freq: 1.4, damping: 0.9}},
  ];
  const precessMoves: Move[] = [
    {t: bar(5), d: Math.PI / 2, p: SPRINGS.heavy},
    {t: bar(6) + BEAT, d: -Math.PI / 2, p: SPRINGS.gimbal},
  ];
  const dollyMoves: Move[] = [
    {t: S3, d: 1, p: SPRINGS.heavy},
    {t: S4, d: -1, p: SPRINGS.gimbal},
  ];
  // Odd rails and mounts are the new pathways of ACCELERATE, one per beat.
  const pathMoves = (k: number): Move[] => [
    {t: S2 + k * BEAT, d: 1, p: SPRINGS.lock},
    {t: S4 + BAR + k * BEAT, d: -1, p: SPRINGS.swell},
  ];
  // Clamp k: unlatches on sixteenth k of bar 4, slams back on the bar-5 downbeat,
  // zips shut on sixteenth k of bar 8, the last landing one sixteenth before the loop point.
  const clampMoves = (k: number): Move[] => [
    {t: sixteenth(3, k), d: 0.3, p: SPRINGS.lock},
    {t: S3 + k * 0.006, d: 0.7, p: {freq: 3.2, damping: 0.55}},
    {t: sixteenth(7, k), d: -1, p: SPRINGS.lock},
  ];

  const speedOf = (t: number) => cycleSpring(t, 1, speedMoves, SPRINGS.swell);
  const gyroSpin = [
    integratedAngle(4, t => speedOf(t)),
    integratedAngle(-6, t => speedOf(t) * 1.1),
    integratedAngle(8, t => speedOf(t) * 1.2),
  ];
  const fieldSpin = integratedAngle(-3, t => 0.6 + 0.4 * speedOf(t));
  const coreSpin = [integratedAngle(7, speedOf), integratedAngle(-9, speedOf), integratedAngle(11, speedOf)];
  // The stator turns only while unclamped: exactly one revolution inside OPEN.
  const statorSpin = integratedAngle(1, t => 1e-9 + smoothstep(S3 + 0.05, S3 + 0.7, t) * (1 - smoothstep(S4 - 0.5, S4 + 0.8, t)));

  // The ratchet advances one detent on every analysed kick and lands one full turn per loop.
  const ticks = kicks.filter(k => k.s >= 0.3).map(k => k.t);

  // A ring of light runs down the tunnel on every analysed kick, strongest on bar lines.
  const onBarLine = (t: number) => Math.abs(((t + BAR / 2) % BAR) - BAR / 2) < 0.04;
  const tunnelPulses: Hit[] = kicks.map(k => ({t: k.t, s: k.s * (onBarLine(k.t) ? 1 : 0.5)}));

  const shockwaves: Hit[] = [
    {t: S3, s: 1},
    {t: bar(5), s: 0.5},
  ];

  // The LED chase in bar 3: LED k lights on sixteenth k.
  const chaseHits = Array.from({length: CLAMPS}, (_, k) => [{t: sixteenth(2, k), s: 1}]);
  const unlockHits = Array.from({length: CLAMPS}, (_, k) => [{t: sixteenth(3, k), s: 0.8}]);
  const lockHits = Array.from({length: CLAMPS}, (_, k) => [{t: sixteenth(7, k), s: 1}]);

  const at = (tIn: number) => {
    const t = wrap(tIn);
    const kick = hitEnv(t, kicks, 0.11);
    const kickSlow = hitEnv(t, kicks, 0.26);
    const snare = hitEnv(t, snares, 0.09);
    const hat = hitEnv(t, hats, 0.045);
    const accent = hitEnv(t, accents, 0.4);
    const loud = sampleSeries(t, sync.loudness);
    const low = sampleSeries(t, sync.low);
    const high = sampleSeries(t, sync.high);

    const power = cycleSpring(t, 0.6, powerMoves, SPRINGS.swell);
    const open = cycleSpring(t, 0, openMoves, SPRINGS.heavy);
    const speed = speedOf(t);
    const precess = cycleSpring(t, 0, precessMoves, SPRINGS.heavy);
    const dolly = cycleSpring(t, 0, dollyMoves, SPRINGS.heavy);
    const statorTilt = cycleSpring(t, 0, statorTiltMoves, SPRINGS.heavy);

    const phase = (TAU * t) / LOOP;
    const camera = {
      yaw: 0.15 * Math.sin(phase) + 0.035 * Math.sin(2 * phase + 1.1),
      pitch: 0.1 + 0.05 * Math.cos(phase) - 0.06 * dolly,
      roll: 0.022 * Math.sin(phase + 0.7),
      // A small, kick-driven push of the lens: felt, never shaken.
      zoom: 1 + 0.085 * dolly + 0.006 * kick,
    };

    const gyros = Array.from({length: GYROS}, (_, i) => {
      const o = cycleSpring(t, 0, ringOpenMoves(i), SPRINGS.heavy);
      const baseTilt = [0.4, 0.62, 0.84][i]!;
      const openTilt = [0.95, 0.98, 0.72][i]!;
      const dir = i % 2 === 0 ? 1 : -1;
      return {
        open: o,
        tilt: baseTilt + openTilt * o,
        axis: [0.3, 2.2, 4.1][i]! + dir * phase + dir * precess,
        spin: gyroSpin[i]!.angle(t),
        spinVel: gyroSpin[i]!.velocity(t),
      };
    });

    const clamps = Array.from({length: CLAMPS}, (_, k) => {
      const p = cycleSpring(t, 0, clampMoves(k), SPRINGS.lock);
      const lockFlash = hitEnv(t, lockHits[k]!, 0.3);
      const unlockFlash = hitEnv(t, unlockHits[k]!, 0.2);
      const chase = t >= bar(2) - 0.05 && t < bar(3) + 0.3 ? hitEnv(t, chaseHits[k]!, 0.16) : 0;
      // Patterned responses per movement.
      let led: number;
      if (t < S2) led = 0.5 + 0.5 * kick;
      else if (t < bar(3)) led = 0.32 + 0.68 * chase + 0.15 * hat;
      else if (t < S3) led = 0.3 + 0.7 * unlockFlash;
      else if (t < S4) led = 0.12 + 0.88 * (k % 2 === 0 ? kick : snare);
      else led = 0.1 + 0.25 * hat + (t >= sixteenth(7, k) ? 0.45 : 0) + 0.55 * lockFlash;
      return {p, led: Math.min(1, led), flash: Math.max(lockFlash, unlockFlash * 0.6)};
    });

    const paths = Array.from({length: RAILS / 2}, (_, k) => cycleSpring(t, 0, pathMoves(k), SPRINGS.lock));

    // Plasma arcs on the analysed snares; strong hits throw more arcs.
    const arcs: Arc[] = [];
    const last = lastHit(t, snares);
    if (last) {
      const life = 0.12 + 0.12 * last.hit.s;
      if (last.dt < life) {
        const count = 1 + (last.hit.s > 0.65 ? 1 : 0) + (last.hit.s > 0.85 ? 1 : 0) + (t >= S3 && t < S4 ? 1 : 0);
        for (let a = 0; a < count; a++) {
          arcs.push({seed: last.index * 7 + a, age: last.dt, life, s: last.hit.s, angle: (TAU * (last.index * 0.618 + a / count)) % TAU, reach: 0.94});
        }
      }
    }

    const tunnel: Pulse[] = [];
    for (const p of tunnelPulses) {
      const age = wrap(t - p.t);
      if (age < 1.6) tunnel.push({age, s: p.s});
    }
    const shocks: Pulse[] = [];
    for (const s of shockwaves) {
      const age = wrap(t - s.t);
      if (age < 1.2) shocks.push({age, s: s.s});
    }
    // Pulses that run out along the mounts on every kick.
    const mountPulses: Pulse[] = [];
    for (const k of kicks) {
      const age = wrap(t - k.t);
      if (age < BEAT * 1.6) mountPulses.push({age, s: k.s});
    }
    // Pulses that run along the field lines, one per kick, alternating line families.
    const fieldPulses: (Pulse & {family: number})[] = [];
    kicks.forEach((k, index) => {
      const age = wrap(t - k.t);
      if (age < BEAT * 1.9) fieldPulses.push({age, s: k.s, family: index % 2});
    });

    return {
      t,
      kick,
      kickSlow,
      snare,
      hat,
      accent,
      loud,
      low,
      high,
      power,
      open,
      speed,
      precess,
      dolly,
      camera,
      core: {
        radius: 62 * (1 + 0.24 * open) * (1 + 0.07 * kick),
        heat: Math.min(1.15, power * (0.9 + 0.22 * kick + 0.12 * accent + 0.1 * low)),
        spins: coreSpin.map(s => s.angle(t)),
      },
      stator: {tilt: 0.42 * statorTilt, spin: statorSpin.angle(t), spinVel: statorSpin.velocity(t)},
      ratchet: ratchet(t, ticks, 1),
      gyros,
      clamps,
      paths,
      field: {spin: fieldSpin.angle(t), scale: 0.92 + 0.72 * open + 0.05 * kickSlow, extra: open},
      jets: {length: 70 + 430 * open + 50 * snare * open, flow: (t / LOOP) * 30, burst: snare},
      arcs,
      tunnel,
      shocks,
      mountPulses,
      fieldPulses,
      // Haze drifts exactly two tiles per loop.
      hazeShift: (2 * t) / LOOP,
      rays: (TAU * t) / LOOP,
    };
  };

  return {at, ticks, tunnelPulses, shockwaves};
};

export type Choreo = ReturnType<typeof makeChoreo>;
export type FrameState = ReturnType<Choreo['at']>;
