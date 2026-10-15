// Imperative three.js scene for the Satellite Network look. Everything that
// moves is a closed-form function of the loop phase (frame / 600).
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { gauss, mulberry32, range, TAU } from "../../lib/rand";

export type SatParams = {
  shot: "wide" | "close";
  tint: string; // city-light tint
  rim: string; // atmosphere colour
  link: string; // link line colour
  satellites: number;
};

const col = (h: string) => new THREE.Color(h);

// ------------------------------------------------------------------ geometry
type Part = { geometry: THREE.BufferGeometry; material: THREE.Material };
/** Bake the GLTF scene into (geometry, material) parts in model space. */
const partsOf = (gltf: GLTF): Part[] => {
  const parts: Part[] = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    parts.push({ geometry: g, material: mats[0] });
  });
  return parts;
};
/** Normalise: centre the model and scale so the wing span is 1 unit. */
const normalise = (parts: Part[]) => {
  const box = new THREE.Box3();
  for (const p of parts) {
    p.geometry.computeBoundingBox();
    box.union(p.geometry.boundingBox!);
  }
  const c = box.getCenter(new THREE.Vector3());
  const span = box.max.x - box.min.x;
  for (const p of parts) {
    p.geometry.translate(-c.x, -c.y, -c.z);
    p.geometry.scale(1 / span, 1 / span, 1 / span);
  }
};
const tuneMaterials = (parts: Part[]) => {
  for (const p of parts) {
    const m = p.material as THREE.MeshStandardMaterial;
    if (!m.isMeshStandardMaterial) continue;
    m.metalness = m.name === "solar" ? 0.35 : 0.75;
    m.roughness = m.name === "solar" ? 0.28 : 0.38;
    m.envMapIntensity = 0.9;
    // grade the foil and panels toward the blue/white palette of the look
    m.color = new THREE.Color(m.name === "solar" ? 0xf0f6ff : 0x7d93c4);
    m.side = THREE.DoubleSide;
  }
};

// ------------------------------------------------------------------ orbits
type Sat = { r: number; e1: THREE.Vector3; e2: THREE.Vector3; a0: number; turns: number; tilt: number; scale: number };
/**
 * Orbit planes are defined in the wide camera's frame: each orbit's long axis
 * runs across the screen (left of the Earth, which sits off to the right), and
 * the plane is opened 50-70 degrees in depth. About half of every orbit is in
 * the visible left half of the frame at any time, as in the reference.
 */
export const WIDE_EYE = new THREE.Vector3(-0.95, 0.58, 1.6);
export const WIDE_TARGET = new THREE.Vector3(-0.78, 0.06, 0);
const buildSats = (n: number, seed: number): Sat[] => {
  const r = mulberry32(seed);
  // Great-circle shells (plane normal given by polar th / azimuth ph), found
  // by an offline search (scripts/orbit-search.mjs) to keep as many
  // satellites as possible in the wide crop, some crossing the globe.
  const shells = [
    { r: 1.41, th: 2.8, ph: 1.814 },
    { r: 1.35, th: 2.549, ph: 1.057 },
    { r: 1.43, th: 2.711, ph: 1.184 },
    { r: 1.31, th: 2.937, ph: 2.326 },
    { r: 1.06, th: 0.595, ph: 0.342 },
  ];
  const sats: Sat[] = [];
  for (let i = 0; i < n; i++) {
    const sh = shells[i % shells.length];
    const k = Math.floor(i / shells.length);
    const per = Math.ceil(n / shells.length);
    const th = sh.th + gauss(r) * 0.03, ph = sh.ph + gauss(r) * 0.03;
    const nrm = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
    const t = Math.abs(nrm.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const e1 = new THREE.Vector3().crossVectors(nrm, t).normalize();
    const e2 = new THREE.Vector3().crossVectors(nrm, e1).normalize();
    sats.push({
      r: sh.r + gauss(r) * 0.02,
      e1,
      e2,
      a0: (k / per) * TAU + r() * 0.15,
      turns: sh.r < 1.6 ? 2 : 1, // whole orbits per 600 frames
      tilt: range(r, -0.25, 0.25),
      scale: range(r, 0.85, 1.15),
    });
  }
  return sats;
};
const orbitPos = (s: Sat, phase: number, out: THREE.Vector3) => {
  const a = s.a0 + TAU * s.turns * phase;
  return out.copy(s.e1).multiplyScalar(Math.cos(a) * s.r).addScaledVector(s.e2, Math.sin(a) * s.r);
};

// ------------------------------------------------------------------ shaders
const EARTH_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const EARTH_FRAG = /* glsl */ `
uniform sampler2D uNight;
uniform vec3 uSun;
uniform vec3 uTint;
uniform vec3 uRim;
varying vec3 vN;
varying vec3 vP;
varying vec2 vUv;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vP);
  float ndv = max(dot(N, V), 0.0);
  float fres = pow(1.0 - ndv, 3.0);
  vec3 tex = texture2D(uNight, vUv).rgb;
  float lum = dot(tex, vec3(0.299, 0.587, 0.114));
  // Black Marble: moonlit land is bluish-grey, city lights are warm.
  float land = smoothstep(0.006, 0.03, lum);
  float warm = max(tex.r - tex.b * 0.9, 0.0);
  float city = smoothstep(0.004, 0.12, warm);
  // stylised dotted continents (as in the reference)
  vec2 g = fract(vUv * vec2(1500.0, 750.0)) - 0.5;
  float dots = smoothstep(0.34, 0.1, length(g));
  vec3 c = vec3(0.001, 0.004, 0.012);
  c += uRim * land * (0.04 + 0.9 * dots);
  // lit blue face, glowing toward the sun-side limb
  c += uRim * 0.06 * smoothstep(0.1, 1.0, dot(N, uSun));
  c += uTint * city * (2.5 + 6.0 * dots);
  // atmosphere seen through the limb, brighter toward the sun side
  float sunSide = 0.35 + 0.65 * smoothstep(-0.4, 0.8, dot(N, uSun));
  c += uRim * pow(1.0 - ndv, 3.0) * 1.0 * sunSide;
  c += uRim * pow(1.0 - ndv, 10.0) * 2.5 * sunSide;
  gl_FragColor = vec4(c, 1.0);
}`;
const ATMO_FRAG = /* glsl */ `
uniform vec3 uRim;
uniform vec3 uSun;
varying vec3 vN;
varying vec3 vP;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vP);
  float d = dot(N, V); // negative on the back faces we draw
  // brightest at the planet's limb, fading out to the edge of the shell
  float glow = pow(clamp(-d / 0.33, 0.0, 1.0), 2.5);
  float sunSide = 0.4 + 0.6 * smoothstep(-0.5, 0.8, dot(N, uSun));
  gl_FragColor = vec4(uRim * glow * 1.4 * sunSide, 1.0);
}`;

const BG_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`;
const BG_FRAG = /* glsl */ `
uniform vec3 uDeep;
uniform vec3 uGlow;
uniform vec2 uGlowPos;
uniform float uGlowAmt;
varying vec2 vUv;
void main() {
  vec2 p = vUv; p.x *= 1.7778;
  vec2 g = uGlowPos; g.x *= 1.7778;
  float d = length(p - g);
  vec3 c = uDeep * (0.55 + 0.5 * vUv.y);
  vec2 vq = vUv - 0.5; vq.x *= 1.4;
  c *= 1.0 - 0.75 * smoothstep(0.25, 0.85, length(vq));
  c += uGlow * (exp(-d * d / 0.08) * 0.6 + exp(-d / 0.5) * 0.25) * uGlowAmt;
  gl_FragColor = vec4(c, 1.0);
}`;

const ICON_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const ICON_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uPulse;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, abs(p.x));          // mirrored: arcs on both sides
  float wedge = smoothstep(0.85, 0.65, abs(a));
  float rings = 0.0;
  for (int i = 0; i < 3; i++) {
    float rr = 0.32 + float(i) * 0.24 + uPulse * 0.08;
    rings += smoothstep(0.045, 0.0, abs(r - rr)) * (1.0 - float(i) * 0.22);
  }
  float core = smoothstep(0.14, 0.0, r);
  float m = (rings * wedge + core) * smoothstep(1.0, 0.85, r);
  gl_FragColor = vec4(uColor * m * uAlpha, 1.0);
}`;

const POINTS_VERT = /* glsl */ `
attribute float aSize;
attribute float aBright;
uniform float uPx;
varying float vB;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.5, aSize * uPx);
  vB = aBright * min(1.0, (aSize * uPx) / 1.5);
}`;
const POINTS_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vB;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float m = exp(-dot(p, p) * 4.0);
  gl_FragColor = vec4(uColor * m * vB, 1.0);
}`;

const FINAL = {
  uniforms: {
    tDiffuse: { value: null },
    uFrame: { value: 0 },
    uGrain: { value: 0.015 },
    uExposure: { value: 1.0 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D tDiffuse;
uniform float uFrame;
uniform float uGrain;
uniform float uExposure;
varying vec2 vUv;
uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float h3(ivec3 p) { return float(pcg(uint(p.x) + pcg(uint(p.y) + pcg(uint(p.z))))) / 4294967295.0; }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb * uExposure;
  c = aces(c);
  c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  ivec2 px = ivec2(gl_FragCoord.xy);
  int f = int(mod(uFrame, 600.0));
  float g = h3(ivec3(px, f)) + h3(ivec3(px + 4099, f + 811)) - 1.0;
  c += g * uGrain * smoothstep(0.012, 0.03, lum);
  c += (h3(ivec3(px, f + 1201)) - h3(ivec3(px + 7919, f + 3301))) / 255.0;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`,
};

// ------------------------------------------------------------------ build
export type Built = {
  render: (frame: number) => void;
  dispose: () => void;
};

export const buildSatelliteScene = (opts: {
  gl: THREE.WebGLRenderer;
  width: number; // design px
  height: number;
  dpr: number;
  params: SatParams;
  hero: GLTF;
  lod: GLTF;
  night: THREE.Texture;
}): Built => {
  const { gl, width, height, dpr, params } = opts;
  const close = params.shot === "close";
  gl.setPixelRatio(dpr);
  gl.setSize(width, height, false);
  gl.toneMapping = THREE.NoToneMapping;
  gl.outputColorSpace = THREE.LinearSRGBColorSpace;
  gl.autoClear = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(close ? 38 : 40, width / height, 0.01, 200);
  const pmrem = new THREE.PMREMGenerator(gl);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;

  const SUN = new THREE.Vector3(-0.85, -0.2, 0.55).normalize();

  // background gradient (float precision, drawn behind everything)
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: BG_VERT,
      fragmentShader: BG_FRAG,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uDeep: { value: new THREE.Color(0.0025, 0.012, 0.05) },
        uGlow: { value: col(params.rim) },
        uGlowPos: { value: new THREE.Vector2(close ? 0.1 : -0.03, close ? 0.75 : 0.7) },
        uGlowAmt: { value: close ? 0.12 : 0.45 },
      },
    }),
  );
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  // Earth
  const night = opts.night;
  night.colorSpace = THREE.SRGBColorSpace;
  night.anisotropy = 8;
  const earthMat = new THREE.ShaderMaterial({
    vertexShader: EARTH_VERT,
    fragmentShader: EARTH_FRAG,
    uniforms: {
      uNight: { value: night },
      uSun: { value: SUN },
      uTint: { value: col(params.tint) },
      uRim: { value: col(params.rim) },
    },
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 120), earthMat);
  const earthPivot = new THREE.Group();
  earthPivot.rotation.z = 0.41; // axial tilt
  earthPivot.add(earth);
  scene.add(earthPivot);
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 120, 90),
    new THREE.ShaderMaterial({
      vertexShader: EARTH_VERT,
      fragmentShader: ATMO_FRAG,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: { uRim: { value: col(params.rim) }, uSun: { value: SUN } },
    }),
  );
  scene.add(atmo);

  // lights
  const sun = new THREE.DirectionalLight(0xfff4e8, close ? 1.3 : 2.0);
  sun.position.copy(SUN).multiplyScalar(10);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x6a9cff, 0x0a1a40, 0.35));

  // satellites (instanced low-poly), and a full-detail hero for the close shot
  const sats = buildSats(params.satellites, 5151);
  const lodParts = partsOf(opts.lod);
  normalise(lodParts);
  tuneMaterials(lodParts);
  const SAT_SIZE = close ? 0.045 : 0.19; // wing span in Earth radii
  const inst = lodParts.map((p) => {
    const im = new THREE.InstancedMesh(p.geometry, p.material, sats.length);
    im.frustumCulled = false;
    scene.add(im);
    return im;
  });
  const heroParts = partsOf(opts.hero);
  normalise(heroParts);
  tuneMaterials(heroParts);
  const hero = new THREE.Group();
  for (const p of heroParts) hero.add(new THREE.Mesh(p.geometry, p.material));
  hero.visible = close;
  scene.add(hero);
  const heroSat: Sat = {
    r: 1.13,
    e1: new THREE.Vector3(1, 0.2, 0).normalize(),
    e2: new THREE.Vector3(0, 0.25, 1).normalize(),
    a0: 0.6,
    turns: 1,
    tilt: 0.1,
    scale: 1,
  };
  heroSat.e2.sub(heroSat.e1.clone().multiplyScalar(heroSat.e2.dot(heroSat.e1))).normalize();

  // stars and floating bokeh dots
  const mkPoints = (n: number, seed: number, rMin: number, rMax: number, size: [number, number], color: string, bright: [number, number]) => {
    const r = mulberry32(seed);
    const pos = new Float32Array(n * 3), sz = new Float32Array(n), br = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, a = r() * TAU, rr = range(r, rMin, rMax);
      const s = Math.sqrt(1 - u * u);
      pos.set([Math.cos(a) * s * rr, u * rr, Math.sin(a) * s * rr], i * 3);
      sz[i] = range(r, size[0], size[1]);
      br[i] = Math.pow(r(), 3) * (bright[1] - bright[0]) + bright[0];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(sz, 1));
    g.setAttribute("aBright", new THREE.BufferAttribute(br, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: POINTS_VERT,
      fragmentShader: POINTS_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uPx: { value: dpr }, uColor: { value: col(color) } },
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    scene.add(pts);
    return pts;
  };
  const pointClouds = [
    mkPoints(2200, 77, 60, 90, [2, 5], "#cfe0ff", [0.05, 0.9]),
    mkPoints(520, 78, 2.0, 5, [12, 28], "#4d9bff", [0.15, 0.7]),
  ];

  // links
  const MAXSEG = sats.length * 5 + 8;
  const linkPos = new Float32Array(MAXSEG * 6);
  const linkCol = new Float32Array(MAXSEG * 6);
  const linkGeo = new LineSegmentsGeometry();
  linkGeo.setPositions(linkPos);
  linkGeo.setColors(linkCol);
  const linkMat = new LineMaterial({
    color: 0xffffff,
    linewidth: 1.4 * (width * dpr) / 1280,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    worldUnits: false,
  });
  linkMat.resolution.set(width * dpr, height * dpr);
  const links = new LineSegments2(linkGeo, linkMat);
  links.frustumCulled = false;
  scene.add(links);
  const linkColor = col(params.link);
  const lr = mulberry32(999);
  // fixed link pairs: next in the same shell, plus a few cross-shell pairs
  const pairs: [number, number, number][] = [];
  const shellsN = 5;
  for (let i = 0; i < sats.length; i++) {
    const j = i + shellsN < sats.length ? i + shellsN : i % shellsN;
    pairs.push([i, j, 0.9]);
    pairs.push([i, Math.floor(lr() * sats.length), 0.7]);
    if (lr() < 0.5) pairs.push([i, Math.floor(lr() * sats.length), 0.5]);
  }
  const ground = sats.map(() => new THREE.Vector3(gauss(lr) * 0.25, gauss(lr) * 0.25, gauss(lr) * 0.25));
  const groundOn = sats.map(() => lr() < 0.85);

  // signal icons
  const iconGeo = new THREE.PlaneGeometry(1, 1);
  const icons = Array.from({ length: 24 }, (_, k) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: ICON_VERT,
      fragmentShader: ICON_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: col(params.rim).multiplyScalar(2.4) }, uPulse: { value: 0 }, uAlpha: { value: 1 } },
    });
    const mesh = new THREE.Mesh(iconGeo, m);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { mesh, m, sat: (k * 4 + 1) % sats.length, period: [100, 120, 150, 200, 300][k % 5], off: Math.floor(lr() * 600) };
  });

  // small ring/target markers on the globe surface
  const ringMat = new THREE.ShaderMaterial({
    vertexShader: ICON_VERT,
    fragmentShader: /* glsl */ `
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float r = length(vUv * 2.0 - 1.0);
  float m = smoothstep(0.08, 0.0, abs(r - 0.75)) + smoothstep(0.08, 0.0, abs(r - 0.4)) * 0.7 + smoothstep(0.15, 0.0, r);
  gl_FragColor = vec4(uColor * m * 0.8, 1.0);
}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: col(params.rim).multiplyScalar(1.8) } },
  });
  const rr = mulberry32(31);
  for (let i = 0; i < 14; i++) {
    const u = rr() * 2 - 1, a = rr() * TAU, sq = Math.sqrt(1 - u * u);
    const n = new THREE.Vector3(Math.cos(a) * sq, u, Math.sin(a) * sq);
    const ring = new THREE.Mesh(iconGeo, ringMat);
    ring.position.copy(n).multiplyScalar(1.003);
    ring.lookAt(n.clone().multiplyScalar(2));
    ring.scale.setScalar(0.045);
    earth.add(ring);
  }

  // post-processing (half-float targets)
  const rt = new THREE.WebGLRenderTarget(width * dpr, height * dpr, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(gl, rt);
  composer.setPixelRatio(dpr);
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  let bokeh: BokehPass | null = null;
  bokeh = close
    ? new BokehPass(scene, camera, { focus: 0.2, aperture: 0.012, maxblur: 0.012 })
    : new BokehPass(scene, camera, { focus: 2.1, aperture: 0.0006, maxblur: 0.003 });
  // BokehPass renders a depth pre-pass with an override material that has no
  // gl_PointSize, which leaves point sprites with an undefined size (and a
  // non-deterministic depth). Hide the point clouds during that pass only:
  // they are far background / out-of-focus dots anyway.
  {
    const b = bokeh;
    const original = b.render.bind(b);
    b.render = (...args: Parameters<BokehPass["render"]>) => {
      for (const p of pointClouds) p.visible = false;
      try {
        original(...args);
      } finally {
        for (const p of pointClouds) p.visible = true;
      }
    };
  }
  composer.addPass(bokeh);
  const bloom = new UnrealBloomPass(new THREE.Vector2(width * dpr, height * dpr), close ? 0.55 : 0.7, 0.6, 0.75);
  composer.addPass(bloom);
  const final = new ShaderPass(FINAL);
  (final.uniforms as Record<string, { value: number }>).uExposure.value = close ? 0.8 : 1.0;
  composer.addPass(final);

  // reusable temporaries
  const P = new THREE.Vector3(), Q = new THREE.Vector3(), M = new THREE.Matrix4(), S = new THREE.Vector3();
  const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion(), tiltQ = new THREE.Quaternion();

  /** Panels (model +Y) face the sun; wings (model X) across the orbit. */
  const satMatrix = (s: Sat, pos: THREE.Vector3, scale: number, out: THREE.Matrix4) => {
    Y.copy(SUN);
    X.copy(pos).normalize().cross(Y);
    if (X.lengthSq() < 1e-4) X.set(1, 0, 0);
    X.normalize();
    Z.crossVectors(X, Y).normalize();
    out.makeBasis(X, Y, Z);
    quat.setFromRotationMatrix(out);
    tiltQ.setFromAxisAngle(X, s.tilt);
    quat.premultiply(tiltQ);
    out.compose(pos, quat, S.setScalar(scale));
    return out;
  };

  const render = (frame: number) => {
    const ph = (((frame % 600) + 600) % 600) / 600;
    const th = ph * TAU;
    earth.rotation.y = -1.15 + (12 * Math.PI) / 180 * Math.cos(th); // sway +-12 deg

    sats.forEach((s, i) => {
      orbitPos(s, ph, P);
      // wide shot: keep apparent size roughly constant (flat, graphic look)
      const sz = close ? SAT_SIZE : SAT_SIZE * THREE.MathUtils.clamp(P.distanceTo(WIDE_EYE) / 1.7, 0.35, 1.2);
      satMatrix(s, P, sz * s.scale, M);
      for (const im of inst) im.setMatrixAt(i, M);
    });
    for (const im of inst) im.instanceMatrix.needsUpdate = true;

    // camera
    if (!close) {
      camera.position.copy(WIDE_EYE).add(Q.set(0.05 * Math.cos(th), 0.04 * Math.sin(th), 0));
      camera.lookAt(Q.copy(WIDE_TARGET).add(P.set(0.03 * Math.sin(th), 0, 0)));
      camera.rotateZ(-0.42);
    } else {
      orbitPos(heroSat, ph, P);
      satMatrix(heroSat, P, 0.06, M);
      hero.matrixAutoUpdate = false;
      hero.matrix.copy(M);
      hero.matrixWorldNeedsUpdate = true;
      // follow frame: radial, along-track, orbit normal
      const a = heroSat.a0 + TAU * ph;
      orbitPos(heroSat, ph + 0.002, Q);
      const along = Q.clone().sub(P).normalize();
      const radial = P.clone().normalize();
      const normal = new THREE.Vector3().crossVectors(radial, along).normalize();
      const sway = 0.012 * Math.sin(th) ;
      camera.position.copy(P)
        .addScaledVector(along, -0.1)
        .addScaledVector(radial, 0.07 + 0.008 * Math.cos(th))
        .addScaledVector(normal, 0.085 + sway);
      up.copy(radial);
      camera.up.copy(up);
      camera.lookAt(Q.copy(P).addScaledVector(radial, -0.05).addScaledVector(along, 0.06));
      void a;
      if (bokeh) {
        const u = bokeh.uniforms as Record<string, { value: number }>;
        u.focus.value = camera.position.distanceTo(P);
      }
    }
    camera.updateMatrixWorld();

    // links
    let k = 0;
    const put = (a: THREE.Vector3, b: THREE.Vector3, intensity: number) => {
      if (k >= MAXSEG || intensity <= 0.002) return;
      linkPos.set([a.x, a.y, a.z, b.x, b.y, b.z], k * 6);
      const c = linkColor;
      linkCol.set([c.r * intensity, c.g * intensity, c.b * intensity, c.r * intensity, c.g * intensity, c.b * intensity], k * 6);
      k++;
    };
    const posCache = sats.map((s) => orbitPos(s, ph, new THREE.Vector3()));
    for (const [i, j, w] of pairs) {
      const d = posCache[i].distanceTo(posCache[j]);
      put(posCache[i], posCache[j], 0.32 * w * (1 - THREE.MathUtils.smoothstep(d, 0.5, 1.1)));
    }
    sats.forEach((_, i) => {
      if (!groundOn[i]) return;
      Q.copy(posCache[i]).add(ground[i]).normalize().multiplyScalar(1.002);
      put(posCache[i], Q, 0.22);
    });
    for (; k < MAXSEG; k++) {
      linkPos.fill(0, k * 6, k * 6 + 6);
      linkCol.fill(0, k * 6, k * 6 + 6);
    }
    linkGeo.setPositions(linkPos);
    linkGeo.setColors(linkCol);

    // icons: billboards at satellites, pulsing
    const f = Math.round(ph * 600);
    for (const ic of icons) {
      ic.mesh.position.copy(posCache[ic.sat]);
      ic.mesh.quaternion.copy(camera.quaternion);
      ic.mesh.scale.setScalar(close ? 0.05 : 0.2 * THREE.MathUtils.clamp(posCache[ic.sat].distanceTo(camera.position) / 1.7, 0.35, 1.3));
      const u = ((f + ic.off) % ic.period) / ic.period;
      ic.m.uniforms.uPulse.value = u;
      ic.m.uniforms.uAlpha.value = 0.55 + 0.45 * Math.sin(Math.PI * u);
    }

    (final.uniforms as Record<string, { value: number }>).uFrame.value = f;
    composer.render();
  };

  return {
    render,
    dispose: () => {
      composer.dispose();
      rt.dispose();
      pmrem.dispose();
    },
  };
};
