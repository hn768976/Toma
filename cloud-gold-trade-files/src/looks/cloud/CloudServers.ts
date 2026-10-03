import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { canvasTexture, loadStudioEnv, makeCanvas } from "../../lib/assets";
import { flatRibbon, mergeSimple, offsetPolyline, Path } from "../../lib/geom";
import { PostFX } from "../../lib/post";
import { mulberry32 } from "../../lib/random";
import type { LookFactory } from "../../lib/Stage";
import type { CloudRow } from "../../versions";
import { richer } from "../../lib/color";

export const CLOUD_FRAMES = 600;

// ---- layout ------------------------------------------------------------------
// World: y up. The camera looks from +x+z, so -x is upper-left on screen,
// +z lower-left, +x lower-right and -z upper-right.
type Rack = { x: number; z: number; w: number; h: number; pad: number; outline: number; rows: number; seed: number };
const MAIN: Rack = { x: 0, z: 0, w: 2.9, h: 4.4, pad: 3.4, outline: 3.45, rows: 11, seed: 1 };
const SMALL: Rack[] = [
  { x: -8.6, z: 0.9, w: 1.45, h: 2.45, pad: 2.1, outline: 1.7, rows: 6, seed: 2 },
  { x: -0.9, z: 8.6, w: 1.45, h: 2.45, pad: 2.1, outline: 1.7, rows: 6, seed: 3 },
  { x: 10.0, z: 0.6, w: 1.45, h: 2.45, pad: 2.1, outline: 1.7, rows: 6, seed: 4 },
];
const SLAB_H = 0.22;
const CLOUD_POS = new THREE.Vector3(1.5, 6.1, -4.6);
const CLOUD_LINES_X = [0.9, 1.15, 1.4, 1.65, 1.9];
const CLOUD_LINE_Z = -4.6;

type Bundle = { path: [number, number][]; n: number; gap: number; fade?: boolean };
const BUNDLES: Bundle[] = [
  // straight bundles: satellite pad frame -> central frame
  { path: [[-6.9, 0.9], [-3.45, 0.9]], n: 5, gap: 0.2 },
  { path: [[-0.9, 6.9], [-0.9, 3.45]], n: 5, gap: 0.2 },
  { path: [[8.3, 0.6], [3.45, 0.6]], n: 5, gap: 0.2 },
  // main outline -> slab, short stubs on each side
  { path: [[-3.45, -0.6], [-1.9, -0.6]], n: 3, gap: 0.22 },
  { path: [[-0.6, 3.45], [-0.6, 1.9]], n: 3, gap: 0.22 },
  { path: [[3.45, -0.5], [1.9, -0.5]], n: 3, gap: 0.22 },
];

const rng = mulberry32(0xc10d);
// data dots: per trace line, how many dots, direction and whole-number laps per loop
type DotSpec = { phase: number; dir: number; laps: number };
const dotSpec = (): DotSpec => ({ phase: rng(), dir: rng() < 0.5 ? 1 : -1, laps: 1 + Math.floor(rng() * 3) });

// ---- shaders -------------------------------------------------------------------
const floorVert = /* glsl */ `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;
const floorFrag = /* glsl */ `
uniform vec3 uBase; uniform vec3 uGrid; uniform vec3 uLine;
varying vec3 vW;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float grid(vec2 p, float sp, float w) {
  vec2 q = p / sp;
  vec2 fw = fwidth(q);
  vec2 g = abs(fract(q - 0.5) - 0.5);
  vec2 wq = vec2(w / sp);
  vec2 l = (1.0 - smoothstep(wq * 0.5, wq * 0.5 + fw, g)) * min(vec2(1.0), wq / max(fw, 1e-5));
  return max(l.x, l.y);
}
void main() {
  vec2 p = vW.xz;
  float r = length(p - vec2(0.0, 1.0));
  float g = grid(p, 0.42, 0.016);
  // specks: one candidate per cell
  vec2 cell = floor(p * 2.5);
  float h = hash(cell);
  vec2 c = (cell + 0.2 + 0.6 * vec2(hash(cell + 7.1), hash(cell + 3.7))) / 2.5;
  float sp = step(0.5, h) * (1.0 - smoothstep(0.0, 0.022, length(p - c)));
  float fade = exp(-r * 0.03);
  vec3 col = uBase * (0.75 + 0.5 * fade);
  col += uGrid * g * (0.14 + 0.3 * fade);
  col += uLine * sp * (0.35 + 1.2 * hash(cell + 1.3)) * (0.4 + fade);
  // soft blue haze around the centre of the scene
  col += uLine * 0.02 * exp(-r * 0.12);
  gl_FragColor = vec4(col, 1.0);
}
`;

const glowFrag = /* glsl */ `
uniform vec3 uColor; uniform float uHalf; uniform float uK; uniform float uI;
varying vec3 vL;
void main() {
  vec2 q = abs(vL.xz) - vec2(uHalf);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  float a = d < 0.0 ? 1.0 : exp(-d * uK);
  gl_FragColor = vec4(uColor * a * uI, 1.0);
}
`;
const glowVert = /* glsl */ `
varying vec3 vL;
void main() { vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const lineFrag = /* glsl */ `
uniform vec3 uColor; uniform float uI; uniform float uFadeLen;
varying vec2 vUv;
void main() {
  float across = 1.0 - smoothstep(0.55, 1.0, abs(vUv.y));
  float f = uFadeLen > 0.0 ? 1.0 - smoothstep(uFadeLen * 0.3, uFadeLen, vUv.x) : 1.0;
  gl_FragColor = vec4(uColor * uI * across * f, 1.0);
}
`;
const lineVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

function rackMaterial(row: CloudRow, rack: Rack, env: THREE.Texture, uFrame: { value: number }) {
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(row.rack).multiplyScalar(0.7),
    metalness: 0.85,
    roughness: 0.32,
    envMap: env,
    envMapIntensity: 0.5,
  });
  const lc = row.lights.map((c) => new THREE.Color(c));
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFrame = uFrame;
    sh.uniforms.uSize = { value: new THREE.Vector3(rack.w, rack.h, rack.w) };
    sh.uniforms.uRows = { value: rack.rows };
    sh.uniforms.uSeed = { value: rack.seed };
    sh.uniforms.uL0 = { value: lc[0] };
    sh.uniforms.uL1 = { value: lc[1] };
    sh.uniforms.uL2 = { value: lc[2] };
    sh.uniforms.uL3 = { value: lc[3] };
    sh.uniforms.uLine = { value: new THREE.Color(row.line) };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vOP; varying vec3 vON;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvOP = position; vON = normal;");
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
varying vec3 vOP; varying vec3 vON;
uniform float uFrame; uniform vec3 uSize; uniform float uRows; uniform float uSeed;
uniform vec3 uL0; uniform vec3 uL1; uniform vec3 uL2; uniform vec3 uL3; uniform vec3 uLine;
vec4 hash4(vec3 p) {
  vec4 q = fract(vec4(p.xyzx) * vec4(0.1031, 0.1030, 0.0973, 0.1099));
  q += dot(q, q.wzxy + 33.33);
  return fract((q.xxyz + q.yzzw) * q.zywx);
}
// face-local coords: u across the face (0..1), v up (0..1), face id
vec3 faceUV() {
  vec3 n = vON; vec3 p = vOP;
  if (abs(n.y) > 0.6) return vec3(-1.0);
  float u; float id;
  if (abs(n.x) > abs(n.z)) { u = p.z * sign(n.x) / uSize.z + 0.5; id = n.x > 0.0 ? 1.0 : 2.0; }
  else { u = -p.x * sign(n.z) / uSize.x + 0.5; id = n.z > 0.0 ? 3.0 : 4.0; }
  return vec3(u, p.y / uSize.y + 0.5, id);
}
`,
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
vec3 fuv = faceUV();
float rowMask = 0.0; vec2 rc = vec2(0.0); vec2 inRow = vec2(0.0);
if (fuv.z > 0.0) {
  float m = 0.07;
  vec2 q = (fuv.xy - m) / (1.0 - 2.0 * m);
  if (all(greaterThan(q, vec2(0.0))) && all(lessThan(q, vec2(1.0)))) {
    float rv = q.y * uRows;
    rc = vec2(floor(rv), fuv.z);
    inRow = vec2(q.x, fract(rv));
    rowMask = 1.0;
    // recessed unit faces with a bright lip on top of each unit
    float lip = smoothstep(0.86, 0.93, inRow.y) * (1.0 - smoothstep(0.93, 1.0, inRow.y));
    float gap = 1.0 - smoothstep(0.0, 0.1, inRow.y);
    // vent slots on the right of each drawer
    float vent = step(0.55, inRow.x) * step(inRow.x, 0.93) * step(0.25, inRow.y) * step(inRow.y, 0.7)
               * step(fract(inRow.x * 26.0), 0.42);
    diffuseColor.rgb *= mix(0.62, 1.0, lip) * (1.0 - 0.85 * gap) * (1.0 - 0.55 * vent);
  } else {
    diffuseColor.rgb *= 1.15;
  }
} else {
  // lighter steel-blue top
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.35, 0.45, 0.62), 0.45) * 1.25;
}
`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
if (rowMask > 0.5) {
  // thin light strip along each unit
  float strip = smoothstep(0.80, 0.84, inRow.y) * (1.0 - smoothstep(0.84, 0.88, inRow.y));
  totalEmissiveRadiance += uLine * strip * 0.9;
  // faint self-lit blue body, like the reference's glowing racks
  totalEmissiveRadiance += uLine * 0.05;
  // LEDs: 9 slots per unit, each its own colour, period (dividing 600) and phase
  float slots = 12.0;
  float sx = inRow.x * slots;
  float ci = floor(sx);
  vec4 h = hash4(vec3(rc.x * 13.0 + ci, rc.y * 7.0 + uSeed * 31.0, uSeed));
  vec4 h2 = hash4(vec3(ci + 3.1, rc.x + 11.7, rc.y + uSeed));
  // LED cluster at the left end of each drawer
  if (h.x < 0.85 && inRow.x < 0.72) {
    vec2 d = vec2((fract(sx) - 0.5) * uSize.x / slots, (inRow.y - 0.45) * uSize.y / uRows);
    float r = length(d) / 0.045;
    float dotm = 1.0 - smoothstep(0.55, 1.0, r);
    vec3 c = h.y < 0.6 ? uL0 : (h.y < 0.84 ? uL1 : (h.y < 0.94 ? uL2 : uL3));
    float P = h.z < 0.1 ? 30.0 : h.z < 0.2 ? 40.0 : h.z < 0.3 ? 50.0 : h.z < 0.42 ? 60.0 : h.z < 0.54 ? 75.0
            : h.z < 0.66 ? 100.0 : h.z < 0.78 ? 120.0 : h.z < 0.88 ? 150.0 : h.z < 0.95 ? 200.0 : 300.0;
    float ph = floor(h.w * P);
    float duty = 0.3 + 0.6 * h2.x;
    float on = h2.y < 0.3 ? 1.0 : step(mod(uFrame + ph, P), duty * P);
    totalEmissiveRadiance += c * dotm * (0.3 + on * (6.0 + 8.0 * h2.z));
  }
}
`,
      );
  };
  return m;
}

function cloudGeometry(): THREE.ExtrudeGeometry {
  // union of circles + a flat-bottomed slab, traced as a star-shaped outline
  // classic three-lobed cloud icon: small left lobe, big centre, medium right
  const circles = [
    [-1.05, -0.08, 0.68],
    [0.1, 0.42, 1.02],
    [1.12, 0.0, 0.74],
  ];
  const bottom = -0.75;
  const inside = (x: number, y: number) => {
    if (y >= bottom && y <= 0 && x >= -1.05 && x <= 1.12) return true;
    return circles.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
  };
  const cx = 0.15, cy = 0.0;
  const pts: THREE.Vector2[] = [];
  const N = 240;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    let t = 0;
    for (let s = 0; s < 4; s += 0.002) if (inside(cx + dx * s, cy + dy * s)) t = s;
    pts.push(new THREE.Vector2(cx + dx * t, cy + dy * t));
  }
  // round the two bottom corners (slab corners) a little
  const shape = new THREE.Shape(pts);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 1.0,
    bevelEnabled: true,
    bevelThickness: 0.2,
    bevelSize: 0.16,
    bevelSegments: 8,
    curveSegments: 4,
  });
  g.translate(0, 0, -0.5);
  g.computeVertexNormals();
  return g;
}

/** Same hue, full saturation: ACES desaturates bright colours, so glows start richer. */
function saturated(c: THREE.Color): THREE.Color {
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  // trim the secondary channel a little: ACES cross-talk would otherwise wash it towards white
  const o = new THREE.Color().setHSL(hsl.h, 1, 0.5);
  const mx = Math.max(o.r, o.g, o.b);
  return new THREE.Color(o.r === mx ? o.r : o.r * 0.72, o.g === mx ? o.g : o.g * 0.72, o.b === mx ? o.b : o.b * 0.72);
}

export const createCloudServers: LookFactory<CloudRow> = async ({ gl, width, height, props: row }) => {
  const env = await loadStudioEnv(gl);
  const scene = new THREE.Scene();
  const uFrame = { value: 0 };
  // a touch towards blue: ACES pushes bright cyan towards mint otherwise
  const LINE = richer(row.line, 0.45).multiply(new THREE.Color(0.8, 0.9, 1.15));
  const hdr = (c: THREE.Color, k: number) => c.clone().multiplyScalar(k);

  // floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 260).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      vertexShader: floorVert,
      fragmentShader: floorFrag,
      uniforms: {
        uBase: { value: new THREE.Color(row.floor) },
        uGrid: { value: hdr(new THREE.Color(row.line).lerp(new THREE.Color(row.rack), 0.85), 0.6) },
        uLine: { value: LINE },
      },
      extensions: { derivatives: true } as never,
    }),
  );
  scene.add(floor);

  // lights
  scene.add(new THREE.AmbientLight(0x7090d0, 0.15));
  const key = new THREE.DirectionalLight(0xbcd4ff, 1.0);
  key.position.set(-6, 14, 9);
  scene.add(key);
  const rim = new THREE.DirectionalLight(LINE, 0.6);
  rim.position.set(8, 4, -10);
  scene.add(rim);

  const glowMat = (half: number, k: number, i: number) =>
    new THREE.ShaderMaterial({
      vertexShader: glowVert,
      fragmentShader: glowFrag,
      uniforms: { uColor: { value: LINE }, uHalf: { value: half }, uK: { value: k }, uI: { value: i } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  const lineMat = (i: number, fadeLen = 0) =>
    new THREE.ShaderMaterial({
      vertexShader: lineVert,
      fragmentShader: lineFrag,
      uniforms: { uColor: { value: LINE }, uI: { value: i }, uFadeLen: { value: fadeLen } },
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  const nodeMat = new THREE.MeshBasicMaterial({ color: hdr(LINE, 3.2) });
  const nodeGeo = new THREE.CircleGeometry(0.075, 20).rotateX(-Math.PI / 2);
  const node = (x: number, z: number, s = 1) => {
    const n = new THREE.Mesh(nodeGeo, nodeMat);
    n.position.set(x, 0.025, z);
    n.scale.setScalar(s);
    scene.add(n);
  };

  // racks + pads
  const racks = [MAIN, ...SMALL];
  racks.forEach((r) => {
    // glowing slab
    const slabMats = [
      new THREE.MeshBasicMaterial({ color: hdr(LINE, 1.25) }), // +x
      new THREE.MeshBasicMaterial({ color: hdr(LINE, 1.25) }), // -x
      new THREE.MeshBasicMaterial({ color: hdr(LINE, 1.0) }), // top
      new THREE.MeshBasicMaterial({ color: hdr(LINE, 0.3) }), // bottom
      new THREE.MeshBasicMaterial({ color: hdr(LINE, 1.25) }), // +z
      new THREE.MeshBasicMaterial({ color: hdr(LINE, 1.25) }), // -z
    ];
    const slab = new THREE.Mesh(new THREE.BoxGeometry(r.pad, SLAB_H, r.pad), slabMats);
    slab.position.set(r.x, SLAB_H / 2, r.z);
    scene.add(slab);
    // floor glow around slab
    const g = new THREE.Mesh(new THREE.PlaneGeometry(r.outline * 2.6, r.outline * 2.6).rotateX(-Math.PI / 2), glowMat(r.pad / 2, 3.6, 0.4));
    g.position.set(r.x, 0.012, r.z);
    scene.add(g);
    // faint fill inside the outline
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(r.outline * 2, r.outline * 2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: hdr(LINE, 0.035), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    fill.position.set(r.x, 0.008, r.z);
    scene.add(fill);
    // outline square
    const o = r.outline;
    // rounded-corner frame
    const cr = o * 0.22;
    const sq: THREE.Vector3[] = [];
    [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sz], ci) => {
      for (let k = 0; k <= 8; k++) {
        const a = (ci * Math.PI) / 2 + (k / 8) * (Math.PI / 2);
        sq.push(new THREE.Vector3(r.x + sx * (o - cr) + Math.cos(a) * cr, 0.02, r.z + sz * (o - cr) + Math.sin(a) * cr));
      }
    });
    sq.push(sq[0].clone());
    scene.add(new THREE.Mesh(flatRibbon(sq, 0.035), lineMat(1.8)));
    // inner second outline (double border)
    const inner = sq.map((v) => new THREE.Vector3(r.x + (v.x - r.x) * 0.86, v.y, r.z + (v.z - r.z) * 0.86));
    scene.add(new THREE.Mesh(flatRibbon(inner, 0.025), lineMat(1.1)));
    // short L-shaped circuit traces off two corners, ending in nodes
    [[1, -1], [-1, 1]].forEach(([sx, sz]) => {
      const c0 = new THREE.Vector3(r.x + sx * o * 0.92, 0.02, r.z + sz * o * 0.92);
      const c1 = c0.clone().add(new THREE.Vector3(sx * o * 0.45, 0, 0));
      const c2 = c1.clone().add(new THREE.Vector3(0, 0, sz * o * 0.35));
      scene.add(new THREE.Mesh(flatRibbon([c0, c1, c2], 0.03), lineMat(1.6)));
      node(c2.x, c2.z, 0.8);
    });
    // rack body
    const rack = new THREE.Mesh(new RoundedBoxGeometry(r.w, r.h, r.w, 4, 0.09), rackMaterial(row, r, env, uFrame));
    rack.position.set(r.x, SLAB_H + r.h / 2, r.z);
    scene.add(rack);
    // cyan under-light from the pad
    const pl = new THREE.PointLight(LINE, r === MAIN ? 9 : 4, r === MAIN ? 9 : 5, 2);
    pl.position.set(r.x + 0.6 * r.pad, 0.6, r.z + 0.6 * r.pad);
    scene.add(pl);
  });

  // traces
  const paths: { path: Path; spec: DotSpec[] }[] = [];
  const ribbons: THREE.BufferGeometry[] = [];
  const fadeRibbons: THREE.BufferGeometry[] = [];
  BUNDLES.forEach((b) => {
    for (let k = 0; k < b.n; k++) {
      const off = (k - (b.n - 1) / 2) * b.gap;
      const p2 = offsetPolyline(b.path, off);
      const pts = p2.map(([x, z]) => new THREE.Vector3(x, 0.02, z));
      (b.fade ? fadeRibbons : ribbons).push(flatRibbon(pts, 0.045));
      if (!b.fade) {
        node(p2[0][0], p2[0][1]);
        node(p2[p2.length - 1][0], p2[p2.length - 1][1]);
        for (let i = 1; i < p2.length - 1; i++) node(p2[i][0], p2[i][1], 0.7);
      } else node(p2[0][0], p2[0][1]);
      const ndots = 1;
      paths.push({ path: new Path(pts.map((p) => p.clone().setY(0.06))), spec: Array.from({ length: ndots }, dotSpec) });
    }
  });
  scene.add(new THREE.Mesh(mergeSimple(ribbons), lineMat(2.0)));
  if (fadeRibbons.length) scene.add(new THREE.Mesh(mergeSimple(fadeRibbons), lineMat(1.6, 7)));

  // cloud
  const cloudCol = new THREE.Color(row.cloud);
  const cloudMat = new THREE.MeshPhysicalMaterial({
    color: cloudCol.clone().multiplyScalar(0.12),
    roughness: 0.3,
    metalness: 0.0,
    clearcoat: 0.0,
    specularIntensity: 0.6,
    transparent: true,
    opacity: 0.93,
    emissive: hdr(saturated(cloudCol), 1.3),
    envMap: env,
    envMapIntensity: 0.05,
  });
  cloudMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vCloudY;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCloudY = position.y;");
    sh.uniforms.uRim = { value: hdr(cloudCol.clone().lerp(new THREE.Color(1, 1, 1), 0.3), 1.8) };
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uRim; varying float vCloudY;")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
float fr = pow(1.0 - clamp(abs(dot(normalize(vNormal), normalize(vViewPosition))), 0.0, 1.0), 2.5);
totalEmissiveRadiance += uRim * fr;
// brighter upper lobes, deeper body towards the base
totalEmissiveRadiance *= mix(0.6, 1.45, smoothstep(-0.9, 1.3, vCloudY));`,
      );
  };
  const cloud = new THREE.Mesh(cloudGeometry(), cloudMat);
  cloud.scale.setScalar(1.3);
  cloud.position.copy(CLOUD_POS);
  cloud.rotation.y = Math.PI / 4 - 0.5; // turned so its thickness shows on the right
  scene.add(cloud);
  const cloudLight = new THREE.PointLight(cloudCol, 1.5, 10, 2);
  cloudLight.position.set(CLOUD_POS.x + 2, CLOUD_POS.y - 0.5, CLOUD_POS.z + 2.5);
  scene.add(cloudLight);

  // vertical light lines cloud -> floor -> main slab
  const vRibbons: THREE.BufferGeometry[] = [];
  const cloudBottom = CLOUD_POS.y - 0.8 * 1.3;
  CLOUD_LINES_X.forEach((x, k) => {
    const top = new THREE.Vector3(x, cloudBottom + 0.3, CLOUD_LINE_Z);
    const down = new THREE.Vector3(x, 0.02, CLOUD_LINE_Z);
    // vertical part: a thin box seen from any angle
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.035, top.y - down.y, 0.035), new THREE.MeshBasicMaterial({ color: hdr(LINE, 2.8) }));
    v.position.set(x, (top.y + down.y) / 2, CLOUD_LINE_Z);
    scene.add(v);
    const floorPts = [down, new THREE.Vector3(x, 0.02, -1.9)];
    vRibbons.push(flatRibbon(floorPts, 0.045));
    node(x, CLOUD_LINE_Z, 0.9);
    const p = new Path([top, down, floorPts[1]].map((q) => q.clone().setY(Math.max(0.06, q.y))));
    paths.push({ path: p, spec: [{ phase: k * 0.37, dir: 1, laps: 2 + (k % 2) }] });
  });
  scene.add(new THREE.Mesh(mergeSimple(vRibbons), lineMat(2.0)));

  // a field of small floating blue particles
  const frng = mulberry32(0xf1a2e);
  const dotTex = (() => {
    const [c, ctx] = makeCanvas(64, 64);
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.5, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return canvasTexture(c, false);
  })();
  for (let k = 0; k < 220; k++) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: dotTex, color: hdr(LINE.clone().lerp(new THREE.Color(row.rack), 0.75), 0.5 + frng() * 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    sp.position.set((frng() - 0.5) * 50, 0.3 + frng() * 9, (frng() - 0.5) * 50);
    sp.scale.setScalar(0.04 + Math.pow(frng(), 4) * 0.25);
    scene.add(sp);
  }

  // data dots (instanced), positions are a pure function of the frame
  const dotCount = paths.reduce((a, p) => a + p.spec.length, 0);
  const dots = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.075, 12, 8),
    new THREE.MeshBasicMaterial({ color: hdr(LINE.clone().lerp(new THREE.Color(1, 1, 1), 0.35), 9) }),
    dotCount,
  );
  dots.frustumCulled = false;
  scene.add(dots);
  // small halo quads under the dots
  const tmp = new THREE.Vector3();
  const mtx = new THREE.Matrix4();

  // long lens for a near-isometric look
  const camera = new THREE.PerspectiveCamera(2 * THREE.MathUtils.radToDeg(Math.atan(12 / 135)), width / height, 1, 600);
  const target = new THREE.Vector3(1.4, 3.0, 0.4);

  const post = new PostFX(gl, width, height, {
    exposure: 1.0,
    bloomStrength: 0.75,
    bloomThreshold: 0.35,
    bloomKnee: 0.6,
    bloomWeights: [0.5, 0.8, 1.0, 1.0, 0.8, 0.6],
    grain: 0.02,
    vignette: 0.35,
    clearColor: new THREE.Color(row.floor),
    dof: null,
  });

  return {
    render(frame) {
      const f = ((frame % CLOUD_FRAMES) + CLOUD_FRAMES) % CLOUD_FRAMES;
      const t = f / CLOUD_FRAMES;
      uFrame.value = f;
      let i = 0;
      paths.forEach(({ path, spec }) => {
        spec.forEach((s) => {
          const u = (((s.phase + s.dir * s.laps * t) % 1) + 1) % 1;
          path.at(u * path.length, tmp);
          mtx.makeTranslation(tmp.x, tmp.y, tmp.z);
          dots.setMatrixAt(i++, mtx);
        });
      });
      dots.instanceMatrix.needsUpdate = true;
      // closed camera sway
      const a = Math.PI * 2 * t;
      const az = Math.PI / 4 + 0.035 * Math.sin(a);
      const el = THREE.MathUtils.degToRad(29 + 0.8 * Math.sin(a + 1.2));
      const R = 86;
      camera.position.set(
        target.x + R * Math.cos(el) * Math.sin(az),
        target.y + R * Math.sin(el),
        target.z + R * Math.cos(el) * Math.cos(az),
      );
      camera.lookAt(target);
      camera.updateMatrixWorld();
      post.render(scene, camera, f);
    },
  };
};
