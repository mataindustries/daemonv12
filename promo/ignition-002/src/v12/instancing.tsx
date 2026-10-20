// Draw-call economy. Software WebGL pays ~10 ms per draw call whatever its size, so repeated
// parts are drawn as instances (one call per part, every copy posed each frame) and parts that
// never move relative to each other are merged into one geometry per material.
import {useThree} from '@react-three/fiber';
import {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const step = new THREE.Matrix4();

/** Composes a transform in reading order, the way nested groups do: at(m).t(x, y, z).rz(a)… */
export const at = (m = new THREE.Matrix4()) => {
  const then = (n: THREE.Matrix4) => {
    m.multiply(n);
    return api;
  };
  const api = {
    m,
    t: (x: number, y: number, z: number) => then(step.makeTranslation(x, y, z)),
    rx: (a: number) => then(step.makeRotationX(a)),
    ry: (a: number) => then(step.makeRotationY(a)),
    rz: (a: number) => then(step.makeRotationZ(a)),
    s: (x: number, y: number, z: number) => then(step.makeScale(x, y, z)),
    q: (q: THREE.Quaternion) => then(step.makeRotationFromQuaternion(q)),
  };
  return api;
};

/** Merges static parts, each at its placement, into one geometry. */
export const bake = (parts: [THREE.BufferGeometry, THREE.Matrix4][]) => {
  const merged = mergeGeometries(parts.map(([g, m]) => (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m)));
  if (!merged) throw new Error('bake: parts have different attributes');
  return merged;
};

export type Place = (i: number, m: THREE.Matrix4, c: THREE.Color) => void;

/** One draw call for `count` copies of a part; `place` poses (and, if tinted, colours) each copy. */
export const Many: React.FC<{geometry: THREE.BufferGeometry; material: THREE.Material; count: number; place: Place; tinted?: boolean; castShadow?: boolean; receiveShadow?: boolean}> = ({
  geometry,
  material,
  count,
  place,
  tinted = false,
  castShadow = false,
  receiveShadow = false,
}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current!;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      m.identity();
      c.setRGB(1, 1, 1);
      place(i, m, c);
      mesh.setMatrixAt(i, m);
      if (tinted) mesh.setColorAt(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  // Copies move every frame, so the bounding volume computed once would cull them wrongly.
  return <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} castShadow={castShadow} receiveShadow={receiveShadow} />;
};

/** Additive material for camera-facing glows; each glow's colour comes from its instance. */
export const glowCardMaterial = (map: THREE.Texture) => new THREE.MeshBasicMaterial({map, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false});

/**
 * Camera-facing soft glows in one call (in place of one sprite each). `place` sets a glow's
 * position and colour and returns its size; size 0 hides it.
 */
export const Glows: React.FC<{count: number; material: THREE.Material; place: (i: number, p: THREE.Vector3, c: THREE.Color) => number}> = ({count, material, place}) => {
  const camera = useThree(st => st.camera);
  const card = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const p = new THREE.Vector3();
  const size = new THREE.Vector3();
  return (
    <Many
      geometry={card}
      material={material}
      count={count}
      tinted
      place={(i, m, c) => {
        const k = place(i, p, c);
        m.compose(p, camera.quaternion, size.setScalar(k));
      }}
    />
  );
};
