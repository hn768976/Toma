import * as THREE from "three";
import { createBokeh, type BokehLight } from "../engine/bokeh";
import { NOISE } from "../engine/glsl";
import type { Look, LookFactory } from "../engine/LoopCanvas";
import { TAU, cyc } from "../engine/loop";
import { shaderMat } from "../engine/material";
import { COC_GLSL, PERIODIC_GLSL, periodicUniforms } from "../engine/periodic";
import { Post } from "../engine/post";
import { mulberry32, range } from "../engine/rng";

export interface AIBrainChipParams {
  brain: string;
  city: string;
  /** Pale tint the outer brain lines drift toward. */
  outer: string;
  bg: string;
}

/** Font family registered by <FontGate> before the canvas mounts. */
export const BADGE_FONT = "InterBoldLocal";

// ---------------------------------------------------------------------------
// Circuit city: periodic along z (tile P, repeated K times).
// ---------------------------------------------------------------------------
const P = 16;
const K = 4;
const WRAP = P * K;
const BEHIND = 3;
const HALF_X = 18;
const CAM_Y = 3.6;

interface Block { x: number; z: number; sx: number; sy: number; sz: number; shade: number }
const BLOCKS: Block[] = [];
const CITY_LIGHTS: Omit<BokehLight, "color">[] = [];
{
  const rng = mulberry32(0xb4a1c17);
  const tile: Block[] = [];
  const tileL: Omit<BokehLight, "color">[] = [];
  const CELL = 0.55;
  for (let gz = 0; gz < P / CELL; gz++) {
    for (let gx = -HALF_X; gx < HALF_X; gx += CELL) {
      const cx = gx + CELL / 2;
      const ax = Math.abs(cx);
      if (rng() < 0.18) continue; // streets / gaps
      // Low "component" blocks in the middle avenue, towers rising toward the sides.
      const avenue = ax < 1.3;
      const tall = avenue ? 0 : Math.min(1, 0.2 + (ax - 1.3) / 8);
      const hmax = avenue ? 0.35 : 0.5 + tall * 3.2;
      const sy = range(rng, 0.12, 1) * hmax * (rng() < 0.15 ? 1.6 : 1);
      const sx = range(rng, 0.45, 0.92) * CELL;
      const sz = range(rng, 0.45, 0.92) * CELL;
      const b = { x: cx + (rng() - 0.5) * (CELL - sx) * 0.5, z: gz * CELL + CELL / 2, sx, sy, sz, shade: rng() };
      tile.push(b);
      // LED rows on the faces that look toward the camera (+z) and the avenue.
      const faces = 2 + Math.floor(rng() * (avenue ? 2 : 6));
      for (let f = 0; f < faces; f++) {
        const n = 2 + Math.floor(rng() * 4);
        const sp = range(rng, 0.06, 0.1);
        const y = avenue ? b.sy + 0.01 : range(rng, 0.1, 0.95) * b.sy;
        const e = range(rng, 0.5, 1.5);
        const onSide = !avenue && rng() < 0.5;
        const tw = rng() < 0.3 ? 1 + Math.floor(rng() * 3) : 0;
        const rows = rng() < 0.5 ? 2 : 1;
        for (let k = 0; k < n * rows; k++) {
          const i = k % n;
          const yy = y - Math.floor(k / n) * sp * 1.1;
          const t = (i - (n - 1) / 2) * sp;
          const sideX = b.x - Math.sign(b.x) * (b.sx / 2 + 0.01);
          tileL.push({
            x: onSide ? sideX : b.x + t,
            y: yy,
            z: onSide ? b.z + t : b.z + b.sz / 2 + 0.01,
            energy: e,
            twinkleK: tw,
            twinklePhase: rng(),
            size: 1,
          });
        }
      }
    }
  }
  for (let k = 0; k < K; k++) {
    for (const b of tile) BLOCKS.push({ ...b, z: b.z + k * P });
    for (const l of tileL) CITY_LIGHTS.push({ ...l, z: ((l.z % P) + P) % P + k * P });
  }
}

const CITY_VERT = /* glsl */ `
${PERIODIC_GLSL}
in vec4 aBox;   // x, zLocal, sx, sz
in vec2 aMisc;  // sy, shade
out vec3 vN;
out vec3 vW;
out vec3 vVP;
out float vShade;
out float vY;
void main() {
  vec3 s = vec3(aBox.z, aMisc.x, aBox.w);
  vec3 w = vec3(aBox.x, 0.0, wrapZ(aBox.y)) + position * s;
  vW = w;
  vN = normalize(normal / s);
  vShade = aMisc.y;
  vY = position.y;
  vec4 vp = viewMatrix * vec4(w, 1.0);
  vVP = vp.xyz;
  gl_Position = projectionMatrix * vp;
}
`;

const CITY_FRAG = /* glsl */ `
precision highp float;
${COC_GLSL}
in vec3 vN;
in vec3 vW;
in vec3 vVP;
in float vShade;
in float vY;
uniform vec3 uCity;
uniform vec3 uBrain;
uniform vec3 uBrainPos;
uniform vec3 uBg;
uniform vec3 uCam;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vW);
  float dist = length(vW - uCam);
  // Dark blocks lit by the surrounding blue glow, plus warm light from the brain.
  vec3 col = vec3(0.001, 0.002, 0.008) * (0.6 + 0.8 * vShade);
  col += uCity * 0.012 * (0.3 + 0.7 * max(N.y, 0.0)) * (0.5 + vShade);
  col += uCity * 0.12 * pow(clamp(1.0 - abs(dot(N, V)), 0.0, 1.0), 3.0);
  col += uCity * 0.02 * smoothstep(0.85, 1.0, vY);
  vec3 L = uBrainPos - vW;
  float dl = length(L);
  col += uBrain * 0.05 * max(dot(N, L / dl), 0.0) / (1.0 + dl * dl * 0.5);
  // Warm pool on the tops right under the brain.
  vec2 dxz = vW.xz - uBrainPos.xz;
  col += uBrain * 0.18 * max(N.y, 0.0) * exp(-dot(dxz, dxz) * 1.2);
  // Atmospheric depth.
  float fog = 0.3 + 0.6 * smoothstep(4.0, 36.0, dist);
  col = mix(col, uBg, fog);
  gl_FragColor = vec4(col, cocOf(-vVP.z));
}
`;

const BG_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform vec3 uBg;
uniform vec3 uCity;
uniform float uCocFar;
void main() {
  vec3 col = uBg * (0.8 + 0.4 * vUv.y);
  gl_FragColor = vec4(col, uCocFar);
}
`;

// ---------------------------------------------------------------------------
// Brain: a stylised two-hemisphere shape with folds as glowing iso-lines.
// ---------------------------------------------------------------------------
const brainShape = (v: THREE.Vector3) => {
  // v is a unit-sphere direction; returns the deformed surface point.
  const x = v.x;
  const y = v.y;
  const z = v.z;
  let rx = 1.18;
  let ry = 0.95;
  let rz = 0.78;
  // Frontal lobe a touch lower and rounder, occipital slightly pointed.
  if (x < 0) rx *= 1.0 + 0.06 * Math.max(0, -y);
  ry *= 1 - 0.1 * Math.max(0, x) * Math.max(0, -y);
  // Frontal lobe bulging up and forward.
  ry *= 1 + 0.1 * Math.max(0, x) * Math.max(0, y);
  const p = new THREE.Vector3(x * rx, y * ry, z * rz);
  // Flatten the underside.
  if (p.y < -0.35) p.y = -0.35 + (p.y + 0.35) * 0.55;
  // Temporal lobe bulge.
  const tb = Math.exp(-(((p.x - 0.2) / 0.5) ** 2 + ((p.y + 0.38) / 0.22) ** 2));
  p.y -= 0.2 * tb;
  p.z *= 1 + 0.08 * tb;
  // Longitudinal fissure between the hemispheres (top, along x).
  const fis = Math.exp(-(z * z) / 0.004) * Math.max(0, y);
  p.y -= 0.09 * fis;
  // Lateral (Sylvian) fissure: a groove running back and up from the front-bottom.
  const sy = p.y - (-0.12 - 0.22 * (p.x - 0.35));
  const syl = Math.exp(-(sy * sy) / 0.0016) * (p.x > -0.35 && p.x < 0.75 ? 1 : 0) * Math.min(1, Math.abs(z) * 2);
  p.multiplyScalar(1 - 0.035 * syl);
  return p;
};

const buildBrainGeometry = () => {
  const g = new THREE.SphereGeometry(1, 200, 140);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const p = brainShape(v);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeVertexNormals();
  const part = new Float32Array(pos.count).fill(0);
  g.setAttribute("aPart", new THREE.BufferAttribute(part, 1));
  return g;
};

const buildCerebellum = () => {
  const g = new THREE.SphereGeometry(1, 96, 64);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    pos.setXYZ(i, -0.58 + v.x * 0.36, -0.42 + v.y * 0.22, v.z * 0.46);
  }
  g.computeVertexNormals();
  g.setAttribute("aPart", new THREE.BufferAttribute(new Float32Array(pos.count).fill(1), 1));
  return g;
};


const FOLD_GLSL = /* glsl */ `
float foldField(vec3 p) {
  vec3 q = p * 2.6 + vec3(3.1, 7.7, 1.3);
  vec3 warp = vec3(vnoise(q * 0.8 + 11.0), vnoise(q * 0.8 + 23.0), vnoise(q * 0.8 + 37.0)) - 0.5;
  return fbm3(q + warp * 1.6) * 9.0;
}
`;

const BRAIN_VERT = /* glsl */ `
${NOISE}
${FOLD_GLSL}
in float aPart;
out vec3 vO;     // object-space position (folds live here, so they turn with the brain)
out vec3 vN;
out vec3 vW;
out float vPart;
void main() {
  vO = position;
  vPart = aPart;
  // Sulci sink along the fold lines, so the silhouette and surface read as gyri.
  vec3 pos = position;
  if (aPart < 0.5) pos -= normal * 0.03 * (0.5 + 0.5 * cos(6.2831853 * foldField(position)));
  vec4 w = modelMatrix * vec4(pos, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const BRAIN_FRAG = /* glsl */ `
precision highp float;
${NOISE}
${FOLD_GLSL}
in vec3 vO;
in vec3 vN;
in vec3 vW;
in float vPart;
uniform vec3 uBrain;
uniform vec3 uOuter;
uniform vec3 uCam;
uniform float uF;
uniform float uBack;   // 1 for back faces pass (dimmer)
uniform vec3 uChipO;   // chip position in object space
float cyc(float k) { return mod(k * uF, 600.0) / 600.0; }
float lineAA(float v, float width) {
  // Distance to the nearest integer in v, anti-aliased by its screen derivative.
  float d = abs(fract(v + 0.5) - 0.5);
  float w = fwidth(v) + 1e-4;
  return 1.0 - smoothstep(width * w, (width + 1.2) * w, d);
}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vW);
  float ndv = abs(dot(N, V));
  vec3 p = vO;
  float r = length(p - uChipO);
  // Warm around the chip and the lower front; cool blue-white over the back.
  float warm = exp(-r * r * 0.9);
  warm = max(warm, 0.7 * smoothstep(0.1, 0.9, p.x) * smoothstep(0.2, -0.4, p.y));
  float fold;
  float line;
  if (vPart < 0.5) {
    // Gyri: iso-lines of a domain-warped noise field on the surface.
    fold = foldField(p);
    line = lineAA(fold, 1.2 + 1.0 * warm);
  } else if (vPart < 1.5) {
    // Cerebellum folia: near-horizontal bands.
    fold = foldField(p * 1.7 + 4.0);
    line = lineAA(fold, 0.6) * 0.6;
  } else {
    fold = p.y * 10.0;
    line = lineAA(fold, 0.4) * 0.5;
  }
  // Warm core around the chip, paler toward the edges of the brain.
  vec3 base = mix(uOuter, uBrain, clamp(warm * 1.6 - 0.1, 0.0, 1.0));
  // Energy pulses: bands sweeping outward from the chip along the folds.
  float wave = fract(r * 1.3 - cyc(3.0) + 0.15 * vnoise(p * 3.0));
  float pulse = pow(smoothstep(0.75, 1.0, wave), 3.0) * (0.6 + 0.4 * warm);
  float wave2 = fract(vnoise(p * 1.7 + 5.0) * 2.0 - cyc(2.0));
  pulse += pow(smoothstep(0.85, 1.0, wave2), 4.0) * 0.6;
  float rim = pow(clamp(1.0 - ndv, 0.0, 1.0), 4.0);
  // Lines crowd together at grazing angles; thin them out so the edge stays a crisp outline.
  line *= smoothstep(0.04, 0.4, ndv);
  // Sparks: a few hashed points on the warm lines that flicker in whole cycles.
  vec3 sc = floor(p * 24.0);
  float sh = hash31(sc + 17.0);
  float spark = step(0.975, sh) * warm * (0.5 + 0.5 * cos(6.2831853 * (cyc(1.0 + floor(hash31(sc + 3.0) * 3.0)) + sh * 37.0)));
  vec3 col = base * line * (0.55 + 1.5 * warm + 2.0 * pulse);
  col += mix(base, vec3(1.0, 0.95, 0.85), 0.5) * line * pulse * warm * 1.5;
  col += mix(uOuter, uBrain, warm) * rim * 0.35;       // thin glassy outline
  col += uBrain * spark * 3.0;
  col *= mix(1.0, 0.3, uBack);
  gl_FragColor = vec4(col, 1.0);
}
`;

const BADGE_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const BADGE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform sampler2D tText;
uniform vec3 uBrain;
uniform float uBreath;
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  // Badge spans uv 0.1..0.9 of the quad; the margin holds pins and glow.
  vec2 p = (vUv - 0.5) * 2.0;    // -1..1
  float aa = fwidth(p.x) * 1.0;
  float d = sdRoundBox(p, vec2(0.62), 0.12);
  float inside = 1.0 - smoothstep(-aa, aa, d);
  float outline = 1.0 - smoothstep(0.03, 0.03 + aa * 1.5, abs(d + 0.035));
  float inner = 1.0 - smoothstep(0.006, 0.006 + aa * 1.5, abs(d + 0.085));
  // Pins: 5 per side, just outside the package outline.
  vec2 ap = abs(p);
  float slotY = abs(fract(p.y / 0.2 + 0.5) - 0.5) * 0.2;
  float slotX = abs(fract(p.x / 0.2 + 0.5) - 0.5) * 0.2;
  float pinsX = smoothstep(0.64, 0.64 + aa, ap.x) * (1.0 - smoothstep(0.97, 0.99, ap.x)) * (1.0 - 0.7 * smoothstep(0.8, 0.97, ap.x)) * step(ap.y, 0.5) * (1.0 - smoothstep(0.032, 0.032 + aa, slotY));
  float pinsY = smoothstep(0.64, 0.64 + aa, ap.y) * (1.0 - smoothstep(0.97, 0.99, ap.y)) * (1.0 - 0.7 * smoothstep(0.8, 0.97, ap.y)) * step(ap.x, 0.5) * (1.0 - smoothstep(0.032, 0.032 + aa, slotX));
  float pins = max(pinsX, pinsY);
  float glow = exp(-max(d, 0.0) * 9.0) * (1.0 - inside) * 0.5;
  vec4 t = texture(tText, vUv);
  vec3 fill = uBrain * 0.035 + vec3(0.03, 0.012, 0.003);
  vec3 col = fill * inside;
  col += uBrain * (outline * 2.6 + inner * 0.8 + pins * 1.6) * uBreath;
  col += mix(uBrain, vec3(1.0, 0.96, 0.88), 0.45) * t.a * 2.2 * uBreath;
  col += uBrain * glow * uBreath;
  float alpha = clamp(inside * 0.96 + outline + pins, 0.0, 1.0);
  // Premultiplied: dark glass occludes the brain lines behind it, glow adds.
  gl_FragColor = vec4(col, alpha);
}
`;

export const createAIBrainChip: LookFactory<AIBrainChipParams> = (gl, params): Look => {
  const BRAIN_DIST = 6.2;
  const COC_K = 0.009;
  const post = new Post(gl, {
    msaa: 0,
    depthTexture: true,
    dof: { maxRadius: 0.045 },
    bloomStrength: 0.6,
    bloomRadius: 0.4,
    bloomThreshold: 0.75,
    bloomKnee: 0.6,
    exposure: 1.0,
    vignette: 0.5,
    grain: 0.015,
    grainDarkCut: 0,
  });
  const pu = periodicUniforms(WRAP, BEHIND, BRAIN_DIST, COC_K, 0.045);
  const brainC = new THREE.Color(params.brain);
  const cityC = new THREE.Color(params.city);
  const outerC = new THREE.Color(params.outer);
  const bgC = new THREE.Color(params.bg);

  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 90);
  camera.position.set(0, CAM_Y, 0);
  camera.rotation.set((-10 * Math.PI) / 180, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();

  // Brain held in front of the camera (it travels with it).
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const brainPos = camera.position.clone().addScaledVector(fwd, BRAIN_DIST).addScaledVector(up, 0.12);

  // --- City scene ---
  const scene = new THREE.Scene();
  const bgMat = shaderMat({
    vertexShader: /* glsl */ `out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.99999, 1.0); }`,
    fragmentShader: BG_FRAG,
    uniforms: { uBg: { value: bgC }, uCity: { value: cityC }, uCocFar: { value: COC_K } },
    depthTest: false,
    depthWrite: false,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  const cityMat = shaderMat({
    vertexShader: CITY_VERT,
    fragmentShader: CITY_FRAG,
    uniforms: {
      ...pu,
      uCity: { value: cityC },
      uBrain: { value: brainC },
      uBrainPos: { value: brainPos },
      uBg: { value: bgC },
      uCam: { value: camera.position.clone() },
    },
  });
  const boxBase = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const cityGeo = new THREE.InstancedBufferGeometry();
  cityGeo.index = boxBase.index;
  cityGeo.setAttribute("position", boxBase.getAttribute("position"));
  cityGeo.setAttribute("normal", boxBase.getAttribute("normal"));
  const box = new Float32Array(BLOCKS.length * 4);
  const misc = new Float32Array(BLOCKS.length * 2);
  BLOCKS.forEach((b, i) => {
    box.set([b.x, b.z, b.sx, b.sz], i * 4);
    misc.set([b.sy, b.shade], i * 2);
  });
  cityGeo.setAttribute("aBox", new THREE.InstancedBufferAttribute(box, 4));
  cityGeo.setAttribute("aMisc", new THREE.InstancedBufferAttribute(misc, 2));
  cityGeo.instanceCount = BLOCKS.length;
  const city = new THREE.Mesh(cityGeo, cityMat);
  city.frustumCulled = false;
  scene.add(city);
  // Ground plane (board).
  const groundMat = shaderMat({
    vertexShader: /* glsl */ `out vec3 vW; out vec3 vVP; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 vp = viewMatrix * w; vVP = vp.xyz; gl_Position = projectionMatrix * vp; }`,
    fragmentShader: /* glsl */ `precision highp float; ${COC_GLSL} in vec3 vW; in vec3 vVP; uniform vec3 uBg; uniform vec3 uCity; uniform vec3 uCam;
      void main(){ float d = length(vW - uCam); vec3 c = vec3(0.002,0.003,0.007) + uCity * 0.01; c = mix(c, uBg, smoothstep(10.0, 44.0, d)); gl_FragColor = vec4(c, cocOf(-vVP.z)); }`,
    uniforms: { ...pu, uBg: { value: bgC }, uCity: { value: cityC }, uCam: { value: camera.position.clone() } },
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(HALF_X * 2 + 20, WRAP + 10).rotateX(-Math.PI / 2).translate(0, 0, BEHIND - (WRAP + 10) / 2 + 3), groundMat);
  ground.frustumCulled = false;
  scene.add(ground);

  const lights = CITY_LIGHTS.map((l) => ({ ...l, color: cityC.clone() }));
  const bokeh = createBokeh(lights, pu);
  bokeh.mat.uniforms.uGain.value = 3.2;
  bokeh.mat.uniforms.uSharpR.value = 0.0045;
  bokeh.mat.uniforms.uFalloff.value = 1.0;
  bokeh.mat.uniforms.uFade.value.set(28, 46);

  // --- Brain overlay (drawn sharp, after DoF) ---
  const overlay = new THREE.Scene();
  const brainGroup = new THREE.Group();
  brainGroup.position.copy(brainPos);
  overlay.add(brainGroup);
  const tilt = new THREE.Group(); // keep the brain upright relative to the camera's pitch
  tilt.rotation.x = camera.rotation.x;
  brainGroup.add(tilt);
  const spin = new THREE.Group();
  tilt.add(spin);
  const chipO = new THREE.Vector3(0.45, 0.02, 0.35);
  const mkBrainMat = (side: THREE.Side, back: number) =>
    shaderMat({
      vertexShader: BRAIN_VERT,
      fragmentShader: BRAIN_FRAG,
      uniforms: {
        uBrain: { value: brainC },
        uOuter: { value: outerC },
        uCam: { value: camera.position.clone() },
        uF: { value: 0 },
        uBack: { value: back },
        uChipO: { value: chipO },
      },
      side,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
  const backMat = mkBrainMat(THREE.BackSide, 1);
  const frontMat = mkBrainMat(THREE.FrontSide, 0);
  const brainGeos = [buildBrainGeometry(), buildCerebellum()];
  // Dark glass: dims the city lights seen through the brain before the lines go on.
  const shadeMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false });
  for (const g of brainGeos) {
    const sh = new THREE.Mesh(g, shadeMat);
    sh.renderOrder = 0;
    spin.add(sh);
    const b = new THREE.Mesh(g, backMat);
    b.renderOrder = 1;
    const f = new THREE.Mesh(g, frontMat);
    f.renderOrder = 2;
    spin.add(b, f);
  }

  // Badge: always faces the camera, at the brain's centre.
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 1024, 1024);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 440px "${BADGE_FONT}"`;
  ctx.fillText("AI", 512, 540);
  const textTex = new THREE.CanvasTexture(canvas);
  textTex.colorSpace = THREE.NoColorSpace;
  textTex.generateMipmaps = true;
  textTex.minFilter = THREE.LinearMipmapLinearFilter;
  textTex.anisotropy = 4;
  const breath = { value: 1 };
  const badgeMat = shaderMat({
    vertexShader: BADGE_VERT,
    fragmentShader: BADGE_FRAG,
    uniforms: { tText: { value: textTex }, uBrain: { value: brainC }, uBreath: breath },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.82), badgeMat);
  badge.renderOrder = 3;
  // Placed toward the camera from the brain centre, facing the camera.
  badge.position.copy(brainPos).addScaledVector(fwd, -0.85).addScaledVector(new THREE.Vector3(1, 0, 0), 0.48);
  badge.quaternion.copy(camera.quaternion);
  overlay.add(badge);

  const black = new THREE.Color(0, 0, 0);
  return {
    render(frame) {
      const [w, h] = post.ensureSize();
      pu.uShift.value = P * cyc(frame, 1);
      // Slow turn, +-15 deg (cosine), plus the base side-on pose.
      spin.rotation.y = ((15 * Math.PI) / 180) * Math.cos(cyc(frame, 1) * TAU);
      brainGroup.updateMatrixWorld(true);
      for (const m of [backMat, frontMat]) m.uniforms.uF.value = frame;
      breath.value = 0.82 + 0.18 * Math.cos(cyc(frame, 3) * TAU);

      post.beginScene(black, COC_K);
      gl.render(scene, camera);
      post.runDof();
      bokeh.update(camera, post.scene.depthTexture!, w, h, frame);
      gl.setRenderTarget(post.dofOut);
      gl.render(bokeh.scene, camera);
      gl.render(overlay, camera);
      post.finish(frame);
    },
    dispose() {
      post.dispose();
      bokeh.dispose();
      textTex.dispose();
      for (const m of [bgMat, cityMat, groundMat, backMat, frontMat, badgeMat, shadeMat]) m.dispose();
      for (const g of [...brainGeos, cityGeo, boxBase, bg.geometry, ground.geometry, badge.geometry]) g.dispose();
    },
  };
};
