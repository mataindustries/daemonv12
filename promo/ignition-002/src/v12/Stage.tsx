// The set around the engine: mounts and cradle, a grated floor, the back wall, light shafts,
// studio lights, a periodic ember system from the stacks, the camera rig and post-processing.
import {useFrame, useThree} from '@react-three/fiber';
import {useLayoutEffect, useMemo, useRef} from 'react';
import {useCurrentFrame, useDelayRender} from 'remotion';
import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {FXAAShader} from 'three/examples/jsm/shaders/FXAAShader.js';
import type {V12State} from './choreo.ts';
import {CYLINDERS, GEO} from './kinematics.ts';
import {HOT, glowMaterial, softSprite, studioScene, type Materials} from './materials.ts';
import {STACKS, STACK_TOP} from './Engine.tsx';
import {Glows, at, bake, glowCardMaterial} from './instancing.tsx';
import {LOOP} from '../timeline.ts';
import {hash01} from '../motion/periodic.ts';

export const FLOOR_Y = -1.55;

export const EngineHall: React.FC<{s: V12State; m: Materials}> = ({s, m}) => {
  const geo = useMemo(() => {
    const beam = new THREE.BoxGeometry(0.16, 0.34, 8.2);
    const flange = new THREE.BoxGeometry(0.44, 0.06, 8.2);
    const pedestal = new THREE.BoxGeometry(0.42, FLOOR_Y * -1 - 0.95, 0.42);
    const mount = new THREE.CylinderGeometry(0.2, 0.24, 0.3, 24);
    const wallRib = new THREE.BoxGeometry(0.5, 14, 0.5);
    const rails = [0.95, -0.95];
    return {
      floor: new THREE.PlaneGeometry(60, 60),
      wall: new THREE.PlaneGeometry(40, 16),
      pool: new THREE.CircleGeometry(4.5, 48),
      // Cradle: two I-beams on four pedestals, rubber-steel mounts under the end bulkheads.
      cradle: bake(
        rails.flatMap(x => [
          [beam, at().t(x, -0.95, 0).m],
          [flange, at().t(x, -0.95 + 0.2, 0).m],
          [flange, at().t(x, -0.95 - 0.2, 0).m],
          ...[3.6, -3.6].map(z => [pedestal, at().t(x, -0.95 + (FLOOR_Y + 0.95) / 2 - 0.25, z).m] as [THREE.BufferGeometry, THREE.Matrix4]),
        ] as [THREE.BufferGeometry, THREE.Matrix4][]),
      ),
      mounts: bake(rails.flatMap(x => [3.15, -3.15].map(z => [mount, at().t(x + (x > 0 ? -0.25 : 0.25), -0.95 + 0.36, z).m] as [THREE.BufferGeometry, THREE.Matrix4]))),
      wallRibs: bake([-4, -3, -2, 2, 3, 4].map(i => [wallRib, at().t(i * 3.2, 4, -12.6).m])),
    };
  }, []);
  const poolMat = useMemo(() => {
    const mat = glowMaterial(HOT.molten, 0.2);
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g2 = c.getContext('2d')!;
    const grad = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 128, 128);
    mat.map = new THREE.CanvasTexture(c);
    return mat;
  }, []);
  const backMat = useMemo(() => new THREE.SpriteMaterial({map: softSprite(), color: new THREE.Color('#5a6a88'), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, fog: false}), []);
  poolMat.opacity = 0.015 + 0.04 * s.headerHeat + 0.06 * s.overdrive;
  backMat.opacity = 0.07 + 0.03 * s.power + 0.03 * s.overdrive;
  return (
    <group>
      {/* The floor is near-black: sampling shadows over half the frame cost ~0.5 s a frame for nothing visible. */}
      <mesh geometry={geo.floor} material={m.floor} rotation-x={-Math.PI / 2} position-y={FLOOR_Y} />
      <mesh geometry={geo.pool} material={poolMat} rotation-x={-Math.PI / 2} position={[0, FLOOR_Y + 0.01, 0]} />
      <mesh geometry={geo.cradle} material={m.darkSteel} castShadow receiveShadow />
      <mesh geometry={geo.mounts} material={m.rubber} castShadow />
      {/* Back wall of the engine hall, ribbed, lost in the haze. */}
      <mesh geometry={geo.wall} material={m.wall} position={[0, 4, -13]} />
      <mesh geometry={geo.wallRibs} material={m.block} />
      {/* Soft backlight in the haze behind the engine, so the silhouette reads against the hall. */}
      <sprite material={backMat} position={[0, 2.6, -7]} scale={[16, 11, 1]} />
    </group>
  );
};

// ---------------------------------------------------------------------------------------------

/** Embers from the four stacks: each particle repeats a whole number of times per loop. */
export const Embers: React.FC<{s: V12State}> = ({s}) => {
  const N = 160;
  const {points, positions, colors} = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({size: 0.06, map: softSprite(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false});
    return {points: new THREE.Points(geo, mat), positions, colors};
  }, []);
  for (let i = 0; i < N; i++) {
    const st = STACKS[i % 4]!;
    const cycles = 9 + Math.floor(hash01(i, 1) * 8);
    const period = LOOP / cycles;
    const life = period * (0.55 + 0.4 * hash01(i, 2));
    const age = (((s.t + hash01(i, 3) * period) % period) + period) % period;
    const a = age < life ? age : -1;
    const top = new THREE.Vector3(st.x * 1.1, STACK_TOP, st.z - 0.4);
    if (a < 0) {
      positions.set([0, -50, 0], i * 3);
      colors.set([0, 0, 0], i * 3);
      continue;
    }
    const ang = hash01(i, 4) * Math.PI * 2;
    const spread = 0.35 + 0.5 * hash01(i, 5);
    const up = 1.6 + 1.6 * hash01(i, 6);
    const x = top.x + Math.cos(ang) * spread * a;
    const z = top.z + Math.sin(ang) * spread * a - 0.5 * a;
    const y = top.y + up * a - 0.9 * a * a;
    positions.set([x, y, z], i * 3);
    const fade = (1 - a / life) * (0.25 + 0.5 * s.flame + 0.35 * s.overdrive + 0.2 * s.bass);
    const hot = HOT.amber.clone().lerp(HOT.white, Math.max(0, 1 - a * 3)).multiplyScalar(1.8 * fade);
    colors.set([hot.r, hot.g, hot.b], i * 3);
  }
  points.geometry.attributes.position!.needsUpdate = true;
  points.geometry.attributes.color!.needsUpdate = true;
  return <primitive object={points} />;
};

/** Flames at the stack outlets on the snares and through OVERDRIVE: three glows per stack, one draw. */
const FLAME_COLORS = [HOT.white, HOT.amber, HOT.molten].map(c => c.clone().multiplyScalar(2.5));
export const Flames: React.FC<{s: V12State}> = ({s}) => {
  const mat = useMemo(() => glowCardMaterial(softSprite()), []);
  return (
    <Glows
      count={STACKS.length * 3}
      material={mat}
      place={(i, p, c) => {
        const k = Math.floor(i / 3);
        const j = i % 3;
        const st = STACKS[k]!;
        const f = s.flame * (0.75 + 0.5 * hash01(s.flameSeed, k));
        if (f < 0.02) return 0;
        p.set(st.x * 1.1, STACK_TOP + 0.05 + 0.1 + j * 0.2 * f, st.z - 0.4 - 0.06 * j * f);
        c.copy(FLAME_COLORS[j]!);
        return (0.18 + j * 0.14) * f + 0.03;
      }}
    />
  );
};

// ---------------------------------------------------------------------------------------------

export const Lights: React.FC<{s: V12State; shadows?: boolean; few?: boolean}> = ({s, shadows = true, few = false}) => {
  // Warm, engine-born light falls away in the music's full stop; the studio light stays.
  const live = 1 - 0.8 * s.drop;
  const lit = s.lit.map(l => {
    const cyl = CYLINDERS[l.i]!;
    const d = GEO.deck - 0.25;
    return {pos: [Math.sin(cyl.beta) * d, Math.cos(cyl.beta) * d, cyl.z] as [number, number, number], v: s.cylinders[l.i]!.heat};
  });
  return (
    <>
      <ambientLight intensity={0.05} />
      {/* Cool fill from the lens side so pistons and rods read inside the shadow of the heads. */}
      <directionalLight position={[5, 2.5, 12]} intensity={0.55} color="#c8d6ff" />
      {/* Cool rim from above and behind: separates the silhouette from the hall. */}
      <directionalLight position={[1, 9, -10]} intensity={1.1} color="#bccbff" />
      {/* Warm light inside the crankcase: the heart of the engine glows through the cages. */}
      <pointLight position={[0, 0.7, 0.4]} intensity={(4 + 6 * s.power + 12 * s.overdrive + 4 * s.kick + 7 * s.accent) * live} distance={6.5} color="#ff9a48" />
      <directionalLight position={[-6, 11, 7]} intensity={1.15 + 0.3 * s.power} color="#dce6ff" castShadow={shadows} shadow-mapSize={[1024, 1024]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={7} shadow-camera-bottom={-4} shadow-bias={-0.0004} />
      {few ? null : (
        <>
      <spotLight position={[-7, 5, -8]} angle={0.5} penumbra={0.8} intensity={(45 + 18 * s.overdrive + 12 * s.accent) * (1 - 0.5 * s.drop)} color="#ffb070" />
      <spotLight position={[7.5, 3.5, -6]} angle={0.5} penumbra={0.8} intensity={(38 + 16 * s.overdrive + 10 * s.accent) * (1 - 0.5 * s.drop)} color="#ff9850" />
      <pointLight position={[0, 3.3, 0]} intensity={(2.5 + 10 * s.headerHeat + 5 * s.snare) * live} distance={8} color="#ff7a2a" />
      {lit.slice(0, 1).map((l, i) => (
        <pointLight key={i} position={l.pos} intensity={2.4 * Math.min(1.2, l.v)} distance={3} color="#ffb060" />
      ))}
        </>
      )}
    </>
  );
};

export const CameraRig: React.FC<{s: V12State}> = ({s}) => {
  const {camera} = useThree();
  useLayoutEffect(() => {
    const c = s.camera;
    const target = new THREE.Vector3(0, c.ty, c.tz);
    const pos = new THREE.Vector3(c.dist * Math.cos(c.el) * Math.sin(c.az), c.dist * Math.sin(c.el), c.dist * Math.cos(c.el) * Math.cos(c.az)).add(target);
    camera.position.copy(pos);
    camera.lookAt(target);
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = c.fov;
    cam.near = 0.1;
    cam.far = 80;
    cam.updateProjectionMatrix();
  });
  return null;
};

/**
 * Guard before bloom: a single NaN or infinite pixel would otherwise be blurred over the whole frame.
 * It also clamps fireflies: specular glints of the spot lights on polished metal reach > 16 in
 * HDR and bloomed into a grey haze over the low shots of bar 5. The emissive glows peak near 4.
 */
export const HDR_MAX = 6;
const SANITIZE = {
  uniforms: {tDiffuse: {value: null}, uMax: {value: HDR_MAX}},
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uMax; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      bool bad = isnan(c.r) || isnan(c.g) || isnan(c.b) || isinf(c.r) || isinf(c.g) || isinf(c.b);
      gl_FragColor = bad ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(clamp(c.rgb, 0.0, uMax), c.a); }`,
};


/**
 * Studio environment, tone mapping and the post chain. The composer renders once per Remotion
 * frame when @remotion/three advances R3F; it reads the state set by this frame and animates nothing.
 */
export const Post: React.FC<{s: V12State; fog?: boolean; post?: boolean; msaa?: boolean; bloom?: boolean; shadows?: boolean; stats?: boolean; hdrMax?: number}> = ({s, fog = true, post = true, msaa = true, bloom: useBloom = true, shadows = true, stats = false, hdrMax = HDR_MAX}) => {
  const {gl, scene, camera, size} = useThree();
  const {composer, bloom} = useMemo(() => {
    // No MSAA: under software WebGL it cost ~45 % of every frame; FXAA after tone mapping instead.
    // Sized in device pixels: at --scale 0.5 the scene is shaded at 540×960, not at the canvas's CSS size.
    const dpr = gl.getPixelRatio();
    const target = new THREE.WebGLRenderTarget(Math.round(size.width * dpr), Math.round(size.height * dpr), {type: THREE.HalfFloatType, samples: 0});
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    const sanitize = new ShaderPass(SANITIZE);
    sanitize.uniforms.uMax!.value = hdrMax;
    composer.addPass(sanitize);
    // Bloom at half resolution: it is a wide blur, and its passes are a large share of a software-rendered frame.
    const bloom = new UnrealBloomPass(new THREE.Vector2(size.width / 2, size.height / 2), 0.45, 0.5, 0.92);
    if (useBloom) composer.addPass(bloom);
    composer.addPass(new OutputPass());
    if (msaa) {
      const fxaa = new ShaderPass(FXAAShader);
      fxaa.material.uniforms.resolution!.value.set(1 / (size.width * dpr), 1 / (size.height * dpr));
      composer.addPass(fxaa);
    }
    return {composer, bloom};
  }, [gl, scene, camera, size.width, size.height, msaa, useBloom, hdrMax]);
  useLayoutEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    scene.environment = pm.fromScene(studioScene(), 0.02).texture;
    scene.environmentIntensity = 1.25;
    scene.background = new THREE.Color('#050404');
    scene.fog = fog ? new THREE.FogExp2('#070605', 0.028) : null;
    gl.shadowMap.enabled = shadows;
    gl.shadowMap.type = THREE.PCFShadowMap;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
  }, [gl, scene, fog, shadows]);
  bloom.strength = s.bloom;
  gl.toneMappingExposure = s.exposure;
  // Every Remotion frame is held until the composer has actually drawn it, so no frame can be
  // captured from a cleared canvas (the first frame of a render tab included). A frame that never
  // draws fails the render with a timeout instead of passing silently as black.
  const frame = useCurrentFrame();
  const {delayRender, continueRender} = useDelayRender();
  const pending = useRef<number | null>(null);
  const compiled = useRef(false);
  useLayoutEffect(() => {
    const handle = delayRender(`V12: drawing frame ${frame}`);
    pending.current = handle;
    return () => {
      if (pending.current === handle) {
        pending.current = null;
        continueRender(handle);
      }
    };
  }, [frame, delayRender, continueRender]);
  // Rendering only (no animation): R3F calls this when @remotion/three advances the frame.
  useFrame(() => {
    if (!compiled.current) {
      gl.compile(scene, camera);
      compiled.current = true;
    }
    const t0 = performance.now();
    if (stats) {
      gl.info.autoReset = false;
      gl.info.reset();
    }
    if (post) composer.render();
    else gl.render(scene, camera);
    if (stats) {
      const t1 = performance.now();
      gl.getContext().finish();
      console.log(`V12STATS frame=${frame} calls=${gl.info.render.calls} tris=${gl.info.render.triangles} render=${(t1 - t0).toFixed(0)}ms finish=${(performance.now() - t1).toFixed(0)}ms`);
    }
    if (pending.current !== null) {
      const handle = pending.current;
      pending.current = null;
      continueRender(handle);
    }
  }, 1);
  return null;
};
