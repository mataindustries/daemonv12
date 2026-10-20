// V12 OVERDRIVE choreography: every moving and glowing quantity as an exactly periodic function
// of time. The mechanism (crank, pistons, rods, cams, valves, firing) follows the kinematics;
// the music adds secondary responses on top and never changes the linkage.
//
// The structure follows the track, measured from the approved WAV (src/v12/sync.json):
//   THE BEAST AWAKENS  bars 1–2   running from frame 0: pistons hammer, headers glow, high 3/4 view
//   FULL POWER         bars 3–4   the music's full stop (3.75 s) drops the engine's light; the brass
//                                 stab out of silence (3:1:3) re-ignites it; the camera swings to a
//                                 side view while the cam covers lift off the valvetrain
//   OVERDRIVE          bars 5–6   the kick-out bar 5 revs the engine up (throttle blip) and drops the
//                                 camera to a low three-quarter; the payoff downbeat 6:1:1 hits with
//                                 a push-in, an ignition surge front to rear and full heat
//   SECOND WIND        bars 7–8   the brass riff fires coil sweeps on every stab; covers close, the
//                                 camera returns, and everything lands on its start phase
import {BAR, BEAT, LOOP, wrap} from '../timeline.ts';
import {SPRINGS, TAU, cycleSpring, hitEnv, lastHit, sampleSeries, type Hit, type Move, type SpringParams} from '../motion/periodic.ts';
import {CYLINDERS, FIRING_ORDER, camAngle, combustion, crankAngle, crankSpeed, cyclePhase, exhaustLift, exhaustPulse, intakeLift, pistonPose, spark} from './kinematics.ts';
import type {V12Sync} from './sync.ts';

const b = (n: number) => n * BAR;
const deg = (d: number) => (d * Math.PI) / 180;

/** Camera keyframes per movement (spherical around a target; the springs between them sum to zero). */
export const SHOTS = {
  /** High front three-quarter: the V, both banks, the headers rising out of it. */
  awakens: {az: deg(14), el: deg(24), dist: 16.2, ty: 1.85, tz: 0.6, fov: 32},
  /** Side three-quarter at mid height: valvetrain above, cages, counterweights below. */
  power: {az: deg(50), el: deg(11), dist: 15.2, ty: 1.6, tz: 0, fov: 32},
  /** Low three-quarter: the crank assembly towers over the lens. */
  overdrive: {az: deg(30), el: deg(-8), dist: 13.4, ty: 1.25, tz: 0.4, fov: 36},
} as const;
type ShotKey = keyof typeof SHOTS.awakens;
/** The payoff push-in, added on top of the overdrive shot. */
const PUSH: Record<ShotKey, number> = {az: deg(-3), el: deg(-1.5), dist: -1.3, ty: 0, tz: 0, fov: -1.5};

/** Smooth bump: zero value and zero velocity at dt = 0, peak 1 at dt = τ. */
const bump = (dt: number, tau: number) => (dt <= 0 ? 0 : (dt / tau) ** 2 * Math.exp(2 - (2 * dt) / tau));

/** Damped torque reaction of the engine on its mounts to an impulse at dt = 0 (unit peak ≈ 1). */
const reaction = (dt: number, p: SpringParams) => {
  if (dt < 0) return 0;
  const w0 = TAU * p.freq;
  const wd = w0 * Math.sqrt(1 - p.damping * p.damping);
  return Math.exp(-p.damping * w0 * dt) * Math.sin(wd * dt) * 1.6;
};

export const makeV12Choreo = (sync: V12Sync) => {
  const R = sync.markers.reignite;
  const P = sync.markers.payoff;

  const shotMoves = (k: ShotKey): Move[] => {
    const a = SHOTS.awakens[k];
    const p = SHOTS.power[k];
    const o = SHOTS.overdrive[k];
    return [
      {t: R, d: p - a, p: {freq: 0.95, damping: 0.75}},
      {t: b(4), d: o - p, p: {freq: 1.05, damping: 0.78}},
      {t: P, d: PUSH[k], p: {freq: 2.2, damping: 0.68}},
      {t: b(6), d: a - o - PUSH[k], p: {freq: 0.62, damping: 0.86}},
    ];
  };
  const camKeys = (Object.keys(SHOTS.awakens) as ShotKey[]).map(k => [k, shotMoves(k)] as const);
  const powerMoves: Move[] = [
    {t: R, d: 0.12, p: SPRINGS.swell},
    {t: b(4), d: 0.1, p: SPRINGS.swell},
    {t: P, d: 0.16, p: {freq: 3, damping: 0.7}},
    {t: b(6), d: -0.2, p: SPRINGS.swell},
    {t: b(7), d: -0.18, p: SPRINGS.swell},
  ];
  const revealMoves: Move[] = [
    {t: R, d: 1, p: SPRINGS.heavy},
    {t: b(6) + 2 * BEAT, d: -1, p: {freq: 1.2, damping: 0.8}},
  ];
  const overdriveMoves: Move[] = [
    {t: b(4), d: 0.4, p: SPRINGS.gimbal},
    {t: P, d: 0.6, p: {freq: 3.4, damping: 0.6}},
    {t: b(6), d: -0.6, p: SPRINGS.swell},
    {t: b(7), d: -0.4, p: SPRINGS.swell},
  ];

  // Brass stabs launch a sequential ignition wave through the twelve coils in firing order.
  const rank = new Map(FIRING_ORDER.map((n, i) => [n, i]));
  const coilHits = CYLINDERS.map(c => sync.brass.map(h => ({t: wrap(h.t + rank.get(c.n)! * 0.028), s: h.s})));
  // The re-ignition and the payoff send a surge of light along the engine, front to rear.
  const front = Math.max(...CYLINDERS.map(c => c.z));
  const surgeHits = CYLINDERS.map(c => [R, P].map((t0, k) => ({t: wrap(t0 + (front - c.z) / 24), s: k === 1 ? 1 : 0.8})));
  const inPhrase = (tt: number) =>
    sync.brassPhrases.reduce((m, p) => {
      const inside = tt >= p.start && tt < p.end ? 1 : 0;
      const fade = Math.min(1, Math.max(0, (tt - p.start) / 0.08)) * Math.min(1, Math.max(0, (p.end - tt) / 0.2));
      return Math.max(m, inside * fade * p.s);
    }, 0);
  // The music's full stop: the engine holds its breath (fast fade in, released by the re-ignition).
  const inDrop = (tt: number) =>
    sync.dropouts.reduce((m, d) => {
      const start = d.start - 0.05;
      const end = Math.max(d.end, R - 0.004);
      if (tt < start || tt > end + 0.02) return m;
      return Math.max(m, Math.min(1, (tt - start) / 0.04) * Math.min(1, Math.max(0, (end + 0.02 - tt) / 0.02)));
    }, 0);

  const at = (tIn: number) => {
    const t = wrap(tIn);
    const theta = crankAngle(t);
    const kick = hitEnv(t, sync.kick, 0.1);
    const kickSlow = hitEnv(t, sync.kick, 0.28);
    const snare = hitEnv(t, sync.snare, 0.12);
    const hat = hitEnv(t, sync.hat, 0.05);
    const brass = hitEnv(t, sync.brass, 0.22);
    const phrase = inPhrase(t);
    const accent = hitEnv(t, sync.accents, 0.45);
    const bass = sampleSeries(t, sync.bass);
    const loud = sampleSeries(t, sync.loudness);
    const drop = inDrop(t);
    const live = 1 - 0.85 * drop;

    const power = cycleSpring(t, 0.62, powerMoves, SPRINGS.swell);
    const reveal = Math.max(0, Math.min(1.08, cycleSpring(t, 0, revealMoves, SPRINGS.heavy)));
    const overdrive = cycleSpring(t, 0, overdriveMoves, SPRINGS.gimbal);
    const cam = Object.fromEntries(camKeys.map(([k, moves]) => [k, cycleSpring(t, SHOTS.awakens[k], moves, SPRINGS.gimbal)])) as Record<ShotKey, number>;
    const phase = (TAU * t) / LOOP;
    cam.az += deg(2.5) * Math.sin(phase);
    // A felt, never shaken, push of the lens on each kick: smooth in position and velocity.
    let push = 0;
    for (const k of sync.kick) for (const dt of [t - k.t, t + LOOP - k.t]) if (dt > 0 && dt < 0.6) push += k.s * bump(dt, 0.06);
    cam.dist *= 1 - 0.005 * Math.min(1.5, push);

    // Torque reaction on the mounts: every kick rocks the block about the crank axis.
    let roll = 0;
    for (const k of sync.kick) {
      for (const dt of [t - k.t, t + LOOP - k.t]) if (dt >= 0 && dt < 1.2) roll += k.s * reaction(dt, {freq: 5.5, damping: 0.32});
    }
    // Second-order shake, crank-synchronous (periodic), scaled by the bass.
    const shake = (0.0025 + 0.006 * bass + 0.004 * overdrive) * Math.sin(2 * theta);

    const cylinders = CYLINDERS.map((c, i) => {
      const ph = cyclePhase(c, theta);
      const coil = hitEnv(t, coilHits[i]!, 0.16);
      const surge = hitEnv(t, surgeHits[i]!, 0.32);
      const fire = combustion(ph);
      return {
        pose: pistonPose(c, theta),
        phase: ph,
        fire,
        heat: (fire * (0.55 + 0.4 * power + 0.35 * kick + 0.9 * overdrive) + 0.12 * kick + coil * 0.5 + surge * 0.9) * live,
        spark: spark(ph) * live,
        coil: Math.min(1, coil + surge * 0.8 + 0.35 * phrase * (0.5 + 0.5 * Math.sin(phase * 40 + i))),
        surge,
        exhaust: exhaustPulse(ph),
        exLift: exhaustLift(ph),
        inLift: intakeLift(ph),
      };
    });

    // The two hottest cylinders carry real lights; who they are follows the firing order.
    const lit = cylinders
      .map((c, i) => ({i, v: c.heat}))
      .sort((p, q) => q.v - p.v)
      .slice(0, 2);

    const lastSnare = lastHit(t, sync.snare);
    return {
      t,
      theta,
      cam: camAngle(theta),
      rpm: crankSpeed(t),
      kick,
      kickSlow,
      snare,
      hat,
      brass,
      phrase,
      accent,
      bass,
      loud,
      drop,
      power,
      reveal,
      overdrive,
      camera: cam,
      roll: 0.0065 * roll,
      shake,
      cylinders,
      lit,
      headerHeat: (0.1 + 0.25 * bass + 0.15 * power + 0.45 * overdrive + 0.1 * kickSlow + 0.25 * accent) * live,
      flame: Math.min(1.2, snare * (0.7 + 0.5 * overdrive) + 0.25 * overdrive + 0.2 * bass + 0.4 * accent) * live,
      flameSeed: lastSnare ? lastSnare.index : 0,
      bloom: (0.42 + 0.22 * overdrive + 0.08 * kick + 0.1 * accent) * (1 - 0.4 * drop),
      exposure: (1 + 0.06 * overdrive + 0.04 * kickSlow + 0.04 * accent) * (1 - 0.45 * drop),
    };
  };
  return {at};
};

export type V12Choreo = ReturnType<typeof makeV12Choreo>;
export type V12State = ReturnType<V12Choreo['at']>;
export type {Hit};
