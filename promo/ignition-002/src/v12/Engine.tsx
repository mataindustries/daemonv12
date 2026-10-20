// The V12 itself. Everything here is posed from a V12State; nothing animates on its own.
// Software WebGL pays ~10 ms per draw call, so the twelve of everything are instances of one
// part (one call each), and parts that never move relative to each other are baked together.
import {useMemo} from 'react';
import * as THREE from 'three';
import type {V12State} from './choreo.ts';
import {CRANK_REVS, CYLINDERS, GEO, THROW_PHASE} from './kinematics.ts';
import {bulkhead, camLobe, crankWeb, eye, gear, piston, rodShank, roundedBar, spring, tube} from './geometry.ts';
import {beltPath, beltTeeth, type Pulley} from './belt.ts';
import {Glows, Many, at, bake, glowCardMaterial} from './instancing.tsx';
import {HEADER_TUBES, HOT, glowMaterial, headerMaterial, headerUniforms, softSprite, type Materials} from './materials.ts';

const QUARTER = Math.PI / 2;
const throwZ = (k: number) => (2.5 - k) * GEO.pitch;
const ENGINE_FRONT = 3.25;
const ENGINE_REAR = -3.25;
const CAGE_BASE = 1.2;
const SHAFT_FRONT = 3.3;
const SHAFT_REAR = -3.6;
const CRANK_PULLEY = 0.13;
const CAM_PULLEY = 2 * CRANK_PULLEY;
/** Same size as the crank sprocket: the idler turns exactly ten times per loop. */
const IDLER = CRANK_PULLEY;
const BELT_Z = {R: 3.42, L: 3.56} as const;
const HEAD_BLOCK = 0.24;
const CAM_Y = GEO.deck + 0.66;
const CAM_X = 0.25;
const BASE_R = 0.085;
const VALVE_LIFT = 0.06;
const PEAK_EX = (270 * Math.PI) / 180;
const PEAK_IN = (460 * Math.PI) / 180;
const COIL_Y = GEO.deck + HEAD_BLOCK + 0.13;

const sideOf = (bank: 'R' | 'L'): 1 | -1 => (bank === 'R' ? 1 : -1);
/** A bank's frame: its cylinder axes are its y axis. */
const bankAt = (side: 1 | -1, m?: THREE.Matrix4) => at(m).rz(-side * GEO.bank);
/** A cylinder's frame: y along its bore, at its place on the crank. */
const cylAt = (i: number, m?: THREE.Matrix4) => at(m).t(0, 0, CYLINDERS[i]!.z).rz(-CYLINDERS[i]!.beta);

/** Four valves per cylinder (two exhaust, two intake), 48 in all, in a fixed order. */
const VALVES = CYLINDERS.flatMap((cyl, i) => {
  const side = sideOf(cyl.bank);
  return (['ex', 'in'] as const).flatMap(kind =>
    [-0.16, 0.16].map(dz => ({i, side, kind, x: (kind === 'ex' ? -CAM_X : CAM_X) * side, peak: kind === 'ex' ? PEAK_EX : PEAK_IN, z: cyl.z + dz})),
  );
});
/** Each bank's two cam covers. */
const COVERS = ([1, -1] as const).flatMap(side => [-CAM_X * side, CAM_X * side].map(x => ({side, x})));

// ---------------------------------------------------------------------------------------------
// Front timing drive: a chain per bank from the crank to both cam sprockets (twice the crank
// sprocket's size, so the cams turn at exactly half speed) around a tensioner idler.

/** World x–y of a cam (exhaust or intake) at the front of a bank, matching the head transform. */
const camXY = (side: 1 | -1, x: number): [number, number] => {
  const a = side * GEO.bank;
  return [x * Math.cos(a) + CAM_Y * Math.sin(a), -x * Math.sin(a) + CAM_Y * Math.cos(a)];
};

const DRIVES = ([1, -1] as const).map(side => {
  const ex = camXY(side, -CAM_X * side);
  const inn = camXY(side, CAM_X * side);
  const idler: [number, number] = [0.43 * side, 1.15];
  // Counter-clockwise around the hull: right bank crank → intake → exhaust → idler; mirrored for the left.
  const ring: Pulley[] =
    side === 1
      ? [{x: 0, y: 0, r: CRANK_PULLEY + 0.02}, {x: inn[0], y: inn[1], r: CAM_PULLEY + 0.02}, {x: ex[0], y: ex[1], r: CAM_PULLEY + 0.02}, {x: idler[0], y: idler[1], r: IDLER + 0.02}]
      : [{x: 0, y: 0, r: CRANK_PULLEY + 0.02}, {x: idler[0], y: idler[1], r: IDLER + 0.02}, {x: ex[0], y: ex[1], r: CAM_PULLEY + 0.02}, {x: inn[0], y: inn[1], r: CAM_PULLEY + 0.02}];
  const path = beltPath(ring);
  const teeth = beltTeeth(path.length, CRANK_PULLEY + 0.02, CRANK_REVS, 0.085);
  return {side, cams: [ex, inn], idler, path, teeth, z: side === 1 ? BELT_Z.R : BELT_Z.L};
});
const LINKS = DRIVES.flatMap(d => Array.from({length: d.teeth.teeth}, (_, i) => ({d, i})));

// ---------------------------------------------------------------------------------------------
// Hot-V exhaust: each cylinder's primary leaves the inner face of its head and climbs into one of
// four collectors that rise above the V as stacks.

const portOf = (cylN: number): THREE.Vector3 => {
  const cyl = CYLINDERS[cylN - 1]!;
  const ax = new THREE.Vector2(Math.sin(cyl.beta), Math.cos(cyl.beta));
  const out = new THREE.Vector2(Math.cos(cyl.beta), -Math.sin(cyl.beta)).multiplyScalar(cyl.bank === 'R' ? 1 : -1);
  const p = ax.clone().multiplyScalar(GEO.deck + 0.12).add(out.clone().multiplyScalar(-0.58));
  return new THREE.Vector3(p.x, p.y, cyl.z);
};

export const STACKS = [
  {x: 0.36, z: 1.58, cyls: [1, 2, 3]},
  {x: 0.36, z: -1.58, cyls: [4, 5, 6]},
  {x: -0.36, z: 1.34, cyls: [7, 8, 9]},
  {x: -0.36, z: -1.82, cyls: [10, 11, 12]},
] as const;
export const STACK_TOP = 4.15;

/** The twelve primaries (tubes 0–11, in STACKS order), then the four stacks (tubes 12–15). */
const PRIMARIES = STACKS.flatMap(st =>
  st.cyls.map(n => {
    const p0 = portOf(n);
    const sx = Math.sign(st.x);
    return {
      n,
      pts: [
        p0,
        new THREE.Vector3(p0.x - sx * 0.2, p0.y + 0.12, p0.z),
        new THREE.Vector3(st.x + sx * 0.12, 2.95, THREE.MathUtils.lerp(p0.z, st.z, 0.45)),
        new THREE.Vector3(st.x + sx * 0.03, 3.38, THREE.MathUtils.lerp(p0.z, st.z, 0.88)),
        new THREE.Vector3(st.x, 3.62, st.z),
      ],
    };
  }),
);
const STACK_PATHS = STACKS.map(st => [new THREE.Vector3(st.x, 3.35, st.z), new THREE.Vector3(st.x, 3.68, st.z - 0.06), new THREE.Vector3(st.x * 1.05, 3.94, st.z - 0.22), new THREE.Vector3(st.x * 1.1, STACK_TOP, st.z - 0.4)]);

/** All sixteen tubes in one geometry, each vertex tagged with its tube. */
const headerGeometry = () =>
  bake(
    [...PRIMARIES.map(p => tube(p.pts, 0.085)), ...STACK_PATHS.map(pts => tube(pts, 0.165, 48))].map((g, k) => {
      g.setAttribute('aTube', new THREE.BufferAttribute(new Float32Array(g.attributes.position!.count).fill(k), 1));
      return [g, new THREE.Matrix4()] as [THREE.BufferGeometry, THREE.Matrix4];
    }),
  );

// ---------------------------------------------------------------------------------------------

/** Every part's geometry, built once; static assemblies are baked into one geometry per material. */
const useParts = () =>
  useMemo(() => {
    const ring = new THREE.TorusGeometry(0.44, 0.03, 8, 48);
    const rib = new THREE.BoxGeometry(0.06, GEO.deck - CAGE_BASE, 0.06);
    const pin = new THREE.CylinderGeometry(0.17, 0.17, 0.52, 36);
    const web = crankWeb();
    const bolt = new THREE.CylinderGeometry(0.028, 0.028, 0.2, 10);
    const camShaft = new THREE.CylinderGeometry(0.055, 0.055, ENGINE_FRONT - ENGINE_REAR - 0.2, 20);
    const stub = new THREE.CylinderGeometry(0.05, 0.05, 0.36, 16);
    const lip = new THREE.CylinderGeometry(0.23, 0.17, 0.22, 36, 1, true);
    const up = new THREE.Vector3(0, 1, 0);
    const banks = [1, -1] as const;
    return {
      // Turning with the crank (posed inside its group).
      crankBody: bake([
        [new THREE.CylinderGeometry(0.2, 0.2, SHAFT_FRONT - SHAFT_REAR, 40), at().t(0, 0, (SHAFT_FRONT + SHAFT_REAR) / 2).rx(QUARTER).m],
        ...THROW_PHASE.flatMap((phi, k) => [-0.315, 0.315].map(dz => [web, at().t(0, 0, throwZ(k) + dz).rz(-phi).m] as [THREE.BufferGeometry, THREE.Matrix4])),
      ]),
      crankSteel: bake([
        [new THREE.CylinderGeometry(0.1, 0.1, 0.42, 24), at().t(0, 0, SHAFT_FRONT + 0.2).rx(QUARTER).m],
        ...Object.values(BELT_Z).map(z => [gear(18, CRANK_PULLEY - 0.02, 0.1, 0.025), at().t(0, 0, z).m] as [THREE.BufferGeometry, THREE.Matrix4]),
        [new THREE.CylinderGeometry(0.55, 0.55, 0.22, 48), at().t(0, 0, SHAFT_REAR + 0.32).rx(QUARTER).m],
        ...THROW_PHASE.map((phi, k) => [pin, at().t(0, 0, throwZ(k)).t(GEO.r * Math.sin(phi), GEO.r * Math.cos(phi), 0).rx(QUARTER).m] as [THREE.BufferGeometry, THREE.Matrix4]),
      ]),
      flywheel: gear(96, 0.92, 0.16, 0.035).translate(0, 0, SHAFT_REAR + 0.12),
      // Instanced per cylinder.
      rod: bake([
        [rodShank(), at().m],
        [eye(0.255, 0.17, 0.16), at().m],
        [eye(0.14, 0.085, 0.13), at().t(0, GEO.l, 0).m],
      ]),
      bolts: bake([-0.2, 0.2].map(x => [bolt, at().t(x, 0.02, 0).m])),
      piston: piston(),
      wristPin: new THREE.CylinderGeometry(0.085, 0.085, 0.66, 20),
      // Combustion light: an open chamber of unit height standing on the glowing crown.
      chamber: bake([
        [new THREE.CylinderGeometry(0.37, 0.37, 1, 28, 1, true), at().t(0, 0.5, 0).m],
        [new THREE.CircleGeometry(0.34, 40), at().t(0, 0.002, 0).rx(-QUARTER).m],
      ]),
      fireRing: new THREE.TorusGeometry(0.43, 0.022, 6, 48),
      lobe: camLobe(),
      stem: new THREE.CylinderGeometry(0.02, 0.02, 1, 10),
      spring: spring(),
      bucket: new THREE.CylinderGeometry(0.06, 0.06, 0.07, 20),
      cover: roundedBar(0.38, 0.26, 0.11, ENGINE_FRONT - ENGINE_REAR - 0.25, 0.02),
      link: new THREE.BoxGeometry(0.07, 0.04, 0.1),
      camPulley: gear(36, CAM_PULLEY - 0.02, 0.1, 0.025),
      idler: gear(14, IDLER - 0.02, 0.1, 0.025),
      headers: headerGeometry(),
      // Static structure, one geometry per material.
      bulkheads: bake([0, 3, 6].map(k => [bulkhead(), at().t(0, 0, (3 - k) * GEO.pitch).m])),
      /** Bank rails and head blocks: heavy titanium that casts shadows. */
      frame: bake(
        banks.flatMap(side => [
          ...[-0.5, 0.5].map(x => [new THREE.BoxGeometry(0.16, 0.16, ENGINE_FRONT - ENGINE_REAR), bankAt(side).t(x, 1.25, 0).m] as [THREE.BufferGeometry, THREE.Matrix4]),
          [roundedBar(1.12, HEAD_BLOCK, 0.05, ENGINE_FRONT - ENGINE_REAR - 0.1), bankAt(side).t(0, GEO.deck + HEAD_BLOCK / 2, 0).m] as [THREE.BufferGeometry, THREE.Matrix4],
        ]),
      ),
      /** Bearing caps, cylinder-cage ribs and the stack lips. */
      trim: bake([
        ...[1, 2, 4, 5].map(k => [eye(0.34, 0.2, 0.14), at().t(0, 0, (3 - k) * GEO.pitch).m] as [THREE.BufferGeometry, THREE.Matrix4]),
        ...CYLINDERS.flatMap((_, i) =>
          Array.from({length: 8}, (_, j) => {
            const a = (j / 8) * Math.PI * 2 + Math.PI / 8;
            return [rib, cylAt(i).t(Math.cos(a) * 0.45, (CAGE_BASE + GEO.deck) / 2, Math.sin(a) * 0.45).ry(-a).m] as [THREE.BufferGeometry, THREE.Matrix4];
          }),
        ),
        ...STACK_PATHS.map(pts => [lip, at().t(pts[3]!.x, pts[3]!.y, pts[3]!.z).q(new THREE.Quaternion().setFromUnitVectors(up, pts[3]!.clone().sub(pts[2]!).normalize())).m] as [THREE.BufferGeometry, THREE.Matrix4]),
      ]),
      /** Cylinder-cage rings, camshafts and the cam-sprocket stubs. */
      bright: bake([
        ...CYLINDERS.flatMap((_, i) => [CAGE_BASE + 0.02, 1.58, 1.92, GEO.deck - 0.02].map(y => [ring, cylAt(i).t(0, y, 0).rx(QUARTER).m] as [THREE.BufferGeometry, THREE.Matrix4])),
        ...banks.flatMap(side => [-CAM_X, CAM_X].map(x => [camShaft, bankAt(side).t(x, CAM_Y, side * GEO.stagger).rx(QUARTER).m] as [THREE.BufferGeometry, THREE.Matrix4])),
        ...DRIVES.flatMap(d => d.cams.map(c => [stub, at().t(c[0], c[1], d.z - 0.2).rx(QUARTER).m] as [THREE.BufferGeometry, THREE.Matrix4])),
      ]),
      camCaps: bake(banks.flatMap(side => Array.from({length: 7}, (_, k) => [new THREE.BoxGeometry(0.98, 0.16, 0.11), bankAt(side).t(0, CAM_Y, (3 - k) * GEO.pitch + side * GEO.stagger).m] as [THREE.BufferGeometry, THREE.Matrix4]))),
      coils: bake(CYLINDERS.map(cyl => [new THREE.BoxGeometry(0.17, 0.2, 0.22), bankAt(sideOf(cyl.bank)).t(0, COIL_Y, cyl.z).m])),
    };
  }, []);

// ---------------------------------------------------------------------------------------------

export const Engine: React.FC<{s: V12State; m: Materials}> = ({s, m}) => {
  const P = useParts();
  const fx = useMemo(() => {
    const u = headerUniforms();
    return {
      // Colour (and strength) per instance: white base, additive.
      chamber: glowMaterial(new THREE.Color(1, 1, 1), 1),
      fire: glowMaterial(new THREE.Color(1, 1, 1), 1),
      coil: glowCardMaterial(softSprite()),
      u,
      header: headerMaterial(u),
    };
  }, []);

  for (let k = 0; k < HEADER_TUBES; k++) {
    if (k < PRIMARIES.length) {
      const c = s.cylinders[PRIMARIES[k]!.n - 1]!;
      fx.u.uHeat.value[k] = s.headerHeat;
      fx.u.uPulse.value[k] = c.exhaust;
      fx.u.uPulseAmp.value[k] = c.exhaust < 0 ? 0 : (0.55 + 0.35 * s.power + 0.5 * s.snare + 0.6 * s.overdrive) * (1 - 0.6 * c.exhaust);
    } else {
      fx.u.uHeat.value[k] = s.headerHeat * 1.1;
      fx.u.uPulse.value[k] = 0.5;
      fx.u.uPulseAmp.value[k] = 0.25 * s.snare + 0.3 * s.overdrive;
    }
  }

  const open = s.reveal;
  const valveTop = (v: (typeof VALVES)[number]) => {
    const c = s.cylinders[v.i]!;
    return CAM_Y - BASE_R - (v.kind === 'ex' ? c.exLift : c.inLift) * VALVE_LIFT;
  };
  const rodAt = (i: number, mat: THREE.Matrix4) => {
    const p = s.cylinders[i]!.pose;
    const a = Math.atan2(p.wristPin[0] - p.crankPin[0], p.wristPin[1] - p.crankPin[1]);
    at(mat).t(p.crankPin[0], p.crankPin[1], CYLINDERS[i]!.z).rz(-a);
  };
  const crownY = (i: number) => s.cylinders[i]!.pose.pin + GEO.pinBelowCrown + 0.03;

  return (
    <group rotation-z={s.roll} position-y={s.shake}>
      {/* Crankshaft: journal, webs and counterweights, pins, nose sprockets, flywheel and clutch. */}
      <group rotation-z={-s.theta}>
        <mesh geometry={P.crankBody} material={m.crank} castShadow receiveShadow />
        <mesh geometry={P.crankSteel} material={m.steel} castShadow />
        <mesh geometry={P.flywheel} material={m.titanium} castShadow />
      </group>

      {/* Rods: big end on the crank pin, small end on the wrist pin. */}
      <Many geometry={P.rod} material={m.titanium} count={12} place={rodAt} castShadow />
      <Many geometry={P.bolts} material={m.gold} count={12} place={rodAt} />

      {/* Pistons, and the combustion light filling each chamber above its crown. */}
      <Many geometry={P.piston} material={m.aluminium} count={12} place={(i, mat) => cylAt(i, mat).t(0, s.cylinders[i]!.pose.pin, 0)} castShadow receiveShadow />
      <Many geometry={P.wristPin} material={m.steel} count={12} place={(i, mat) => cylAt(i, mat).t(0, s.cylinders[i]!.pose.pin, 0).rx(QUARTER)} />
      <Many
        geometry={P.chamber}
        material={fx.chamber}
        count={12}
        tinted
        place={(i, mat, col) => {
          const y = crownY(i);
          cylAt(i, mat).t(0, y, 0).s(1, Math.max(0.02, GEO.deck - y), 1);
          const h = Math.min(1.6, s.cylinders[i]!.heat);
          const opacity = Math.min(0.6, 0.03 + 0.5 * h);
          col.copy(HOT.molten).lerp(HOT.amber, Math.min(1, h)).lerp(HOT.white, Math.max(0, h - 0.8)).multiplyScalar((0.7 + 1.5 * Math.min(1, h)) * opacity);
        }}
      />
      {/* The top ring of each cage glows with its own cylinder's combustion: twelve rings in a V, lit in firing order. */}
      <Many
        geometry={P.fireRing}
        material={fx.fire}
        count={12}
        tinted
        place={(i, mat, col) => {
          cylAt(i, mat).t(0, GEO.deck - 0.24, 0).rx(QUARTER);
          const h = Math.min(1.4, s.cylinders[i]!.heat);
          col.copy(HOT.ember).lerp(HOT.amber, Math.min(1, h * 1.4)).lerp(HOT.white, Math.max(0, h - 0.75)).multiplyScalar(0.25 + 2.6 * h);
        }}
      />

      {/* Block: bulkheads, bearing caps, bank rails, open cylinder cages. */}
      <mesh geometry={P.bulkheads} material={m.block} castShadow receiveShadow />
      <mesh geometry={P.frame} material={m.titanium} castShadow receiveShadow />
      <mesh geometry={P.trim} material={m.titanium} receiveShadow />
      <mesh geometry={P.bright} material={m.steel} receiveShadow />

      {/* Heads: cam towers, camshafts, lobes, 48 valves on springs and buckets, coils, lifting carbon covers. */}
      <mesh geometry={P.camCaps} material={m.aluminium} />
      <Many
        geometry={P.lobe}
        material={m.steel}
        count={VALVES.length}
        place={(i, mat) => {
          // Nose straight down at peak lift; cams turn with the crank at half speed.
          const v = VALVES[i]!;
          bankAt(v.side, mat).t(v.x, CAM_Y, v.z).rz(-(s.cylinders[v.i]!.phase - v.peak) / 2);
        }}
      />
      <Many
        geometry={P.stem}
        material={m.steel}
        count={VALVES.length}
        place={(i, mat) => {
          const v = VALVES[i]!;
          const top = valveTop(v) - 0.07;
          bankAt(v.side, mat).t(v.x, (top + GEO.deck - 0.02) / 2, v.z).s(1, top - (GEO.deck - 0.02), 1);
        }}
      />
      <Many
        geometry={P.spring}
        material={m.gold}
        count={VALVES.length}
        place={(i, mat) => {
          const v = VALVES[i]!;
          const bottom = GEO.deck + HEAD_BLOCK;
          bankAt(v.side, mat).t(v.x, bottom, v.z).s(1, valveTop(v) - 0.07 - bottom, 1);
        }}
      />
      <Many
        geometry={P.bucket}
        material={m.aluminium}
        count={VALVES.length}
        place={(i, mat) => {
          const v = VALVES[i]!;
          bankAt(v.side, mat).t(v.x, valveTop(v) - 0.035, v.z);
        }}
      />
      <mesh geometry={P.coils} material={m.carbon} />
      <Glows
        count={12}
        material={fx.coil}
        place={(i, p, col) => {
          const cyl = CYLINDERS[i]!;
          const c = s.cylinders[i]!;
          p.set(0, COIL_Y + 0.14, cyl.z).applyMatrix4(bankAt(sideOf(cyl.bank)).m);
          col.copy(HOT.blue).multiplyScalar(3);
          return 0.01 + 0.5 * Math.min(1, c.spark + c.coil);
        }}
      />
      <Many
        geometry={P.cover}
        material={m.carbon}
        count={COVERS.length}
        place={(i, mat) => {
          const {side, x} = COVERS[i]!;
          bankAt(side, mat)
            .t(x + Math.sign(x) * 0.42 * open, CAM_Y + 0.07 + 0.7 * open, side * GEO.stagger)
            .rz(Math.sign(x) * -0.35 * open);
        }}
        castShadow
      />

      {/* Timing drive: chains, cam sprockets at half speed, idlers. */}
      <Many
        geometry={P.link}
        material={m.steel}
        count={LINKS.length}
        place={(n, mat) => {
          const {d, i} = LINKS[n]!;
          // The chain runs clockwise with the crank: its travel is the negative of the driver angle.
          const p = d.path.at(i * d.teeth.pitch - d.teeth.offset(s.theta));
          at(mat)
            .t(p.x, p.y, d.z)
            .rz(p.dir)
            .s(i % 2 === 0 ? 1 : 0.8, 1, i % 2 === 0 ? 1 : 0.7);
        }}
      />
      <Many
        geometry={P.camPulley}
        material={m.aluminium}
        count={4}
        place={(i, mat) => {
          const d = DRIVES[i >> 1]!;
          const c = d.cams[i & 1]!;
          at(mat).t(c[0], c[1], d.z).rz(-s.theta / 2);
        }}
      />
      <Many
        geometry={P.idler}
        material={m.gold}
        count={2}
        place={(i, mat) => {
          const d = DRIVES[i]!;
          at(mat).t(d.idler[0], d.idler[1], d.z).rz(-s.theta * ((CRANK_PULLEY + 0.02) / (IDLER + 0.02)));
        }}
      />

      {/* Exhaust: twelve primaries and four stacks in one draw, each tube's pulse its own. */}
      <mesh geometry={P.headers} material={fx.header} castShadow />
    </group>
  );
};
