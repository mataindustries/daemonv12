// Materials for the V12: dark PBR metals lit by a studio environment, procedural carbon fibre,
// and emissive "heat" for headers and combustion. All built once per page, deterministically.
import * as THREE from 'three';

export const HOT = {
  white: new THREE.Color('#fff4e2'),
  ignition: new THREE.Color('#ffd9a0'),
  amber: new THREE.Color('#ffa040'),
  molten: new THREE.Color('#ff5e14'),
  ember: new THREE.Color('#a8260a'),
  blue: new THREE.Color('#5fb4ff'),
};

/** Twill carbon-fibre weave as a canvas texture (seeded, no randomness). */
const carbonTexture = () => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0b0c0e';
  g.fillRect(0, 0, 256, 256);
  const cell = 16;
  for (let y = 0; y < 256 / cell; y++) {
    for (let x = 0; x < 256 / cell; x++) {
      const horizontal = (x + y) % 4 < 2;
      const grad = horizontal ? g.createLinearGradient(x * cell, y * cell, x * cell, (y + 1) * cell) : g.createLinearGradient(x * cell, y * cell, (x + 1) * cell, y * cell);
      grad.addColorStop(0, '#15171b');
      grad.addColorStop(0.5, horizontal ? '#3a3f47' : '#2b2f36');
      grad.addColorStop(1, '#121417');
      g.fillStyle = grad;
      g.fillRect(x * cell + 0.5, y * cell + 0.5, cell - 1, cell - 1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 1.2);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

/** Fine machining marks as a roughness map: concentric-free straight brushing. */
const brushedTexture = () => {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 256;
  const g = c.getContext('2d')!;
  for (let y = 0; y < 256; y++) {
    const v = 120 + Math.round(60 * Math.sin(y * 12.9898) * Math.sin(y * 0.37) ** 2);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(0, y, 8, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 4);
  return t;
};

/** Every exhaust tube's state at once: the vertices of tube k (attribute aTube = k) read entry k. */
export const HEADER_TUBES = 16;
export type HeaderUniforms = {uPulse: {value: Float32Array}; uPulseAmp: {value: Float32Array}; uHeat: {value: Float32Array}};
export const headerUniforms = (): HeaderUniforms => ({
  uPulse: {value: new Float32Array(HEADER_TUBES).fill(-1)},
  uPulseAmp: {value: new Float32Array(HEADER_TUBES)},
  uHeat: {value: new Float32Array(HEADER_TUBES).fill(0.2)},
});

/** Exhaust-header metal whose emission follows a gas pulse travelling along each tube (uv.x). */
export const headerMaterial = (u: HeaderUniforms) => {
  const m = new THREE.MeshStandardMaterial({color: '#2e2c2b', metalness: 1, roughness: 0.24});
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aTube;
        uniform float uPulse[${HEADER_TUBES}];
        uniform float uPulseAmp[${HEADER_TUBES}];
        uniform float uHeat[${HEADER_TUBES}];
        varying float vRun;
        varying vec3 vTube;`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        vRun = uv.x;
        int tube = int(aTube + 0.5);
        vTube = vec3(uPulse[tube], uPulseAmp[tube], uHeat[tube]);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vRun;\nvarying vec3 vTube;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float near = 1.0 - smoothstep(0.0, 0.42, vRun);
        float heat = vTube.z * (0.06 + 0.94 * near * near);
        float d = (vRun - vTube.x) / 0.13;
        float pulse = vTube.y * exp(-d * d);
        vec3 hot = mix(vec3(0.9, 0.16, 0.02), vec3(1.0, 0.62, 0.22), clamp(heat + pulse, 0.0, 1.0));
        totalEmissiveRadiance += hot * (heat * 0.55 + pulse * 2.6);`,
      );
  };
  return m;
};

/**
 * Standard (not Physical) materials by default: under software WebGL clearcoat cost ~10 % of every
 * frame for a sheen the camera barely resolves. Physical is kept available for comparison.
 */
export const makeMaterials = (standardOnly = true) => {
  const carbon = carbonTexture();
  const brushed = brushedTexture();
  const P = (o: THREE.MeshPhysicalMaterialParameters) => {
    if (!standardOnly) return new THREE.MeshPhysicalMaterial(o);
    const {clearcoat, clearcoatRoughness, ...rest} = o;
    void clearcoat;
    void clearcoatRoughness;
    return new THREE.MeshStandardMaterial(rest as THREE.MeshStandardMaterialParameters);
  };
  return {
    titanium: P({color: '#1c1e22', metalness: 1, roughness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.25}),
    block: new THREE.MeshStandardMaterial({color: '#25282d', metalness: 1, roughness: 0.42}),
    steel: P({color: '#9aa1a9', metalness: 1, roughness: 0.2, roughnessMap: brushed}),
    crank: P({color: '#7d848c', metalness: 1, roughness: 0.17, clearcoat: 0.2}),
    // No anisotropy: without tangents it derives them from UV derivatives, which are degenerate at
    // the piston crown's lathe pole and produced NaN pixels.
    aluminium: P({color: '#c4c9cf', metalness: 1, roughness: 0.3, roughnessMap: brushed, clearcoat: 0.25}),
    darkSteel: new THREE.MeshStandardMaterial({color: '#121316', metalness: 0.9, roughness: 0.55}),
    carbon: P({map: carbon, metalness: 0.25, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.08}),
    gold: new THREE.MeshStandardMaterial({color: '#b88a4a', metalness: 1, roughness: 0.3}),
    rubber: new THREE.MeshStandardMaterial({color: '#0a0a0b', metalness: 0, roughness: 0.85}),
    // The near-black floor and wall are cheap Lambert surfaces: their fill was a large share of every frame.
    floor: new THREE.MeshLambertMaterial({color: '#0c0d0f'}),
    wall: new THREE.MeshLambertMaterial({color: '#0e0f12'}),
  };
};
export type Materials = ReturnType<typeof makeMaterials>;

/** Additive, unlit glow for flames, sparks and combustion light; HDR so the bloom catches it. */
export const glowMaterial = (color: THREE.Color, opacity = 1) =>
  new THREE.MeshBasicMaterial({color: color.clone(), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false});

/** Radial soft sprite texture for glows. */
export const softSprite = () => {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.65)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** A dark studio for reflections: black walls, a few long softboxes, one warm floor bounce. */
export const studioScene = () => {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(30, 16, 30), new THREE.MeshBasicMaterial({color: '#050506', side: THREE.BackSide}));
  scene.add(room);
  const panel = (w: number, h: number, color: string, intensity: number, pos: [number, number, number], rot: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide}));
    m.position.set(...pos);
    m.rotation.set(...rot);
    scene.add(m);
  };
  // Long overhead strip softboxes (cool), side strips, a warm low bounce from the exhaust glow.
  panel(14, 1.2, '#dfe8ff', 3.2, [0, 7.5, 0], [Math.PI / 2, 0, 0]);
  panel(1, 9, '#cfd9ff', 2.2, [-9, 2, 2], [0, Math.PI / 2, 0]);
  panel(1, 9, '#cfd9ff', 1.6, [9, 2, -3], [0, -Math.PI / 2, 0]);
  panel(6, 2.2, '#ff8a3a', 1.6, [0, -3, 8], [0, Math.PI, 0]);
  panel(3, 3, '#5fb4ff', 0.7, [0, 3, -12], [0, 0, 0]);
  return scene;
};
