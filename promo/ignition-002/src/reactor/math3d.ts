// Minimal 3D: vectors, rotation matrices and a perspective orbit camera.
// World: x right, y up, z toward the viewer. The reactor sits at the origin.

export type V3 = readonly [number, number, number];
/** Row-major 3×3. */
export type M3 = readonly [number, number, number, number, number, number, number, number, number];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export const IDENTITY: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** Rotation by `a` radians about the unit axis (x, y, z) (Rodrigues). */
export const rotAxis = (x: number, y: number, z: number, a: number): M3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const C = 1 - c;
  return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C];
};
export const rotZ = (a: number) => rotAxis(0, 0, 1, a);
export const rotY = (a: number) => rotAxis(0, 1, 0, a);

export const mul = (a: M3, b: M3): M3 => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
  a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
  a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
  a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
  a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
  a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
  a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
];

export const apply = (m: M3, v: V3): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];

export type Camera = {pos: V3; R: V3; U: V3; F: V3; f: number; cx: number; cy: number};

/** An orbit camera around `target`: yaw about y, pitch above the horizon, roll about the lens axis. */
export const orbitCamera = (o: {yaw: number; pitch: number; roll: number; dist: number; f: number; cx: number; cy: number; target?: V3}): Camera => {
  const target = o.target ?? [0, 0, 0];
  const pos = add(target, [o.dist * Math.sin(o.yaw) * Math.cos(o.pitch), o.dist * Math.sin(o.pitch), o.dist * Math.cos(o.yaw) * Math.cos(o.pitch)]);
  const F = norm(sub(target, pos));
  const R0 = norm(cross(F, [0, 1, 0]));
  const U0 = cross(R0, F);
  const c = Math.cos(o.roll);
  const s = Math.sin(o.roll);
  const R = add(scale(R0, c), scale(U0, s));
  const U = sub(scale(U0, c), scale(R0, s));
  return {pos, R, U, F, f: o.f, cx: o.cx, cy: o.cy};
};

export type P2 = {x: number; y: number; z: number};

/** Screen position and camera depth (distance along the lens axis) of a world point. */
export const project = (cam: Camera, p: V3): P2 => {
  const d = sub(p, cam.pos);
  const z = dot(d, cam.F);
  const k = cam.f / Math.max(1, z);
  return {x: cam.cx + dot(d, cam.R) * k, y: cam.cy - dot(d, cam.U) * k, z};
};

/** Pixels per world unit at camera depth z. */
export const pxPerUnit = (cam: Camera, z: number) => cam.f / Math.max(1, z);
