// A timing belt wrapped around pulleys: the exact closed path (external tangents and arcs), and
// tooth placement that advances a whole number of pitches per loop so the belt is periodic.

export type Pulley = {x: number; y: number; r: number};
export type BeltPath = {points: [number, number][]; length: number; at: (s: number) => {x: number; y: number; dir: number}};

/**
 * Closed belt around pulleys listed counter-clockwise around their convex hull. For consecutive
 * pulleys A → B the belt leaves A and meets B along the external tangent on the outer (right-hand)
 * side, then wraps B counter-clockwise until it leaves for the next pulley.
 */
export const beltPath = (pulleys: readonly Pulley[], samplesPerArc = 24): BeltPath => {
  const n = pulleys.length;
  // Outward normal angle of the tangent from pulley i to pulley i + 1.
  const normals = pulleys.map((a, i) => {
    const b = pulleys[(i + 1) % n]!;
    const phi = Math.atan2(b.y - a.y, b.x - a.x);
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    return phi - Math.acos((a.r - b.r) / d);
  });
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const p = pulleys[i]!;
    // Arc on pulley i from the incoming tangent (normal of i − 1) to the outgoing one (normal of i).
    const a0 = normals[(i - 1 + n) % n]!;
    let a1 = normals[i]!;
    while (a1 < a0) a1 += Math.PI * 2;
    while (a1 - a0 > Math.PI * 2) a1 -= Math.PI * 2;
    for (let k = 0; k <= samplesPerArc; k++) {
      const a = a0 + ((a1 - a0) * k) / samplesPerArc;
      pts.push([p.x + p.r * Math.cos(a), p.y + p.r * Math.sin(a)]);
    }
  }
  const cum: number[] = [0];
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i % pts.length]!;
    cum.push(cum[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const length = cum[pts.length]!;
  const at = (sIn: number) => {
    const s = ((sIn % length) + length) % length;
    let lo = 0;
    let hi = pts.length;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid]! <= s) lo = mid;
      else hi = mid;
    }
    const a = pts[lo]!;
    const b = pts[(lo + 1) % pts.length]!;
    const f = (s - cum[lo]!) / Math.max(1e-9, cum[lo + 1]! - cum[lo]!);
    return {x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, dir: Math.atan2(b[1] - a[1], b[0] - a[0])};
  };
  return {points: pts, length, at};
};

/**
 * Tooth count and travel for a belt driven at `radius` by an angle that turns `turns` times per
 * loop: the pitch is chosen so the loop travel is a whole number of pitches and the closed belt
 * holds a whole number of teeth.
 */
export const beltTeeth = (length: number, radius: number, turns: number, nominalPitch: number) => {
  const teeth = Math.max(8, Math.round(length / nominalPitch));
  const pitch = length / teeth;
  const travel = radius * turns * Math.PI * 2;
  const k = Math.round(travel / pitch);
  /** Belt travel for a driver angle θ (radians), scaled so one loop is exactly k pitches. */
  const offset = (theta: number) => (theta / (turns * Math.PI * 2)) * k * pitch;
  return {teeth, pitch, offset};
};
