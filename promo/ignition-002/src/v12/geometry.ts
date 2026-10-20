// Procedural geometry for the V12, built once from the kinematic constants so that what is drawn
// is exactly what the tests validate. Profiles are drawn in the x–y plane and extruded along z
// (the crank axis), or lathed around y (pistons).
import * as THREE from 'three';
import {GEO} from './kinematics.ts';

const extrude = (shape: THREE.Shape, depth: number, bevel = 0.012) => {
  const g = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 28});
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
};

/** Crank web with counterweight, crank pin at +y, centred on the main journal. */
export const crankWeb = () => {
  const r = GEO.r;
  const boss = 0.24;
  const R = 0.66;
  const s = new THREE.Shape();
  s.moveTo(boss, r);
  s.absarc(0, r, boss, 0, Math.PI, false);
  s.lineTo(R * Math.cos((200 * Math.PI) / 180), R * Math.sin((200 * Math.PI) / 180));
  s.absarc(0, 0, R, (200 * Math.PI) / 180, (340 * Math.PI) / 180, false);
  s.lineTo(boss, r);
  // Lightening hole through the counterweight.
  const hole = new THREE.Path();
  hole.absarc(0, -0.36, 0.1, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return extrude(s, 0.11, 0.014);
};

/** Connecting rod in its own frame: big end at the origin, small end at (0, l). Skeletal I-section. */
export const rodShank = () => {
  const l = GEO.l;
  const s = new THREE.Shape();
  s.moveTo(-0.15, 0.12);
  s.lineTo(0.15, 0.12);
  s.lineTo(0.075, l - 0.1);
  s.lineTo(-0.075, l - 0.1);
  s.lineTo(-0.15, 0.12);
  const slot = new THREE.Path();
  slot.moveTo(-0.07, 0.3);
  slot.lineTo(-0.035, l - 0.28);
  slot.lineTo(0.035, l - 0.28);
  slot.lineTo(0.07, 0.3);
  slot.lineTo(-0.07, 0.3);
  s.holes.push(slot);
  return extrude(s, 0.13, 0.01);
};

/** A ring (annulus) extruded along z: rod eyes, bearing caps. */
export const eye = (outer: number, inner: number, depth: number) => {
  const s = new THREE.Shape();
  s.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  h.absarc(0, 0, inner, 0, Math.PI * 2, true);
  s.holes.push(h);
  return extrude(s, depth, 0.01);
};

/** Piston lathed around y: skirt, three ring grooves, top land, domed crown. Wrist pin at y = 0. */
export const piston = () => {
  const R = GEO.bore - 0.012;
  const bottom = -(GEO.pistonH - GEO.pinBelowCrown);
  const top = GEO.pinBelowCrown;
  const pts: [number, number][] = [
    [0.001, bottom + 0.06],
    [R - 0.05, bottom + 0.06],
    [R - 0.012, bottom],
    [R, bottom + 0.02],
    [R, top - 0.17],
    [R - 0.022, top - 0.165],
    [R - 0.022, top - 0.145],
    [R, top - 0.14],
    [R, top - 0.115],
    [R - 0.022, top - 0.11],
    [R - 0.022, top - 0.09],
    [R, top - 0.085],
    [R, top - 0.06],
    [R - 0.022, top - 0.055],
    [R - 0.022, top - 0.035],
    [R, top - 0.03],
    [R, top - 0.012],
    [R - 0.025, top],
    [R * 0.55, top + 0.022],
    [0.001, top + 0.03],
  ];
  const g = new THREE.LatheGeometry(
    pts.map(([x, y]) => new THREE.Vector2(x, y)),
    48,
  );
  g.computeVertexNormals();
  return g;
};

/** Main-bearing bulkhead: a V-shaped web from the crank bearing up to both bank bases, skeletal. */
export const bulkhead = () => {
  const b = GEO.bank;
  const base = 1.18;
  const half = 0.5;
  const ax = (sgn: number, d: number, p: number): [number, number] => {
    // Point at distance d along the bank axis (sign sgn) offset p perpendicular (outward positive).
    const a = sgn * b;
    return [Math.sin(a) * d + Math.cos(a) * p * sgn, Math.cos(a) * d - Math.sin(a) * p * sgn];
  };
  const s = new THREE.Shape();
  const start = (200 * Math.PI) / 180;
  s.moveTo(0.58 * Math.cos(start), 0.58 * Math.sin(start));
  s.absarc(0, 0, 0.58, start, (340 * Math.PI) / 180, false);
  s.lineTo(...ax(1, base, half));
  s.lineTo(...ax(1, base + 0.14, half));
  s.lineTo(...ax(1, base + 0.14, -half));
  s.lineTo(0, 0.95);
  s.lineTo(...ax(-1, base + 0.14, -half));
  s.lineTo(...ax(-1, base + 0.14, half));
  s.lineTo(...ax(-1, base, half));
  s.lineTo(0.58 * Math.cos(start), 0.58 * Math.sin(start));
  const shaft = new THREE.Path();
  shaft.absarc(0, 0, 0.23, 0, Math.PI * 2, true);
  s.holes.push(shaft);
  for (const sgn of [1, -1]) {
    // Triangular lightening window in each arm.
    const p1 = ax(sgn, 0.55, 0.22);
    const p2 = ax(sgn, 0.98, 0.3);
    const p3 = ax(sgn, 0.98, -0.12);
    const w = new THREE.Path();
    if (sgn > 0) {
      w.moveTo(...p1);
      w.lineTo(...p3);
      w.lineTo(...p2);
    } else {
      w.moveTo(...p1);
      w.lineTo(...p2);
      w.lineTo(...p3);
    }
    w.closePath();
    s.holes.push(w);
  }
  return extrude(s, 0.13, 0.012);
};

/** Rounded-rectangle profile extruded along z (heads, cam covers, beams). */
export const roundedBar = (w: number, h: number, r: number, depth: number, bevel = 0.012) => {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return extrude(s, depth, bevel);
};

/** Cam lobe: base circle with a nose toward −y (the valve) at zero rotation. */
export const camLobe = () => {
  const base = 0.085;
  const nose = 0.145;
  const s = new THREE.Shape();
  const n = 36;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    // Distance from −y: smooth nose over ±70°.
    const d = Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2));
    const k = Math.max(0, Math.cos(Math.min(Math.PI / 2, Math.abs(d) * (90 / 70))));
    const rad = base + (nose - base) * k * k;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  return extrude(s, 0.07, 0.006);
};

/** Gear / sprocket with n teeth. */
export const gear = (n: number, radius: number, depth: number, toothH = 0.05) => {
  const s = new THREE.Shape();
  const steps = n * 4;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const phase = i % 4;
    const r = phase === 1 || phase === 2 ? radius + toothH : radius;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  const h = new THREE.Path();
  h.absarc(0, 0, radius * 0.32, 0, Math.PI * 2, true);
  s.holes.push(h);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const w = new THREE.Path();
    w.absarc(Math.cos(a) * radius * 0.62, Math.sin(a) * radius * 0.62, radius * 0.17, 0, Math.PI * 2, true);
    s.holes.push(w);
  }
  return extrude(s, depth, 0.008);
};

/** Helical valve spring around y, unit height (scaled per frame for compression). */
export const spring = () => {
  const turns = 6;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= turns * 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.055, i / (turns * 24), Math.sin(a) * 0.055));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 16, 0.011, 4, false);
};

/** An exhaust primary along a curve. */
export const tube = (points: THREE.Vector3[], radius: number, segments = 64) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.35), segments, radius, 20, false);
