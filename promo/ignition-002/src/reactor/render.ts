// THE INFINITE REACTOR, drawn procedurally on one canvas per frame from a FrameState.
// Nothing here keeps state between frames except caches of fixed, seeded textures, so any
// frame renders identically in isolation and in any order.
//
// Back to front: tunnel of bulkheads and rails → haze and light shafts → depth-sorted machinery
// (housing, clamps, mounts, stator, ratchet, three gyro rings, core, field lines) → jets and
// plasma arcs → shockwave refraction → two-level bloom → foreground girders → vignette, dither.
import type {FrameState} from '../choreo.ts';
import {CLAMPS, GYROS} from '../choreo.ts';
import {BEAT, STEP} from '../timeline.ts';
import {TAU, clamp01, hash01, lerp} from '../motion/periodic.ts';
import {IDENTITY, add, apply, cross, dot, len, mul, norm, orbitCamera, project, pxPerUnit, rotAxis, rotZ, scale, sub, type Camera, type M3, type P2, type V3} from './math3d.ts';

type Ctx = CanvasRenderingContext2D;
type RGB = readonly [number, number, number];
type Item = {z: number; draw: (ctx: Ctx) => void};

export const STAGE = {
  /** Screen position of the reactor's centre. */
  cx: 540,
  cy: 975,
  /** Pixels per world unit at the reactor, before the camera's zoom. */
  S: 0.72,
  dist: 2200,
} as const;

const GEO = {
  stator: {ri: 372, ro: 438, h: 22, n: 32},
  gear: {ri: 326, ro: 352, tooth: 11, h: 13, n: 64},
  gyros: [
    {ri: 274, ro: 300, h: 13, n: 24},
    {ri: 224, ro: 246, h: 11, n: 20},
    {ri: 178, ro: 196, h: 9, n: 16},
  ],
  housing: {ri: 604, ro: 652, h: 34},
  clamp: {r0: 442, travel: 104, len: 58, w: 17, hz: 26},
  mounts: [0, 30, 150, 180, 210, 330].map(d => (d * Math.PI) / 180),
  tunnel: {z0: -760, dz: 540, count: 10, rOut: 1480, rIn: 1330},
} as const;

const C = {
  base: [12, 13, 16] as RGB,
  amber: [255, 158, 58] as RGB,
  molten: [255, 104, 24] as RGB,
  gold: [255, 212, 138] as RGB,
  white: [255, 247, 230] as RGB,
  cool: [150, 166, 186] as RGB,
};

const rgba = (c: RGB, a = 1) => `rgba(${Math.round(Math.min(255, Math.max(0, c[0])))},${Math.round(Math.min(255, Math.max(0, c[1])))},${Math.round(Math.min(255, Math.max(0, c[2])))},${Math.max(0, Math.min(1, a)).toFixed(4)})`;
const mixc = (a: RGB, b: RGB, f: number): RGB => [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];

// Key light: a dim, cool overhead fill that makes steel read as steel. All warm light comes from the core.
const KEY = norm([-0.5, 0.78, 0.42]);

/** Lit colour of a surface with world normal n at world point c. */
const shade = (n: V3, c: V3, cam: Camera, heat: number, base: RGB = C.base): RGB => {
  const d = len(c) || 1;
  const l = scale(c, -1 / d);
  const ndl = dot(n, l);
  const wrapL = Math.max(0, (ndl + 0.35) / 1.35);
  const fall = 1 / (1 + (d / 230) ** 2);
  const coreLight = heat * fall * (0.3 + 2.6 * wrapL * wrapL);
  const v = norm(sub(cam.pos, c));
  const hk = norm(add(KEY, v));
  const specK = Math.pow(Math.max(0, dot(n, hk)), 48) * 0.85;
  const diffK = Math.max(0, dot(n, KEY)) * 0.09;
  const hc = norm(add(l, v));
  const specC = Math.pow(Math.max(0, dot(n, hc)), 22) * heat * fall * 2.6;
  const rim = Math.pow(1 - Math.abs(dot(n, v)), 3) * 0.08 * heat;
  const hot = clamp01(heat * fall * 1.6 - 0.25);
  const lc = mixc(C.amber, C.white, hot * 0.7);
  const warm = coreLight + specC + rim;
  const cool = diffK + specK;
  return [base[0] + lc[0] * warm + C.cool[0] * cool, base[1] + lc[1] * warm + C.cool[1] * cool, base[2] + lc[2] * warm + C.cool[2] * cool];
};

const poly = (ctx: Ctx, pts: readonly P2[]) => {
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  ctx.closePath();
};
const line = (ctx: Ctx, pts: readonly P2[]) => {
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
};
const mid = (pts: readonly P2[]) => {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
    z += p.z;
  }
  return {x: x / pts.length, y: y / pts.length, z: z / pts.length};
};

// ---------------------------------------------------------------------------------------------
// Seeded textures, built once per page.

type Textures = {haze: HTMLCanvasElement; dither: HTMLCanvasElement};
let textures: Textures | null = null;

/** Tileable fBm value noise; the same seed gives the same clouds in every render tab. */
const makeTextures = (): Textures => {
  const N = 256;
  const haze = document.createElement('canvas');
  haze.width = N;
  haze.height = N;
  const hctx = haze.getContext('2d')!;
  const img = hctx.createImageData(N, N);
  const lattice = (ix: number, iy: number, period: number, o: number) => hash01(((ix % period) + period) % period, ((iy % period) + period) % period, o);
  const smooth = (x: number) => x * x * (3 - 2 * x);
  const noise = (x: number, y: number, period: number, o: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = smooth(x - ix);
    const fy = smooth(y - iy);
    const a = lattice(ix, iy, period, o);
    const b = lattice(ix + 1, iy, period, o);
    const c = lattice(ix, iy + 1, period, o);
    const d = lattice(ix + 1, iy + 1, period, o);
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
  };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let v = 0;
      let amp = 0.55;
      let total = 0;
      for (let o = 0; o < 4; o++) {
        const period = 4 << o;
        v += amp * noise((x / N) * period, (y / N) * period, period, o + 1);
        total += amp;
        amp *= 0.5;
      }
      v /= total;
      const c = Math.round(255 * Math.pow(clamp01((v - 0.25) / 0.6), 1.6));
      const i = (y * N + x) * 4;
      img.data[i] = c;
      img.data[i + 1] = c;
      img.data[i + 2] = c;
      img.data[i + 3] = 255;
    }
  }
  hctx.putImageData(img, 0, 0);

  const D = 128;
  const dither = document.createElement('canvas');
  dither.width = D;
  dither.height = D;
  const dctx = dither.getContext('2d')!;
  const dimg = dctx.createImageData(D, D);
  for (let i = 0; i < D * D; i++) {
    const v = Math.floor(hash01(i, 77) * 4);
    dimg.data[i * 4] = v;
    dimg.data[i * 4 + 1] = v;
    dimg.data[i * 4 + 2] = v;
    dimg.data[i * 4 + 3] = 255;
  }
  dctx.putImageData(dimg, 0, 0);
  return {haze, dither};
};

const buffers = new Map<string, HTMLCanvasElement>();
const buffer = (key: string, w: number, h: number) => {
  let c = buffers.get(key);
  if (!c || c.width !== w || c.height !== h) {
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    buffers.set(key, c);
  }
  return c;
};

// ---------------------------------------------------------------------------------------------
// Rings.

type RingOpts = {
  ri: number;
  ro: number;
  h: number;
  n: number;
  gap: number;
  M: M3;
  heat: number;
  power: number;
  /** Teeth on the outer edge (ratchet). */
  tooth?: number;
  /** Emissive slot intensity per segment, 0…1. */
  slot?: (k: number) => number;
  /** Segments carrying an index mark. */
  marks?: readonly number[];
  markColor?: RGB;
  /** Extra slot length (radians) for motion blur, signed in the direction of travel. */
  blur?: number;
  /** Angle of segment 0's centre in the ring's own plane. */
  start?: number;
  base?: RGB;
  bolts?: boolean;
};

const ringItems = (items: Item[], cam: Camera, o: RingOpts) => {
  const span = TAU / o.n;
  const steps = 3;
  for (let k = 0; k < o.n; k++) {
    const a0 = (o.start ?? Math.PI / 2) + (k - 0.5) * span + (o.gap * span) / 2;
    const a1 = a0 + span * (1 - o.gap);
    const am = (a0 + a1) / 2;
    const angles: number[] = [];
    for (let i = 0; i <= steps; i++) angles.push(lerp(a0, a1, i / steps));
    const W = (r: number, a: number, z: number): V3 => apply(o.M, [r * Math.cos(a), r * Math.sin(a), z]);
    const P = (r: number, a: number, z: number) => project(cam, W(r, a, z));
    const faces: {n: V3; c: V3; pts: () => P2[]; kind: 'front' | 'back' | 'inner' | 'outer' | 'cap'}[] = [];
    const nz = apply(o.M, [0, 0, 1]);
    const outerPts = (z: number) => {
      if (!o.tooth) return angles.slice().reverse().map(a => P(o.ro, a, z));
      return [P(o.ro, a1, z), P(o.ro + o.tooth, a1 - 0.12 * span, z), P(o.ro, a0, z)];
    };
    faces.push({n: nz, c: W((o.ri + o.ro) / 2, am, o.h), pts: () => [...angles.map(a => P(o.ri, a, o.h)), ...outerPts(o.h)], kind: 'front'});
    faces.push({n: scale(nz, -1), c: W((o.ri + o.ro) / 2, am, -o.h), pts: () => [...angles.map(a => P(o.ri, a, -o.h)), ...outerPts(-o.h)], kind: 'back'});
    faces.push({n: apply(o.M, [-Math.cos(am), -Math.sin(am), 0]), c: W(o.ri, am, 0), pts: () => [...angles.map(a => P(o.ri, a, o.h)), ...angles.slice().reverse().map(a => P(o.ri, a, -o.h))], kind: 'inner'});
    if (!o.tooth) {
      faces.push({n: apply(o.M, [Math.cos(am), Math.sin(am), 0]), c: W(o.ro, am, 0), pts: () => [...angles.map(a => P(o.ro, a, o.h)), ...angles.slice().reverse().map(a => P(o.ro, a, -o.h))], kind: 'outer'});
    }
    if (o.gap > 0) {
      faces.push({n: apply(o.M, [Math.sin(a0), -Math.cos(a0), 0]), c: W((o.ri + o.ro) / 2, a0, 0), pts: () => [P(o.ri, a0, o.h), P(o.ro, a0, o.h), P(o.ro, a0, -o.h), P(o.ri, a0, -o.h)], kind: 'cap'});
      faces.push({n: apply(o.M, [-Math.sin(a1), Math.cos(a1), 0]), c: W((o.ri + o.ro) / 2, a1, 0), pts: () => [P(o.ri, a1, o.h), P(o.ro, a1, o.h), P(o.ro, a1, -o.h), P(o.ri, a1, -o.h)], kind: 'cap'});
    }
    for (const f of faces) {
      if (dot(f.n, sub(cam.pos, f.c)) <= 0) continue;
      const z = project(cam, f.c).z;
      items.push({
        z,
        draw: ctx => {
          const pts = f.pts();
          if (f.kind === 'front' || f.kind === 'back') {
            const side = f.kind === 'front' ? o.h : -o.h;
            const pin = P(o.ri, am, side);
            const pout = P(o.ro, am, side);
            const g = ctx.createLinearGradient(pin.x, pin.y, pout.x, pout.y);
            g.addColorStop(0, rgba(shade(f.n, W(o.ri, am, side), cam, o.heat, o.base)));
            g.addColorStop(1, rgba(shade(f.n, W(o.ro, am, side), cam, o.heat, o.base)));
            ctx.fillStyle = g;
            poly(ctx, pts);
            ctx.fill();
            const px = pxPerUnit(cam, z);
            // Machined groove and panel edge.
            ctx.lineWidth = Math.max(0.6, 1.1 * px);
            ctx.strokeStyle = 'rgba(0,0,0,0.55)';
            line(ctx, angles.map(a => P(o.ri + 0.64 * (o.ro - o.ri), a, side)));
            ctx.stroke();
            ctx.strokeStyle = rgba(shade(f.n, W(o.ri, am, side), cam, o.heat * 1.4, o.base), 0.5);
            ctx.lineWidth = Math.max(0.5, 0.8 * px);
            line(ctx, angles.map(a => P(o.ri + 0.66 * (o.ro - o.ri), a, side)));
            ctx.stroke();
            if (o.bolts !== false && !o.tooth) {
              ctx.fillStyle = rgba(mixc(C.cool, C.gold, 0.3), 0.55);
              const rb = o.ri + 0.84 * (o.ro - o.ri);
              for (const ab of [a0 + 0.14 * (a1 - a0), a1 - 0.14 * (a1 - a0)]) {
                const b = P(rb, ab, side);
                ctx.beginPath();
                ctx.arc(b.x, b.y, Math.max(0.8, 1.9 * px), 0, TAU);
                ctx.fill();
              }
            }
            if (f.kind === 'front' && o.slot) {
              const s = o.slot(k) * o.power;
              if (s > 0.01) {
                const rs = o.ri + 0.3 * (o.ro - o.ri);
                const blur = o.blur ?? 0;
                const sa0 = am - 0.3 * (a1 - a0) + Math.min(0, -blur);
                const sa1 = am + 0.3 * (a1 - a0) + Math.max(0, -blur);
                const sp = [0, 0.25, 0.5, 0.75, 1].map(u => P(rs, lerp(sa0, sa1, u), side + 0.5));
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.lineCap = 'round';
                ctx.strokeStyle = rgba(C.molten, 0.35 * s);
                ctx.lineWidth = Math.max(1.5, 7 * px);
                line(ctx, sp);
                ctx.stroke();
                ctx.strokeStyle = rgba(mixc(C.amber, C.white, s * 0.8), Math.min(1, 1.1 * s));
                ctx.lineWidth = Math.max(0.8, 2.6 * px);
                line(ctx, sp);
                ctx.stroke();
                ctx.restore();
              }
            }
            if (f.kind === 'front' && o.marks?.includes(k)) {
              const mc = o.markColor ?? C.gold;
              ctx.save();
              ctx.globalCompositeOperation = 'lighter';
              ctx.strokeStyle = rgba(mc, 0.9 * Math.max(0.35, o.power));
              ctx.lineWidth = Math.max(1, 3.2 * px);
              line(ctx, [P(o.ri + 2, am, side + 0.5), P(o.ro - 2, am, side + 0.5)]);
              ctx.stroke();
              ctx.restore();
            }
          } else {
            const c = shade(f.n, f.c, cam, o.heat, o.base);
            ctx.fillStyle = rgba(c);
            poly(ctx, pts);
            ctx.fill();
            if (f.kind === 'inner') {
              // A hairline where the hot inner wall meets the face: the core's rim light.
              ctx.save();
              ctx.globalCompositeOperation = 'lighter';
              ctx.strokeStyle = rgba(mixc(C.amber, C.white, 0.4), 0.18 * o.heat);
              ctx.lineWidth = Math.max(0.6, 1.2 * pxPerUnit(cam, z));
              line(ctx, angles.map(a => P(o.ri, a, o.h)));
              ctx.stroke();
              ctx.restore();
            }
          }
        },
      });
    }
  }
};

// ---------------------------------------------------------------------------------------------
// Boxes (clamps, mounts).

type Box = {corner: (i: number, j: number, k: number) => V3; heat: number; base?: RGB; decorate?: (ctx: Ctx, face: string, pts: P2[], n: V3) => void};

const boxItems = (items: Item[], cam: Camera, b: Box) => {
  // Faces as corner index triples (i: axis A 0/1, j: axis B 0/1, k: axis C 0/1).
  const faces: [string, [number, number, number][]][] = [
    ['a0', [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]]],
    ['a1', [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]]],
    ['b0', [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]]],
    ['b1', [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]]],
    ['c0', [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]],
    ['c1', [[0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 0, 1]]],
  ];
  let center: V3 = [0, 0, 0];
  for (let i = 0; i < 8; i++) center = add(center, scale(b.corner(i & 1, (i >> 1) & 1, (i >> 2) & 1), 1 / 8));
  for (const [name, idx] of faces) {
    const w = idx.map(([i, j, k]) => b.corner(i, j, k));
    const c = scale(add(add(w[0]!, w[1]!), add(w[2]!, w[3]!)), 0.25);
    let n = norm(cross(sub(w[1]!, w[0]!), sub(w[3]!, w[0]!)));
    if (dot(n, sub(c, center)) < 0) n = scale(n, -1);
    if (dot(n, sub(cam.pos, c)) <= 0) continue;
    const z = project(cam, c).z;
    items.push({
      z,
      draw: ctx => {
        const pts = w.map(p => project(cam, p));
        ctx.fillStyle = rgba(shade(n, c, cam, b.heat, b.base));
        poly(ctx, pts);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        b.decorate?.(ctx, name, pts, n);
      },
    });
  }
};

// ---------------------------------------------------------------------------------------------

export type RenderOptions = {width: number; height: number; /** QA only: layer names to skip. */ skip?: readonly string[]};

export const renderFrame = (ctx: Ctx, s: FrameState, opt: RenderOptions) => {
  const {width: W, height: H} = opt;
  if (!textures) textures = makeTextures();
  const tex = textures;

  const cam = orbitCamera({
    yaw: s.camera.yaw,
    pitch: s.camera.pitch,
    roll: s.camera.roll,
    dist: STAGE.dist,
    f: STAGE.S * STAGE.dist * s.camera.zoom,
    cx: STAGE.cx,
    cy: STAGE.cy,
  });
  const origin = project(cam, [0, 0, 0]);
  const heat = s.core.heat;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.fillStyle = '#040303';
  ctx.fillRect(0, 0, W, H);

  const on = (layer: string) => !opt.skip?.includes(layer);
  if (on('tunnel')) drawTunnel(ctx, cam, s);
  if (on('haze')) drawAtmosphere(ctx, cam, s, origin, tex, W, H);

  const items: Item[] = [];
  if (on('machinery')) buildMachinery(items, cam, s);
  if (on('field')) buildField(items, cam, s);
  if (on('core')) items.push({z: origin.z, draw: c => drawCore(c, cam, s, origin)});
  items.sort((a, b) => b.z - a.z);
  for (const it of items) {
    ctx.save();
    it.draw(ctx);
    ctx.restore();
  }

  if (on('glare')) drawGlare(ctx, s, origin);
  if (on('jets')) drawJets(ctx, cam, s, origin);
  if (on('arcs')) drawArcs(ctx, cam, s, origin);
  if (on('shocks')) drawShocks(ctx, s, origin, W, H);
  if (on('bloom')) drawBloom(ctx, W, H, s);
  if (on('foreground')) drawForeground(ctx, s, W, H);
  if (on('grade')) drawGrade(ctx, tex, W, H, heat);
  ctx.restore();
};

// ---------------------------------------------------------------------------------------------

const tunnelGlow = (s: FrameState, z: number) => {
  let g = 0;
  for (const p of s.tunnel) {
    const u = p.age / 1.6;
    const zp = GEO.tunnel.z0 + 600 - u * 5200;
    g += p.s * Math.exp(-(((z - zp) / 300) ** 2)) * (1 - u) ** 1.5 * (0.45 + 0.55 * s.power);
  }
  return g;
};

const octagon = (r: number, z: number): V3[] => Array.from({length: 8}, (_, j) => [r * Math.cos(Math.PI / 8 + (j * TAU) / 8), r * Math.sin(Math.PI / 8 + (j * TAU) / 8), z] as V3);

export const drawTunnel = (ctx: Ctx, cam: Camera, s: FrameState) => {
  const T = GEO.tunnel;
  const railLevel = (j: number) => (j % 2 === 0 ? 0.5 + 0.5 * s.paths[(j >> 1) % 4]! : s.paths[(j >> 1) % 4]!);
  for (let k = T.count - 1; k >= 0; k--) {
    const z = T.z0 - k * T.dz;
    const outer = octagon(T.rOut, z).map(p => project(cam, p));
    const inner = octagon(T.rIn, z).map(p => project(cam, p));
    const depthFade = Math.exp(-k * 0.22);
    const glow = tunnelGlow(s, z);
    // Rails from this bulkhead to the next one out (toward the reactor).
    if (k > 0) {
      const zn = z + T.dz;
      const near = octagon(T.rIn, zn).map(p => project(cam, p));
      for (let j = 0; j < 8; j++) {
        const lvl = railLevel(j);
        const a = inner[j]!;
        const b = near[j]!;
        ctx.strokeStyle = rgba(mixc([20, 20, 22], C.amber, 0.06 + 0.1 * lvl * depthFade), 1);
        ctx.lineWidth = 6 * pxPerUnit(cam, (a.z + b.z) / 2);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        // Energy running down the active rails into the depth.
        if (lvl > 0.02) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const flow = (s.t / BEAT) % 1;
          for (const off of [0, 0.5]) {
            const u = (flow + off + k * 0.37) % 1;
            const p = {x: lerp(b.x, a.x, u), y: lerp(b.y, a.y, u)};
            const q = {x: lerp(b.x, a.x, Math.max(0, u - 0.22)), y: lerp(b.y, a.y, Math.max(0, u - 0.22))};
            const g = ctx.createLinearGradient(q.x, q.y, p.x, p.y);
            g.addColorStop(0, rgba(C.molten, 0));
            g.addColorStop(1, rgba(C.gold, 0.8 * lvl * depthFade * (0.5 + 0.5 * s.power)));
            ctx.strokeStyle = g;
            ctx.lineWidth = 2.6 * pxPerUnit(cam, (a.z + b.z) / 2);
            ctx.beginPath();
            ctx.moveTo(q.x, q.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    }
    // The bulkhead frame.
    const lit = 0.04 + 0.05 * depthFade + 0.5 * glow;
    ctx.beginPath();
    outer.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    inner
      .slice()
      .reverse()
      .forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = rgba(mixc([11, 11, 13], C.amber, Math.min(0.5, lit * 0.5)), 1);
    ctx.fill('evenodd');
    // Panel seams on the frame.
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.2;
    for (let j = 0; j < 8; j++) {
      const a = outer[j]!;
      const b = inner[j]!;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Lit inner lip.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(mixc(C.molten, C.gold, Math.min(1, glow)), (0.08 + 0.1 * s.power) * depthFade + 0.65 * glow);
    const depth = mid(inner).z;
    ctx.lineWidth = 2.2 * pxPerUnit(cam, depth) + 1;
    ctx.beginPath();
    inner.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    // Corner beacons, patterned by the hats.
    for (let j = 0; j < 8; j++) {
      const on = (j + k) % 4 === Math.floor(s.t / STEP) % 4 ? s.hat : 0;
      const b = 0.15 * depthFade + on * 0.8 * depthFade * railLevel(j);
      if (b < 0.02) continue;
      const p = inner[j]!;
      const r = 5 * pxPerUnit(cam, depth) + 1;
      ctx.fillStyle = rgba(C.gold, Math.min(1, b));
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  // The travelling ring of light itself.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of s.tunnel) {
    const u = p.age / 1.6;
    const zp = GEO.tunnel.z0 + 600 - u * 5200;
    const ring = octagon(T.rIn - 10, zp).map(q => project(cam, q));
    ctx.strokeStyle = rgba(C.gold, 0.5 * p.s * (1 - u) ** 2 * Math.min(1, u / 0.1) * (0.45 + 0.55 * s.power));
    ctx.lineWidth = 7 * pxPerUnit(cam, mid(ring).z);
    ctx.beginPath();
    ring.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
};

const drawAtmosphere = (ctx: Ctx, cam: Camera, s: FrameState, o: P2, tex: Textures, W: number, H: number) => {
  // Haze lit by the core, at quarter resolution.
  const q = 4;
  const w = W / q;
  const h = H / q;
  const buf = buffer('haze', w, h);
  const b = buf.getContext('2d')!;
  b.save();
  b.globalCompositeOperation = 'source-over';
  // Noise first, then multiplied by the core's light falloff (to opaque black), so only lit air glows.
  const pat = b.createPattern(tex.haze, 'repeat')!;
  const tile = 256;
  const shift = (s.hazeShift % 1) * tile;
  pat.setTransform(new DOMMatrix([1.2, 0, 0, 1.2, -shift * 1.2, shift * 1.2]));
  b.fillStyle = pat;
  b.fillRect(0, 0, w, h);
  b.globalCompositeOperation = 'multiply';
  const R = 760 / q;
  const g = b.createRadialGradient(o.x / q, o.y / q, 0, o.x / q, o.y / q, R);
  g.addColorStop(0, rgba(mixc(C.gold, [0, 0, 0], 0.35)));
  g.addColorStop(0.25, rgba(mixc(C.amber, [0, 0, 0], 0.62)));
  g.addColorStop(0.6, rgba(mixc(C.molten, [0, 0, 0], 0.88)));
  g.addColorStop(1, 'rgb(0,0,0)');
  b.fillStyle = g;
  b.fillRect(0, 0, w, h);
  // Light shafts radiating from the core, turning one revolution per loop.
  b.globalCompositeOperation = 'lighter';
  const rays = 14;
  for (let i = 0; i < rays; i++) {
    const a = s.rays + (i * TAU) / rays + 0.15 * Math.sin(i * 2.3);
    const width = 0.05 + 0.04 * hash01(i, 9);
    const reach = (900 + 500 * hash01(i, 4)) / q;
    const rg = b.createRadialGradient(o.x / q, o.y / q, 0, o.x / q, o.y / q, reach);
    rg.addColorStop(0, rgba(C.amber, 0.22 * s.power));
    rg.addColorStop(1, rgba(C.molten, 0));
    b.fillStyle = rg;
    b.beginPath();
    b.moveTo(o.x / q, o.y / q);
    b.lineTo(o.x / q + Math.cos(a - width) * reach, o.y / q + Math.sin(a - width) * reach);
    b.lineTo(o.x / q + Math.cos(a + width) * reach, o.y / q + Math.sin(a + width) * reach);
    b.closePath();
    b.fill();
  }
  b.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, 0.32 + 0.38 * s.power + 0.1 * s.kickSlow);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(buf, 0, 0, W, H);
  ctx.restore();
  void cam;
};

// ---------------------------------------------------------------------------------------------

const statorMatrix = (s: FrameState): M3 => mul(rotAxis(1, 0, 0, s.stator.tilt), rotZ(-s.stator.spin));

const buildMachinery = (items: Item[], cam: Camera, s: FrameState) => {
  const heat = s.core.heat;
  const pw = s.power;
  const stepF = s.t / STEP;

  // Fixed housing ring with a slot for every clamp.
  const H = GEO.housing;
  ringItems(items, cam, {
    ri: H.ri,
    ro: H.ro,
    h: H.h,
    n: CLAMPS,
    gap: 0.16,
    M: IDENTITY,
    heat,
    power: pw,
    start: Math.PI / 2 - Math.PI / CLAMPS,
    slot: k => 0.18 + 0.25 * s.kickSlow * ((k + Math.floor(s.t / BEAT)) % 2),
    base: [10, 11, 13],
  });

  // Clamps and their guide rails.
  const CL = GEO.clamp;
  for (let k = 0; k < CLAMPS; k++) {
    const phi = Math.PI / 2 - (k * TAU) / CLAMPS;
    const er: V3 = [Math.cos(phi), Math.sin(phi), 0];
    const et: V3 = [-Math.sin(phi), Math.cos(phi), 0];
    const st = s.clamps[k]!;
    const r0 = CL.r0 + CL.travel * Math.max(-0.08, Math.min(1.08, st.p));
    const corner = (i: number, j: number, kk: number): V3 => add(add(scale(er, i ? r0 + CL.len : r0), scale(et, j ? CL.w : -CL.w)), [0, 0, kk ? CL.hz : -CL.hz]);
    boxItems(items, cam, {
      corner,
      heat,
      base: [15, 16, 19],
      decorate: (ctx, face, pts) => {
        if (face === 'c1') {
          // LED and grille on the clamp's face.
          const a = pts[0]!;
          const b = pts[1]!;
          const c = pts[2]!;
          const d = pts[3]!;
          const at = (u: number, v: number) => ({x: lerp(lerp(a.x, d.x, u), lerp(b.x, c.x, u), v), y: lerp(lerp(a.y, d.y, u), lerp(b.y, c.y, u), v)});
          ctx.strokeStyle = 'rgba(0,0,0,0.6)';
          ctx.lineWidth = 1;
          for (const u of [0.55, 0.68, 0.81]) {
            const p = at(u, 0.2);
            const q = at(u, 0.8);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
          const led = st.led;
          const col = st.p > 0.6 ? mixc([255, 70, 20], C.amber, led) : mixc(C.amber, C.white, st.flash);
          const p = at(0.2, 0.5);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const r = Math.max(2, 9 * STAGE.S);
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.2);
          g.addColorStop(0, rgba(col, 0.95 * led));
          g.addColorStop(0.3, rgba(col, 0.35 * led));
          g.addColorStop(1, rgba(col, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 3.2, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
        if (face === 'a0' && st.flash > 0.02) {
          // Contact flare where the jaw meets the stator.
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = rgba(C.white, 0.7 * st.flash);
          poly(ctx, pts);
          ctx.fill();
          ctx.restore();
        }
      },
    });
    // Guide rails between housing and stator.
    for (const side of [-1, 1]) {
      const a = project(cam, add(add(scale(er, CL.r0 + 4), scale(et, side * (CL.w + 6))), [0, 0, -CL.hz + 6]));
      const b = project(cam, add(add(scale(er, H.ri), scale(et, side * (CL.w + 6))), [0, 0, -CL.hz + 6]));
      items.push({
        z: (a.z + b.z) / 2 + 30,
        draw: ctx => {
          ctx.strokeStyle = rgba(shade([0, 0, 1], add(scale(er, 520), [0, 0, 0]), cam, heat), 1);
          ctx.lineWidth = 5 * pxPerUnit(cam, a.z);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        },
      });
    }
  }

  // Mounts from the housing back to the first bulkhead, carrying pulses out on every kick.
  GEO.mounts.forEach((phi, m) => {
    const er: V3 = [Math.cos(phi), Math.sin(phi), 0];
    const A = scale(er, H.ro - 6);
    const B = add(scale(er, GEO.tunnel.rIn + 40), [0, 0, GEO.tunnel.z0]);
    const u = norm(sub(B, A));
    const v1 = norm(cross(u, [0, 0, 1]));
    const v2 = norm(cross(u, v1));
    const half = 26;
    const corner = (i: number, j: number, k: number): V3 => add(add(i ? B : A, scale(v1, j ? half : -half)), scale(v2, k ? half : -half));
    boxItems(items, cam, {corner, heat, base: [12, 12, 14]});
    const diagonal = m % 3 !== 0;
    const level = diagonal ? s.paths[[0, 0, 1, 0, 2, 3][m]!] ?? 0 : 1;
    if (level > 0.02) {
      for (const p of s.mountPulses) {
        const f = p.age / (BEAT * 1.6);
        const pos = add(A, scale(sub(B, A), Math.pow(f, 0.8)));
        const q = project(cam, add(pos, scale(v2, -half - 2)));
        const tail = project(cam, add(add(A, scale(sub(B, A), Math.max(0, Math.pow(f, 0.8) - 0.12))), scale(v2, -half - 2)));
        items.push({
          z: q.z - 40,
          draw: ctx => {
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createLinearGradient(tail.x, tail.y, q.x, q.y);
            g.addColorStop(0, rgba(C.molten, 0));
            g.addColorStop(1, rgba(C.gold, 0.85 * p.s * level * (1 - f)));
            ctx.strokeStyle = g;
            ctx.lineCap = 'round';
            ctx.lineWidth = 7 * pxPerUnit(cam, q.z);
            ctx.beginPath();
            ctx.moveTo(tail.x, tail.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          },
        });
      }
    }
  });

  // Stator: heavy, clamped except in OPEN, where it tilts and turns exactly once.
  const SM = statorMatrix(s);
  const ST = GEO.stator;
  ringItems(items, cam, {
    ri: ST.ri,
    ro: ST.ro,
    h: ST.h,
    n: ST.n,
    gap: 0.07,
    M: SM,
    heat,
    power: pw,
    // A light that runs one plate per sixteenth, lifted by the hats.
    slot: k => {
      const d = (((stepF - k) % ST.n) + ST.n) % ST.n;
      return 0.1 + (0.55 + 0.45 * s.hat) * Math.exp(-d / 1.6) + 0.12 * s.kick;
    },
    marks: [0, 8, 16, 24],
    markColor: C.amber,
    blur: -s.stator.spinVel / 120,
  });

  // Ratchet: one detent per analysed kick, one revolution per loop.
  const GR = GEO.gear;
  ringItems(items, cam, {
    ri: GR.ri,
    ro: GR.ro,
    h: GR.h,
    n: GR.n,
    gap: 0,
    tooth: GR.tooth,
    M: mul(SM, rotZ(-s.ratchet)),
    heat,
    power: pw,
    marks: [0, 16, 32, 48],
    markColor: C.gold,
    bolts: false,
  });

  // Three counter-rotating gyro rings on their own gimbals.
  for (let i = 0; i < GYROS; i++) {
    const g = s.gyros[i]!;
    const gd = GEO.gyros[i]!;
    const M = gyroMatrix(s, i);
    const dir = i % 2 === 0 ? 1 : -1;
    ringItems(items, cam, {
      ri: gd.ri,
      ro: gd.ro,
      h: gd.h,
      n: gd.n,
      gap: 0.12,
      M,
      heat,
      power: pw,
      slot: k => {
        // Two comets chase around each ring, plus a kick flash.
        let v = 0.12 + 0.28 * s.kick;
        for (let c = 0; c < 2; c++) {
          const pos = ((c / 2 + dir * (6 + i) * (s.t / 15) * 1) % 1 + 1) % 1;
          const dk = Math.abs((((k / gd.n - pos) % 1) + 1.5) % 1 - 0.5) * gd.n;
          v += Math.exp(-dk * dk * 0.5) * 0.9;
        }
        return Math.min(1, v);
      },
      marks: [0],
      markColor: C.white,
      blur: -g.spinVel / 120,
    });
  }
};

export const gyroMatrix = (s: FrameState, i: number): M3 => {
  const g = s.gyros[i]!;
  return mul(rotAxis(Math.cos(g.axis), Math.sin(g.axis), 0, g.tilt), rotZ(g.spin));
};

// ---------------------------------------------------------------------------------------------

const FIELD_LINES = 16;

const buildField = (items: Item[], cam: Camera, s: FrameState) => {
  const rc = s.core.radius * 1.15;
  const samples = 40;
  const chunk = 5;
  for (let j = 0; j < FIELD_LINES; j++) {
    const extra = j % 2 === 1;
    const alpha = (extra ? s.field.extra : 1) * (0.35 + 0.5 * s.power);
    if (alpha < 0.02) continue;
    const L = (165 + 130 * hash01(j, 3)) * s.field.scale * (extra ? 1.18 : 1);
    const phi = s.field.spin + (j * TAU) / FIELD_LINES;
    const th0 = Math.asin(Math.sqrt(Math.min(1, rc / L)));
    const pt = (th: number): V3 => {
      const r = L * Math.sin(th) ** 2;
      return [r * Math.sin(th) * Math.cos(phi), r * Math.cos(th), r * Math.sin(th) * Math.sin(phi)];
    };
    const pts: P2[] = [];
    for (let i = 0; i <= samples; i++) pts.push(project(cam, pt(lerp(th0, Math.PI - th0, i / samples))));
    for (let c = 0; c < samples; c += chunk) {
      const seg = pts.slice(c, c + chunk + 1);
      const z = mid(seg).z;
      items.push({
        z,
        draw: ctx => {
          ctx.globalCompositeOperation = 'lighter';
          ctx.lineCap = 'round';
          ctx.strokeStyle = rgba(C.molten, 0.07 * alpha);
          ctx.lineWidth = 7;
          line(ctx, seg);
          ctx.stroke();
          ctx.strokeStyle = rgba(C.amber, 0.32 * alpha);
          ctx.lineWidth = 1.5;
          line(ctx, seg);
          ctx.stroke();
        },
      });
    }
    // Pulses: one per kick, alternating families of lines, pole to pole in under two beats.
    for (const p of s.fieldPulses) {
      if ((j >> 1) % 2 !== p.family) continue;
      const u = p.age / (BEAT * 1.9);
      const e = u * u * (3 - 2 * u);
      const thp = lerp(th0, Math.PI - th0, e);
      const tail = Array.from({length: 6}, (_, i) => project(cam, pt(Math.max(th0, thp - i * 0.05))));
      const b = p.s * (1 - u) * alpha;
      items.push({
        z: tail[0]!.z - 1,
        draw: ctx => {
          ctx.globalCompositeOperation = 'lighter';
          ctx.lineCap = 'round';
          ctx.strokeStyle = rgba(C.gold, 0.9 * b);
          ctx.lineWidth = 3;
          line(ctx, tail);
          ctx.stroke();
          ctx.fillStyle = rgba(C.white, Math.min(1, 1.2 * b));
          ctx.beginPath();
          ctx.arc(tail[0]!.x, tail[0]!.y, 2.6, 0, TAU);
          ctx.fill();
        },
      });
    }
  }
};

// ---------------------------------------------------------------------------------------------

const drawCore = (ctx: Ctx, cam: Camera, s: FrameState, o: P2) => {
  const px = pxPerUnit(cam, o.z);
  const R = s.core.radius * px;
  const heat = s.core.heat;
  ctx.globalCompositeOperation = 'lighter';
  const corona = ctx.createRadialGradient(o.x, o.y, R * 0.8, o.x, o.y, R * 3.6);
  corona.addColorStop(0, rgba(C.gold, 0.5 * heat));
  corona.addColorStop(0.3, rgba(C.amber, 0.2 * heat));
  corona.addColorStop(1, rgba(C.molten, 0));
  ctx.fillStyle = corona;
  ctx.beginPath();
  ctx.arc(o.x, o.y, R * 3.6, 0, TAU);
  ctx.fill();

  ctx.globalCompositeOperation = 'source-over';
  const body = ctx.createRadialGradient(o.x - R * 0.12, o.y - R * 0.15, 0, o.x, o.y, R);
  body.addColorStop(0, rgba(C.white));
  body.addColorStop(0.38, rgba([255, 214, 140]));
  body.addColorStop(0.78, rgba([246, 122, 38]));
  body.addColorStop(1, rgba([190, 64, 16]));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(o.x, o.y, R, 0, TAU);
  ctx.fill();

  // Plasma filaments: great circles on the core, each on its own spinning axis.
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const axes: V3[] = [norm([0.3, 1, 0.2]), norm([1, -0.2, 0.4]), norm([-0.4, 0.3, 1])];
  s.core.spins.forEach((spin, i) => {
    const ax = axes[i]!;
    const Mi = rotAxis(ax[0], ax[1], ax[2], spin);
    for (let f = 0; f < 2; f++) {
      const tilt = rotAxis(1, 0, 0, 0.9 + f * 0.8 + i * 0.6);
      const M = mul(Mi, tilt);
      const pts: P2[] = [];
      const front: boolean[] = [];
      for (let a = 0; a <= 48; a++) {
        const th = (a / 48) * TAU;
        const p = apply(M, [Math.cos(th) * s.core.radius * 0.97, Math.sin(th) * s.core.radius * 0.97, 0]);
        pts.push(project(cam, p));
        front.push(dot(p, sub(cam.pos, [0, 0, 0])) > 0);
      }
      ctx.strokeStyle = rgba([255, 236, 190], 0.5 * heat);
      ctx.lineWidth = Math.max(1, 2.2 * px);
      ctx.beginPath();
      let drawing = false;
      for (let a = 0; a <= 48; a++) {
        if (front[a]) {
          if (!drawing) ctx.moveTo(pts[a]!.x, pts[a]!.y);
          else ctx.lineTo(pts[a]!.x, pts[a]!.y);
          drawing = true;
        } else drawing = false;
      }
      ctx.stroke();
    }
  });
  // Hot limb.
  ctx.strokeStyle = rgba(C.gold, 0.35 * heat);
  ctx.lineWidth = Math.max(1, 2 * px);
  ctx.beginPath();
  ctx.arc(o.x, o.y, R, 0, TAU);
  ctx.stroke();
};

const drawGlare = (ctx: Ctx, s: FrameState, o: P2) => {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const R = 420 + 120 * s.open;
  const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, R);
  const a = 0.1 * Math.min(1, s.core.heat);
  g.addColorStop(0, rgba(C.gold, a));
  g.addColorStop(0.2, rgba(C.amber, a * 0.45));
  g.addColorStop(1, rgba(C.molten, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(o.x, o.y, R, 0, TAU);
  ctx.fill();
  ctx.restore();
};

const drawJets = (ctx: Ctx, cam: Camera, s: FrameState, o: P2) => {
  const L = s.jets.length;
  if (L < 5) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const px = pxPerUnit(cam, o.z);
  const rBase = s.core.radius * 0.75 * px;
  for (const dir of [1, -1]) {
    const tip = project(cam, [0, dir * (s.core.radius + L), 0]);
    const base = project(cam, [0, dir * s.core.radius * 0.6, 0]);
    const dx = tip.x - base.x;
    const dy = tip.y - base.y;
    const dl = Math.hypot(dx, dy) || 1;
    const nx = -dy / dl;
    const ny = dx / dl;
    const g = ctx.createLinearGradient(base.x, base.y, tip.x, tip.y);
    const a = Math.min(1, 0.2 + 0.5 * s.open) * s.core.heat;
    g.addColorStop(0, rgba(C.gold, 0.4 * a));
    g.addColorStop(0.35, rgba(C.amber, 0.2 * a));
    g.addColorStop(1, rgba(C.molten, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(base.x + nx * rBase, base.y + ny * rBase);
    ctx.quadraticCurveTo(lerp(base.x, tip.x, 0.3) + nx * rBase * 0.35, lerp(base.y, tip.y, 0.3) + ny * rBase * 0.35, tip.x + nx * 2, tip.y + ny * 2);
    ctx.lineTo(tip.x - nx * 2, tip.y - ny * 2);
    ctx.quadraticCurveTo(lerp(base.x, tip.x, 0.3) - nx * rBase * 0.35, lerp(base.y, tip.y, 0.3) - ny * rBase * 0.35, base.x - nx * rBase, base.y - ny * rBase);
    ctx.closePath();
    ctx.fill();
    // Hot spine.
    const sg = ctx.createLinearGradient(base.x, base.y, tip.x, tip.y);
    sg.addColorStop(0, rgba(C.white, 0.5 * a));
    sg.addColorStop(1, rgba(C.gold, 0));
    ctx.strokeStyle = sg;
    ctx.lineWidth = 2.5 + 3 * s.jets.burst;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    // Knots of plasma streaming outward; an exact whole number of passes per loop.
    const knots = 7;
    for (let i = 0; i < knots; i++) {
      const u = (((i + s.jets.flow * 4) / knots) % 1 + 1) % 1;
      const p = {x: lerp(base.x, tip.x, u), y: lerp(base.y, tip.y, u)};
      const w = rBase * (1 - 0.8 * u) * 0.55;
      const kg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, w * 1.6);
      kg.addColorStop(0, rgba(C.white, 0.5 * a * (1 - u)));
      kg.addColorStop(1, rgba(C.amber, 0));
      ctx.fillStyle = kg;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, w * 0.9, w * 1.6, Math.atan2(dy, dx) + Math.PI / 2, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
};

const drawArcs = (ctx: Ctx, cam: Camera, s: FrameState, o: P2) => {
  if (s.arcs.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const M = gyroMatrix(s, 0);
  const ri = GEO.gyros[0]!.ri;
  for (const arc of s.arcs) {
    const target = apply(M, [ri * Math.cos(arc.angle), ri * Math.sin(arc.angle), 0]);
    const start = scale(norm(target), s.core.radius * 0.95);
    const a = project(cam, start);
    const b = project(cam, target);
    const flick = Math.floor((arc.age * 60) / 2);
    const n = 16;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dl = Math.hypot(dx, dy) || 1;
    const nx = -dy / dl;
    const ny = dx / dl;
    const pts: {x: number; y: number}[] = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const env = Math.sin(Math.PI * u);
      const off = (hash01(arc.seed, i, flick) - 0.5) * dl * 0.22 * env + (hash01(arc.seed, i >> 2, flick, 5) - 0.5) * dl * 0.18 * env;
      pts.push({x: a.x + dx * u + nx * off, y: a.y + dy * u + ny * off});
    }
    const life = 1 - arc.age / arc.life;
    const b2 = arc.s * life * life;
    const stroke = (col: RGB, alpha: number, w: number) => {
      ctx.strokeStyle = rgba(col, alpha);
      ctx.lineWidth = w;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    };
    stroke(C.molten, 0.18 * b2, 12);
    stroke(C.gold, 0.45 * b2, 4);
    stroke(C.white, 0.95 * b2, 1.6);
    // Impact spark on the ring.
    const sg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 26);
    sg.addColorStop(0, rgba(C.white, 0.8 * b2));
    sg.addColorStop(1, rgba(C.amber, 0));
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 26, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  void o;
};

const drawShocks = (ctx: Ctx, s: FrameState, o: P2, W: number, H: number) => {
  if (s.shocks.length === 0) return;
  const snap = buffer('snap', W, H);
  const sctx = snap.getContext('2d')!;
  sctx.globalCompositeOperation = 'copy';
  sctx.drawImage(ctx.canvas, 0, 0);
  for (const sh of s.shocks) {
    const u = sh.age / 1.2;
    const e = 1 - Math.pow(1 - u, 3);
    const R = 70 + 1050 * e;
    const w = 60 + 50 * u;
    const k = 1 + 0.045 * sh.s * (1 - u) ** 1.5;
    ctx.save();
    ctx.beginPath();
    ctx.arc(o.x, o.y, R + w, 0, TAU);
    ctx.arc(o.x, o.y, Math.max(0, R - w), 0, TAU, true);
    ctx.clip();
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(snap, o.x - o.x * k, o.y - o.y * k, W * k, H * k);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(C.amber, 0.22 * sh.s * (1 - u) ** 2);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(o.x, o.y, R, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
};

const drawBloom = (ctx: Ctx, W: number, H: number, s: FrameState) => {
  const levels: [string, number, string, number][] = [
    ['bloomA', 4, 'contrast(2.1) brightness(0.72) blur(3px)', 0.5],
    ['bloomB', 10, 'contrast(1.8) brightness(0.8) blur(5px)', 0.55],
  ];
  for (const [key, q, filter, alpha] of levels) {
    const w = Math.round(W / q);
    const h = Math.round(H / q);
    const buf = buffer(key, w, h);
    const b = buf.getContext('2d')!;
    b.save();
    b.globalCompositeOperation = 'copy';
    b.filter = filter;
    b.drawImage(ctx.canvas, 0, 0, w, h);
    b.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * (0.85 + 0.15 * s.power);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(buf, 0, 0, W, H);
    ctx.restore();
  }
};

const drawForeground = (ctx: Ctx, s: FrameState, W: number, H: number) => {
  // Two out-of-focus girders close to the lens; they move with the camera, much faster than the reactor.
  const ox = -s.camera.yaw * 1300;
  const oy = (s.camera.pitch - 0.1) * 1300;
  ctx.save();
  ctx.filter = 'blur(10px)';
  const beam = (x0: number, y0: number, x1: number, y1: number, w: number) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l = Math.hypot(dx, dy);
    const nx = (-dy / l) * w;
    const ny = (dx / l) * w;
    ctx.beginPath();
    ctx.moveTo(x0 + ox + nx, y0 + oy + ny);
    ctx.lineTo(x1 + ox + nx, y1 + oy + ny);
    ctx.lineTo(x1 + ox - nx, y1 + oy - ny);
    ctx.lineTo(x0 + ox - nx, y0 + oy - ny);
    ctx.closePath();
    ctx.fillStyle = '#020202';
    ctx.fill();
    // Rim light on the edge that faces the core.
    ctx.strokeStyle = rgba(C.amber, 0.16 * s.power);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x0 + ox - nx, y0 + oy - ny);
    ctx.lineTo(x1 + ox - nx, y1 + oy - ny);
    ctx.stroke();
  };
  beam(-260, 1560, 520, 2140, 70);
  beam(1360, 300, 640, -260, 62);
  ctx.restore();
  void W;
  void H;
};

const drawGrade = (ctx: Ctx, tex: Textures, W: number, H: number, heat: number) => {
  ctx.save();
  const v = ctx.createRadialGradient(STAGE.cx, STAGE.cy + 60, 520, STAGE.cx, STAGE.cy + 60, 1350);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, `rgba(0,0,0,${(0.5 - 0.06 * heat).toFixed(3)})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  const pat = ctx.createPattern(tex.dither, 'repeat')!;
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
};
