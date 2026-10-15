import * as THREE from "three";
import { DEFAULT_POST } from "../lib/pipeline";
import { hash2, mulberry32 } from "../lib/random";
import type { LookFactory } from "../lib/Stage";

export type TowerParams = {
  edge: string; // box edge lines
  digits: string; // data marks
  fill: string; // faint face fill
  dot: string; // field dots
  fieldA: string; // field colour away from the tower
  fieldB: string; // darker band near the tower
  glow: number;
};

// Tower geometry (world units). The stack moves up exactly one SPACING per
// loop and turns exactly one TWIST step, so frame N == frame 0.
const W = 1.95; // box width/depth
const H = 1.42; // box height
const SPACING = 1.47;
const TWIST = THREE.MathUtils.degToRad(15);
const TILT = THREE.MathUtils.degToRad(-1.5); // whole stack leans: bottom to the right
const N_LO = -7; // box slots kept in view (14 stacked; ~5 on screen)
const N_HI = 6;
const BOXES = N_HI - N_LO + 1;
const EDGE = 0.016;
const VARIANTS = 16; // digit panel variants in the atlas (4×4)
const TICKS = 5; // data marks change this many times per loop (per face)

// ---- digit atlas ----------------------------------------------------------
const buildDigitAtlas = (color: string) => {
  const cell = 512;
  const canvas = document.createElement("canvas");
  canvas.width = cell * 4;
  canvas.height = cell * 4;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const rnd = mulberry32(7741);
  for (let v = 0; v < VARIANTS; v++) {
    const ox = (v % 4) * cell;
    const oy = Math.floor(v / 4) * cell;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox + 6, oy + 6, cell - 12, cell - 12);
    ctx.clip();
    const fs = 16;
    ctx.font = `500 ${fs}px "JetBrains Mono"`;
    ctx.textBaseline = "top";
    for (let row = 0; row < 26; row++) {
      if (rnd() < 0.08) continue; // empty line
      let x = ox + 14 + rnd() * 24;
      const y = oy + 16 + row * fs * 1.22;
      while (x < ox + cell - 40) {
        const len = 1 + Math.floor(rnd() * 7);
        let s = "";
        for (let k = 0; k < len; k++) s += rnd() < 0.5 ? "0" : "1";
        const a = 0.35 + rnd() * 0.65;
        ctx.fillStyle = color;
        ctx.globalAlpha = a;
        ctx.fillText(s, x, y);
        x += ctx.measureText(s).width + fs * (0.45 + rnd() * 0.9);
        if (rnd() < 0.06) x += fs * 2;
      }
    }
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  return tex;
};

// "0" and "1" glyphs for the pixel field
const buildGlyphs = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = "#fff";
  ctx.font = `500 56px "JetBrains Mono"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("0", 32, 34);
  ctx.fillText("1", 96, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
};

const FACE_VERT = /* glsl */ `
attribute float aVariant;
attribute float aFade;
varying vec2 vUv;
varying float vFade;
void main() {
  float v = aVariant;
  vec2 cell = vec2(mod(v, 4.0), floor(v / 4.0));
  vUv = (cell + vec2(uv.x, uv.y)) / 4.0;
  vUv.y = 1.0 - ((cell.y + (1.0 - uv.y)) / 4.0);
  vFade = aFade;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}
`;
const FACE_FRAG = /* glsl */ `
uniform sampler2D digits;
uniform vec3 digitColor;
uniform vec3 fillColor;
uniform float fillAmt;
varying vec2 vUv;
varying float vFade;
void main() {
  float d = texture2D(digits, vUv).r;
  vec3 c = digitColor * d * 0.7 + fillColor * fillAmt;
  gl_FragColor = vec4(c * vFade, 1.0);
}
`;

const FIELD_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vW;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
// Pixel-dot field: one small square per grid cell, brightness held for a
// whole number of frames (a divisor of the loop) and re-picked by hash.
const FIELD_FRAG = /* glsl */ `
precision highp float;
uniform vec3 colA, colB, dotCol, spill;
uniform sampler2D glyphs;
uniform float frame; // already modulo the loop length
uniform float t; // loop phase
uniform float cellSize;
uniform float towerX;
varying vec3 vW;
uint h32(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v.x ^ v.y ^ v.z;
}
float r01(uvec3 v) { return float(h32(v)) / 4294967295.0; }
void main() {
  float dx = vW.x - towerX;
  // dark navy strip only on the far side (left) of the tower
  float left = 1.0 - smoothstep(-6.3, -5.4, dx);
  vec3 base = colA;
  base *= 0.88 + 0.08 * smoothstep(-8.0, 10.0, vW.y);
  base = mix(base, colB, left);
  // light spilling from the tower onto the field
  base += spill * exp(-dx * dx / 10.0) * 0.03;
  // soft brighter band through the middle rows
  base *= 1.0 + 0.07 * exp(-pow((vW.y - 1.5) / 4.0, 2.0)) * (1.0 - left);

  // the left strip uses bigger, chunkier squares
  float cs = mix(cellSize, cellSize * 2.0, left);
  vec2 g = vW.xy / cs;
  vec2 id = floor(g);
  vec2 f = fract(g);
  uvec2 uid = uvec2(ivec2(id) + 4096) + uvec2(left > 0.5 ? 9000u : 0u);
  float seed = r01(uvec3(uid, 7u));
  // hold length per dot: 10, 15, 20 or 30 frames (all divide 600)
  float holds[4] = float[4](10.0, 15.0, 20.0, 30.0);
  float hold = holds[int(seed * 3.999)];
  float step_ = floor((frame + floor(seed * hold)) / hold);
  float steps = 600.0 / hold;
  uint s = uint(mod(step_, steps));
  float b = r01(uvec3(uid, s + 101u));
  float present = step(0.55, r01(uvec3(uid, 3u)));
  // digital-rain columns: a bright head runs down each column, a whole
  // number of column periods per loop
  float colSeed = r01(uvec3(uint(id.x + 4096.0), 5u, 77u));
  float n = 1.0 + floor(colSeed * 2.0);
  float ph = fract(vW.y / 9.0 + n * t + colSeed * 7.0);
  float rain = 0.35 + 0.65 * pow(ph, 3.0);
  float lum = present * (0.2 + 0.8 * pow(b, 2.0)) * rain;
  vec2 q = abs(f - 0.5);
  float sz = 0.2 + 0.1 * r01(uvec3(uid, 9u));
  float sq = step(q.x, sz) * step(q.y, sz);
  // some cells show a 0/1 glyph instead of a square
  float isGlyph = step(r01(uvec3(uid, 13u)), 0.3) * (1.0 - left);
  vec2 guv = vec2((f.x - 0.5) * 0.75 + 0.5, (f.y - 0.5) * 0.85 + 0.5);
  float which = step(0.5, r01(uvec3(uid, s + 17u)));
  float gl = texture2D(glyphs, vec2((guv.x + which) * 0.5, guv.y)).r;
  float mark = mix(sq, gl, isGlyph);
  vec3 dc = mix(dotCol, vec3(0.8, 0.92, 1.0), pow(b, 4.0));
  dc = mix(dc, vec3(0.15, 0.45, 1.0), left);
  vec3 c = base + dc * lum * mark * 0.75;
  // a few large out-of-focus blobs
  vec2 bg = vW.xy / 2.4;
  vec2 bid = floor(bg);
  uvec2 ubid = uvec2(ivec2(bid) + 4096);
  vec2 bc = vec2(r01(uvec3(ubid, 31u)), r01(uvec3(ubid, 32u)));
  float bon = step(0.82, r01(uvec3(ubid, 33u))) * (1.0 - left);
  float bd = length(fract(bg) - bc) * 2.4;
  float br = 0.18 + 0.2 * r01(uvec3(ubid, 34u));
  c += vec3(0.35, 0.6, 1.0) * bon * (1.0 - smoothstep(br * 0.6, br, bd)) * 0.06;
  gl_FragColor = vec4(c, 1.0);
}
`;

export const dataTower =
  (p: TowerParams, frames: number): LookFactory =>
  ({ aspect }) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(p.fieldB);
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.5, 200);
    camera.position.set(2.75, 0.55, 9.0);
    camera.lookAt(2.75, 0.9, 0);
    camera.updateMatrixWorld();

    // Field plane behind the tower
    const glyphs = buildGlyphs();
    const fieldMat = new THREE.ShaderMaterial({
      vertexShader: FIELD_VERT,
      fragmentShader: FIELD_FRAG,
      uniforms: {
        colA: { value: new THREE.Color(p.fieldA) },
        colB: { value: new THREE.Color(p.fieldB) },
        dotCol: { value: new THREE.Color(p.dot) },
        frame: { value: 0 },
        t: { value: 0 },
        cellSize: { value: 0.13 },
        towerX: { value: 0 },
        spill: { value: new THREE.Color(p.fill) },
        glyphs: { value: glyphs },
      },
    });
    const field = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), fieldMat);
    field.position.set(4, 2, -7);
    scene.add(field);

    // Faces with data marks (additive): 4 sides + 2 inner planes per box
    const PLANES = 6;
    const faceGeo = new THREE.PlaneGeometry(1, 1);
    const variant = new Float32Array(BOXES * PLANES);
    const fade = new Float32Array(BOXES * PLANES);
    const variantAttr = new THREE.InstancedBufferAttribute(variant, 1);
    const fadeAttr = new THREE.InstancedBufferAttribute(fade, 1);
    faceGeo.setAttribute("aVariant", variantAttr);
    faceGeo.setAttribute("aFade", fadeAttr);
    const digits = buildDigitAtlas("#FFFFFF");
    const faceMat = new THREE.ShaderMaterial({
      vertexShader: FACE_VERT,
      fragmentShader: FACE_FRAG,
      uniforms: {
        digits: { value: digits },
        digitColor: { value: new THREE.Color(p.digits) },
        fillColor: { value: new THREE.Color(p.fill) },
        fillAmt: { value: 0.2 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const faces = new THREE.InstancedMesh(faceGeo, faceMat, BOXES * PLANES);
    faces.frustumCulled = false;
    faces.renderOrder = 2;
    scene.add(faces);

    // Edge bars (12 per box)
    // over-driven (>1 in the half-float buffer): white-hot core, blue bloom
    const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.edge).multiplyScalar(1.6) });
    const edges = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), edgeMat, BOXES * 12);
    edges.frustumCulled = false;
    edges.renderOrder = 1;
    scene.add(edges);

    const hw = W / 2;
    const hh = H / 2;
    // HUD brackets: L-shaped corner marks and loose bars floating just
    // outside the box faces (they turn and rise with their box).
    const bracketLocal: THREE.Matrix4[] = [];
    {
      const rnd = mulberry32(5150);
      const o = hw + 0.13; // offset outwards
      const L = 0.34;
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          for (const sy of [-1, 1]) {
            const y = sy * (hh - 0.06);
            bracketLocal.push(new THREE.Matrix4().compose(new THREE.Vector3(sx * (o - L / 2), y, sz * o), new THREE.Quaternion(), new THREE.Vector3(L, EDGE, EDGE)));
            bracketLocal.push(new THREE.Matrix4().compose(new THREE.Vector3(sx * o, y, sz * (o - L / 2)), new THREE.Quaternion(), new THREE.Vector3(EDGE, EDGE, L)));
            bracketLocal.push(new THREE.Matrix4().compose(new THREE.Vector3(sx * o, y - sy * 0.13, sz * o), new THREE.Quaternion(), new THREE.Vector3(EDGE, 0.26, EDGE)));
          }
      for (let k = 0; k < 11; k++) {
        const face = Math.floor(rnd() * 4);
        const len = 0.3 + rnd() * 0.7;
        const along = (rnd() - 0.5) * (W - len);
        const y = (rnd() - 0.5) * H * 0.8;
        const m = new THREE.Matrix4().makeRotationY((face * Math.PI) / 2);
        m.multiply(new THREE.Matrix4().compose(new THREE.Vector3(along, y, hw + 0.08 + rnd() * 0.14), new THREE.Quaternion(), new THREE.Vector3(len, EDGE * 0.9, EDGE)));
        bracketLocal.push(m);
      }
    }
    const NB = bracketLocal.length;
    const brackets = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), edgeMat, BOXES * NB);
    brackets.frustumCulled = false;
    brackets.renderOrder = 1;
    scene.add(brackets);

    // Depth-only proxies so the additive faces still give the tower its depth
    // for depth of field.
    // transparent so it is drawn after the (transparent, additive) faces
    const proxyMat = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, depthWrite: true });
    const proxies = new THREE.InstancedMesh(new THREE.BoxGeometry(W, H, W), proxyMat, BOXES);
    proxies.frustumCulled = false;
    proxies.renderOrder = 10;
    scene.add(proxies);

    // Local transforms of the 6 face planes and 12 edges of a box.
    const facesLocal: THREE.Matrix4[] = [];
    for (let k = 0; k < 4; k++) {
      const r = new THREE.Matrix4().makeRotationY((k * Math.PI) / 2);
      facesLocal.push(r.multiply(new THREE.Matrix4().makeTranslation(0, 0, hw)).multiply(new THREE.Matrix4().makeScale(W, H, 1)));
    }
    for (let k = 0; k < 2; k++) {
      const r = new THREE.Matrix4().makeRotationY(k * (Math.PI / 2) + 0.3);
      facesLocal.push(r.multiply(new THREE.Matrix4().makeTranslation(0, 0, (k - 0.5) * 0.5)).multiply(new THREE.Matrix4().makeScale(W * 0.7, H * 0.75, 1)));
    }
    const edgesLocal: THREE.Matrix4[] = [];
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        edgesLocal.push(new THREE.Matrix4().compose(new THREE.Vector3(sx * hw, 0, sz * hw), new THREE.Quaternion(), new THREE.Vector3(EDGE, H, EDGE)));
      }
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1])
        edgesLocal.push(new THREE.Matrix4().compose(new THREE.Vector3(0, sy * hh, sz * hw), new THREE.Quaternion(), new THREE.Vector3(W + EDGE, EDGE, EDGE)));
      for (const sx of [-1, 1])
        edgesLocal.push(new THREE.Matrix4().compose(new THREE.Vector3(sx * hw, sy * hh, 0), new THREE.Quaternion(), new THREE.Vector3(EDGE, EDGE, W + EDGE)));
    }

    const boxM = new THREE.Matrix4();
    const tiltM = new THREE.Matrix4().makeRotationZ(TILT);
    const tmp = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const yAxis = new THREE.Vector3(0, 1, 0);

    return {
      scene,
      camera,
      update: (frame) => {
        const fm = ((frame % frames) + frames) % frames;
        const t = fm / frames;
        fieldMat.uniforms.frame.value = fm;
        fieldMat.uniforms.t.value = t;
        for (let b = 0; b < BOXES; b++) {
          const n = N_LO + b;
          const s = n + t; // conveyor coordinate: frame N maps box n onto box n+1
          q.setFromAxisAngle(yAxis, s * TWIST);
          // staggered: a sideways offset that is a function of s only, so the
          // one-box conveyor stays exact
          const off = 0.09 * Math.sin(s * 1.9) + 0.05 * Math.sin(s * 3.7 + 1.0);
          boxM.compose(new THREE.Vector3(off, s * SPACING, 0.1 * Math.sin(s * 2.3)), q, new THREE.Vector3(1, 1, 1));
          boxM.premultiply(tiltM);
          proxies.setMatrixAt(b, boxM);
          for (let k = 0; k < 12; k++) edges.setMatrixAt(b * 12 + k, tmp.multiplyMatrices(boxM, edgesLocal[k]));
          for (let k = 0; k < NB; k++) brackets.setMatrixAt(b * NB + k, tmp.multiplyMatrices(boxM, bracketLocal[k]));
          for (let k = 0; k < PLANES; k++) {
            const i = b * PLANES + k;
            faces.setMatrixAt(i, tmp.multiplyMatrices(boxM, facesLocal[k]));
            // data marks tick: variant is a hash of (n·TICKS + tick step),
            // which also satisfies content(n, t=1) == content(n+1, t=0).
            // phases kept inside 0.1..0.9 so no tick falls on the loop point
            const phase = 0.1 + 0.8 * hash2(k, 991);
            const step = Math.floor(t * TICKS + phase);
            variant[i] = Math.floor(hash2(n * TICKS + step, k * 7 + 3) * VARIANTS);
            fade[i] = k < 4 ? 1 : 0.3;
          }
        }
        proxies.instanceMatrix.needsUpdate = true;
        edges.instanceMatrix.needsUpdate = true;
        brackets.instanceMatrix.needsUpdate = true;
        faces.instanceMatrix.needsUpdate = true;
        variantAttr.needsUpdate = true;
        fadeAttr.needsUpdate = true;
        return {
          ...DEFAULT_POST,
          focusDist: camera.position.distanceTo(new THREE.Vector3(0, 1.3, 0)),
          aperture: 0.35,
          focusBand: 0.06,
          nearScale: 0.15,
          maxBlur: 0.009,
          bloomThreshold: 0.5,
          bloomStrength: p.glow,
          bloomWeights: [0.8, 0.45, 0.25, 0.12],
          vignette: 0.14,
          veil: { color: [0.08, 0.3, 0.6], amount: 0.06 },
        };
      },
      dispose: () => {
        fieldMat.dispose();
        faceMat.dispose();
        faceGeo.dispose();
        digits.dispose();
        glyphs.dispose();
        edgeMat.dispose();
        proxyMat.dispose();
      },
    };
  };
