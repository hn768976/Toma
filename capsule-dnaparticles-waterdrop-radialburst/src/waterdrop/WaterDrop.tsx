import React, { useCallback } from 'react';
import { AbsoluteFill } from 'remotion';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DropRow } from '../data';
import { ThreeStage, FullscreenPass, makeTarget, DISPLAY_GLSL, blueNoiseTexture } from '../lib/ThreeStage';
import { BLUE_NOISE, BLUE_NOISE_SIZE } from '../lib/blueNoise';
import { FINISH_GLSL } from '../lib/finish';

export const DROP = {
  fovY: 30,
  camZ: 6,
  // drop radius = 38 % of the frame height (diameter ~76 %, as in the reference)
  radius: 0.36 * 2 * Math.tan((15 * Math.PI) / 180) * 6,
  detail: 40,
};
const LOOP = 600;
const TAU = Math.PI * 2;

// Wobble: a sum of low spherical-harmonic-like modes, each a whole number of
// cycles per 600 frames, total amplitude within +-4 % of the radius.
// [amplitude, cycles, phase, mode]
const MODES: [number, number, number, number][] = [
  [0.012, 7, 0.1, 0], // Y20: oblate/prolate
  [0.016, 9, 0.4, 1], // Y22 (xx - zz)
  [0.009, 8, 0.7, 2], // Y21 (xy)
  [0.008, 11, 0.2, 3], // Y31-ish (y(5yy-3)) / 2
  [0.007, 6, 0.55, 4], // Y2-1 (yz)
  [0.005, 13, 0.85, 5], // Y33-ish (x(xx-3zz))
  [0.01, 15, 0.3, 6], // Y4-ish bumps
  [0.01, 17, 0.65, 7], // Y44-ish (xxxx - 6xxzz + zzzz)
];

const mode = (m: number, x: number, y: number, z: number) => {
  switch (m) {
    case 0: return (3 * y * y - 1) / 2;
    case 1: return x * x - z * z;
    case 2: return 2 * x * y;
    case 3: return (y * (5 * y * y - 3)) / 2;
    case 4: return 2 * y * z;
    case 5: return x * (x * x - 3 * z * z);
    case 6: return (35 * y ** 4 - 30 * y * y + 3) / 8;
    default: return x ** 4 - 6 * x * x * z * z + z ** 4;
  }
};

const BG_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// Background in linear light (so the drop refracts it); the final pass turns
// it back into the display colour exactly.
const BG_FRAG = /* glsl */ `
uniform vec3 uBottom;
uniform vec3 uTop;
varying vec2 vUv;
${DISPLAY_GLSL}
void main() {
  vec3 c = mix(uBottom, uTop, smoothstep(0.15, 0.85, vUv.y));
  // a very soft, broad light pool around the drop
  vec2 q = (vUv - vec2(0.5, 0.52)) * vec2(1.75, 1.0);
  c *= 1.0 + 0.004 * exp(-dot(q, q) * 6.0);
  gl_FragColor = vec4(srgbToLin(c), 1.0);
}
`;

// Bright crescent inside the bottom of the drop (light focused through it).
const CRESCENT_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const CRESCENT_FRAG = /* glsl */ `
uniform float uIntensity;
uniform float uShape;
varying vec2 vUv;
void main() {
  vec2 p = vUv;
  float r = length(p);
  // thin ring band just inside the rim, strongest at the bottom
  float ang = atan(p.y, p.x);
  float blot = 0.65 + 0.35 * sin(ang * 7.0 + 1.3) * sin(ang * 3.0 + uShape);
  float band = exp(-pow((r - 0.85) / 0.13, 2.0)) * blot;
  float lower = smoothstep(0.05, -0.85, p.y + 0.12 * uShape * p.x);
  float core = exp(-pow((r - 0.84) / 0.12, 2.0)) * smoothstep(-0.45, -0.95, p.y) * blot * 0.9;
  // mottling so the glow is broken up rather than a clean crescent
  float mott = 0.55 + 0.45 * sin(p.x * 23.0 + sin(p.y * 17.0) * 2.0 + uShape) * sin(p.x * 9.0 - p.y * 13.0);
  // broad milky cap across the top, brightest top-centre to upper right
  float cap = smoothstep(0.35, 0.9, p.y + 0.15 * p.x) * smoothstep(1.0, 0.75, r) * (0.7 + 0.3 * mott);
  float a = ((band * lower + core) * mott + cap * 0.85) * uIntensity * (1.0 - smoothstep(0.93, 0.99, r));
  gl_FragColor = vec4(vec3(1.0), clamp(a, 0.0, 1.0));
}
`;

const BLOB_FRAG = /* glsl */ `
uniform vec3 uBg;
uniform vec3 uDark;
uniform vec3 uLight;
varying vec2 vUv;
${DISPLAY_GLSL}
float blob(vec2 p, vec2 c, vec2 r, float rot) {
  vec2 d = p - c;
  float cs = cos(rot), sn = sin(rot);
  d = vec2(cs * d.x + sn * d.y, -sn * d.x + cs * d.y) / r;
  return exp(-dot(d, d) * 2.0);
}
void main() {
  vec2 p = vUv; // -1..1 over the disc
  float dk = max(blob(p, vec2(-0.62, 0.1), vec2(0.3, 0.62), 0.2), blob(p, vec2(-0.4, 0.4), vec2(0.2, 0.38), 0.7));
  // streaky shards: break the dark patch into thin bands with white streaks between
  float streak = sin((p.x * 0.8 + p.y * 1.6) * 11.0 + sin(p.y * 7.0 + p.x * 5.0) * 2.0);
  dk *= 0.7 + 0.3 * smoothstep(-0.2, 0.6, streak);
  float wst = blob(p, vec2(-0.55, 0.3), vec2(0.35, 0.55), 0.4) * smoothstep(0.75, 0.98, -streak);
  float lt = max(blob(p, vec2(0.0, -0.72), vec2(0.5, 0.14), -0.05), blob(p, vec2(0.05, 0.74), vec2(0.4, 0.08), 0.05));
  float edge = 1.0 - smoothstep(0.8, 1.0, length(p));
  vec3 c = mix(uBg, uDark, dk * edge);
  c = mix(c, uLight, lt * edge * 0.8);
  c = mix(c, vec3(0.97, 0.99, 1.0), wst * edge * 0.0);
  gl_FragColor = vec4(srgbToLin(c), 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tNoise;
uniform float uFrameMod;
varying vec2 vUv;
${DISPLAY_GLSL}
${FINISH_GLSL}
void main() {
  vec3 lin = texture2D(tScene, vUv).rgb;
  // gentle shoulder only above the background range
  vec3 hi = max(lin - 0.7, 0.0);
  lin = min(lin, 0.7) + hi / (1.0 + hi * 1.6);
  vec3 col = linToSrgb(lin);
  float bn = texture2D(tNoise, gl_FragCoord.xy / 64.0).r;
  col += (bn - 0.5) * (1.2 / 255.0);
  col = finishColor(col, gl_FragCoord.xy, uFrameMod, 0.015);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

// Studio environment for the reflections: a blue surround (like the
// background), a big soft window up-left and a faint strip below.
const ENV_VERT = /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const ENV_FRAG = /* glsl */ `
uniform vec3 uBg;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  // blue surround, brighter toward the top, a pale band at the horizon,
  // a darker blue area to the left
  vec3 c = uBg * (0.75 + 0.55 * smoothstep(-0.2, 1.0, d.y));
  c *= 1.0 - 0.55 * smoothstep(0.5, 0.95, -d.x) * smoothstep(0.7, 0.0, abs(d.y));
  // greyer, darker band to the right -> darker grey-blue rim on the right side
  c = mix(c, vec3(0.08, 0.12, 0.18), 0.85 * smoothstep(0.6, 0.98, d.x) * smoothstep(0.6, 0.0, abs(d.y)));
  gl_FragColor = vec4(c, 1.0);
}
`;

// Studio environment for the reflections: a blue surround (like the
// background), a broad soft window overhead, a small bright key up-left and
// a bright strip below (bottom crescent).
const buildEnvScene = (bg: THREE.Color) => {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.SphereGeometry(20, 64, 32),
    new THREE.ShaderMaterial({ vertexShader: ENV_VERT, fragmentShader: ENV_FRAG, uniforms: { uBg: { value: bg } }, side: THREE.BackSide }),
  );
  s.add(room);
  const panel = (w: number, h: number, intensity: number, pos: THREE.Vector3) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity), side: THREE.DoubleSide }));
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  panel(26, 7, 1.6, new THREE.Vector3(0, 9, -7)); // broad window above and behind -> top rim arc
  panel(6, 0.8, 9, new THREE.Vector3(-9, 4.5, -3)); // key, up-left and grazing -> streaky specular highlight
  panel(26, 8, 5, new THREE.Vector3(0, -9, -4)); // low strip behind -> large bottom reflection
  return s;
};

const createScene = (row: DropRow) => (renderer: THREE.WebGLRenderer, pw: number, ph: number) => {
  const camera = new THREE.PerspectiveCamera(DROP.fovY, pw / ph, 0.1, 100);
  camera.position.set(0, 0, DROP.camZ);
  camera.lookAt(0, 0, 0);

  const bgLinear = new THREE.Color(row.background); // linear
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = buildEnvScene(bgLinear);
  const envRT = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();

  const scene = new THREE.Scene();
  scene.environment = envRT.texture;

  // background plane far behind, filling the view
  const bgDist = 10;
  const bgH = 2 * Math.tan((DROP.fovY / 2) * (Math.PI / 180)) * (DROP.camZ + bgDist) * 1.05;
  const toV3 = (hex: string) => {
    const c = new THREE.Color(hex).convertLinearToSRGB();
    return new THREE.Vector3(c.r, c.g, c.b);
  };
  const bgMat = new THREE.ShaderMaterial({
    vertexShader: BG_VERT,
    fragmentShader: BG_FRAG,
    uniforms: { uBottom: { value: toV3(row.background) }, uTop: { value: toV3(row.backgroundTop) } },
    toneMapped: false,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(bgH * (16 / 9), bgH), bgMat);
  bg.position.z = -bgDist;
  scene.add(bg);

  // the drop
  let geo = new THREE.IcosahedronGeometry(1, DROP.detail);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo) as THREE.IcosahedronGeometry;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const base = Float32Array.from(pos.array as Float32Array);
  const nVerts = pos.count;
  const dropMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 1,
    ior: 1.33,
    thickness: 1,
    roughness: 0,
    metalness: 0,
    attenuationColor: new THREE.Color('#46b2f0'),
    attenuationDistance: 4.5,
    specularIntensity: 1,
    envMapIntensity: 1.0,
  });
  const drop = new THREE.Mesh(geo, dropMat);
  drop.scale.setScalar(DROP.radius);
  scene.add(drop);
  // Shapes hidden behind the drop (always inside its silhouette): they are
  // only ever seen through it, refracted, which gives the interior its
  // uneven darker patch on the left and smeared light streaks.
  // Opaque on purpose (three.js only captures opaque objects for
  // transmission). One disc, just smaller than the drop, painted with soft
  // blobs that fade into the background colour at its rim.
  const behindMat = new THREE.ShaderMaterial({
    vertexShader: CRESCENT_VERT,
    fragmentShader: BLOB_FRAG,
    uniforms: { uBg: { value: toV3(row.background) }, uDark: { value: toV3('#0e66be') }, uLight: { value: toV3('#e8f4fb') } },
    toneMapped: false,
  });
  const behind = new THREE.Mesh(new THREE.CircleGeometry(DROP.radius * 0.95, 64), behindMat);
  behind.position.z = -DROP.radius * 1.15;
  scene.add(behind);

  const crescentMat = new THREE.ShaderMaterial({
    vertexShader: CRESCENT_VERT,
    fragmentShader: CRESCENT_FRAG,
    uniforms: { uIntensity: { value: 0.25 }, uShape: { value: 0 } },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const crescent = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), crescentMat);
  crescent.renderOrder = 10;
  scene.add(crescent);

  const sceneRT = makeTarget(pw, ph, 4);
  const noise = blueNoiseTexture(BLUE_NOISE, BLUE_NOISE_SIZE);
  const final = new FullscreenPass(FINAL_FRAG, {
    tScene: { value: sceneRT.texture },
    tNoise: { value: noise },
    uFrameMod: { value: 0 },
  });

  const render = (frame: number) => {
    const T = (frame % LOOP) / LOOP;
    // wobble the surface
    const arr = pos.array as Float32Array;
    // x1.12: the measured peak deviation over the loop is then ~3.9 % (< 4 %)
    const amps = MODES.map(([a, n, ph]) => 1.12 * a * Math.cos(TAU * (n * T + ph)));
    for (let i = 0; i < nVerts; i++) {
      const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
      let r = 1;
      for (let k = 0; k < MODES.length; k++) r += amps[k] * mode(MODES[k][3], x, y, z);
      arr[i * 3] = x * r;
      arr[i * 3 + 1] = y * r;
      arr[i * 3 + 2] = z * r;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    // gentle bob and a slow turn (whole cycles)
    const bob = 0.035 * Math.sin(TAU * 2 * T);
    drop.position.set(0.012 * Math.sin(TAU * T), bob, 0);
    behind.position.x = drop.position.x;
    behind.position.y = drop.position.y;
    behind.rotation.z = 0.15 * Math.sin(TAU * T);
    drop.rotation.set(0.05 * Math.sin(TAU * T), TAU * T * 0, 0.04 * Math.cos(TAU * T));
    crescent.position.set(drop.position.x, drop.position.y, DROP.radius * 0.2);
    crescent.scale.setScalar(DROP.radius * (1 + amps[0] * 0.5));
    crescentMat.uniforms.uShape.value = amps[1] / 0.012;
    final.material.uniforms.uFrameMod.value = frame % row.durationInFrames;

    renderer.setClearColor(0x000000, 1);
    renderer.setRenderTarget(sceneRT);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.clear(true, true, true);
    final.render(renderer, null);
  };

  return {
    render,
    dispose: () => {
      sceneRT.dispose();
      final.dispose();
      envRT.dispose();
      noise.dispose();
      geo.dispose();
      dropMat.dispose();
      bgMat.dispose();
      crescentMat.dispose();
    },
  };
};

export const WaterDrop: React.FC<{ row: DropRow }> = ({ row }) => {
  const create = useCallback(createScene(row), [row]);
  return (
    <AbsoluteFill style={{ backgroundColor: row.background }}>
      <ThreeStage create={create} />
    </AbsoluteFill>
  );
};
