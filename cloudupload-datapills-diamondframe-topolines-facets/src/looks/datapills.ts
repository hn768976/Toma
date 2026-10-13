import * as THREE from "three";
import { makeBackdrop } from "../common/backdrop";
import { LOOP, TAU } from "../common/constants";
import { MONO } from "../common/fonts";
import { FRAG_OUT } from "../common/glsl";
import { mulberry32, range } from "../common/random";
import type { World } from "../common/world";

/**
 * Look 2 - Data Pills. Glowing capsule "data blocks" at many depths, linked
 * by cubic-spline lines with travelling pulses, over a field of square
 * specks. Depth of field is computed per object in the shaders (each
 * capsule / line / speck knows its own depth), so additive glows blur
 * correctly. The layout is periodic along the camera's travel vector V and
 * the camera glides exactly one V per loop.
 */
export type DataPillsParams = {
  capsule: string;
  line: string;
  background: string;
  haze: string;
};

const HALF_LEN = 1.0;
const HALF_H = 0.25; // aspect 4:1
const V = new THREE.Vector3(12, -2.2, 0); // layout period == camera travel per loop
const PER_TILE = 11;
const COPIES = 2; // copies each side along V
const FOV = 38;
const FOCUS = 7; // view distance in focus
const FAR_K = 2.5; // 720p px of blur at infinity
const NEAR_K = 9.0; // 720p px per (focus/z - 1)
const MAX_BLUR = 60;

// ---------- layout (module level, seeded) ----------
const rng = mulberry32(0xda7a_9111);
type Cap = {
  base: THREE.Vector3;
  yaw: number;
  roll: number;
  pitch: number;
  ay: number;
  ar: number;
  ky: number;
  kr: number;
  py: number;
  pr: number;
  variant: number;
  bright: number;
};
const caps: Cap[] = [];
for (let i = 0; i < PER_TILE; i++) {
  const u = (i + rng() * 0.9) / PER_TILE;
  const z = -range(rng, 2.6, 15);
  const spread = 0.95 * -z * Math.tan(((FOV / 2) * Math.PI) / 180) + 0.4;
  const p = V.clone()
    .multiplyScalar(u)
    .add(new THREE.Vector3(0, range(rng, -spread, spread), z));
  caps.push({
    base: p,
    yaw: range(rng, -0.25, 0.25),
    roll: range(rng, -0.12, 0.12),
    pitch: range(rng, -0.15, 0.15),
    ay: (range(rng, 4, 10) * Math.PI) / 180,
    ar: (range(rng, 2, 6) * Math.PI) / 180,
    ky: 1 + Math.floor(rng() * 2),
    kr: 1 + Math.floor(rng() * 2),
    py: rng() * TAU,
    pr: rng() * TAU,
    variant: Math.floor(rng() * 8),
    bright: range(rng, 0.65, 1.15),
  });
}
// edges: each capsule -> 1-2 nearest neighbours to its right (periodic)
type Edge = { a: number; b: number; shift: number; k: number; phase: number };
const edges: Edge[] = [];
caps.forEach((c, i) => {
  const cands: { j: number; s: number; d: number }[] = [];
  caps.forEach((o, j) => {
    for (let s = 0; s <= 1; s++) {
      if (j === i && s === 0) continue;
      const op = o.base.clone().addScaledVector(V, s);
      const dx = op.x - c.base.x;
      if (dx < 0.8) continue;
      const d = op.distanceTo(c.base) + Math.abs(op.z - c.base.z) * 0.8;
      cands.push({ j, s, d });
    }
  });
  cands.sort((a, b) => a.d - b.d);
  const n = rng() < 0.45 ? 2 : 1;
  for (let k = 0; k < Math.min(n, cands.length); k++) {
    edges.push({ a: i, b: cands[k].j, shift: cands[k].s, k: 1 + Math.floor(rng() * 3), phase: rng() });
  }
});
// specks
const SPECKS = 600;
const specks = Array.from({ length: SPECKS }, () => {
  const u = rng();
  const z = -range(rng, 3.5, 20);
  const spread = 0.62 * -z * Math.tan(((FOV / 2) * Math.PI) / 180) + 1.5;
  return {
    p: V.clone().multiplyScalar(u).add(new THREE.Vector3(0, range(rng, -spread, spread), z)),
    size: range(rng, 0.07, 0.11),
    square: rng() < 0.7 ? 1 : 0,
    bright: rng() < 0.35 ? range(rng, 0.9, 1.4) : range(rng, 0.0, 0.05),
    tw: rng(),
  };
});

// ---------- capsule data atlas (canvas, 8 variants) ----------
const ATLAS_W = 1024;
const ROW_H = 256;
const makeAtlas = () => {
  const cv = document.createElement("canvas");
  cv.width = ATLAS_W;
  cv.height = ROW_H * 8;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, cv.width, cv.height);
  const r = mulberry32(0xa71a5);
  const hex = "0123456789ABCDEF";
  for (let v = 0; v < 8; v++) {
    const y0 = v * ROW_H;
    g.save();
    g.beginPath();
    g.rect(0, y0, ATLAS_W, ROW_H);
    g.clip();
    // left section: lighter tile with a padlock (generic glyph, not a logo)
    g.fillStyle = "rgba(255,255,255,0.22)";
    g.fillRect(70, y0 + 40, 150, 176);
    const lx = 145;
    const ly = y0 + 140;
    g.strokeStyle = "rgba(255,255,255,0.95)";
    g.lineWidth = 12;
    g.beginPath();
    g.arc(lx, ly - 26, 28, Math.PI, 0);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.fillRect(lx - 42, ly - 26, 84, 70);
    g.fillStyle = "#000";
    g.fillRect(lx - 6, ly - 4, 12, 26);
    // divider
    g.fillStyle = "rgba(255,255,255,0.95)";
    g.fillRect(238, y0 + 36, 7, 184);
    // columns of tiny binary text and bright bars
    g.font = `500 30px "${MONO}"`;
    g.textAlign = "center";
    let x = 275;
    while (x < ATLAS_W - 90) {
      const kind = r();
      if (kind < 0.7) {
        const a = 0.45 + r() * 0.55;
        g.fillStyle = `rgba(255,255,255,${a})`;
        for (let k = 0; k < 6; k++) g.fillText(r() < 0.5 ? "0" : "1", x, y0 + 64 + k * 30);
        x += 24;
      } else if (kind < 0.88) {
        g.fillStyle = `rgba(255,255,255,${0.75 + r() * 0.25})`;
        g.fillRect(x - 3, y0 + 40, 6, 176);
        x += 18;
      } else {
        g.fillStyle = "rgba(255,255,255,0.95)";
        g.fillRect(x - 3, y0 + 36, 7, 184);
        x += 30;
      }
    }
    // hex tag (tiny data text)
    g.font = `500 22px "${MONO}"`;
    g.fillStyle = "rgba(255,255,255,0.6)";
    let tag = "";
    for (let k = 0; k < 4; k++) tag += hex[Math.floor(r() * 16)];
    g.fillText(tag, ATLAS_W - 60, y0 + 228);
    g.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  return tex;
};

// ---------- shaders ----------
const DOF_GLSL = /* glsl */ `
uniform float pxScale, focalPx, focus, farK, nearK, maxBlur;
// blur radius in REAL pixels for an object at view distance z
float cocPx(float z) {
  float c = z > focus ? farK * (1.0 - focus / z) : nearK * (focus / z - 1.0);
  return min(c, maxBlur) * pxScale;
}
`;

const capVert = /* glsl */ `
${DOF_GLSL}
in vec3 iCenter;
in vec3 iAxisX;
in vec3 iAxisY;
in vec2 iMeta; // variant, brightness
out vec2 vLocal;
out float vBlurW;
out float vPxW;
out vec2 vMeta;
out float vMargin;
uniform float halfLen, halfH;
void main() {
  vec3 viewC = (viewMatrix * vec4(iCenter, 1.0)).xyz;
  float z = -viewC.z;
  float pxW = z / focalPx;                 // world size of one real pixel
  float blurW = cocPx(z) * pxW;            // blur radius in world units
  float margin = blurW * 2.2 + 0.06 + pxW * 3.0;
  vec2 ext = vec2(halfLen, halfH) + margin;
  vec2 lp = position.xy * ext;             // PlaneGeometry(2,2): position in [-1,1]
  vec3 wp = iCenter + iAxisX * lp.x + iAxisY * lp.y;
  vLocal = lp;
  vBlurW = blurW;
  vPxW = pxW;
  vMeta = iMeta;
  vMargin = margin;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const capFrag = /* glsl */ `
${FRAG_OUT}
uniform sampler2D atlas;
uniform vec3 color;
uniform float halfLen, halfH;
in vec2 vLocal;
in float vBlurW;
in float vPxW;
in vec2 vMeta;
in float vMargin;
float sdStadium(vec2 p, float hl, float r) {
  p.x = max(abs(p.x) - (hl - r), 0.0);
  return length(p) - r;
}
void main() {
  float b = vBlurW;
  float aa = vPxW;
  float d = sdStadium(vLocal, halfLen, halfH);
  // outline: thin line (world) convolved with blur ~ gaussian of sigma s
  float t = 0.012;
  float s = sqrt(t * t + b * b * 0.35 + aa * aa * 0.3);
  float outline = (t / s) * exp(-0.5 * d * d / (s * s));
  float halo = exp(-max(d, 0.0) / (0.02 + b)) * 0.06 * (0.04 / (0.04 + b));
  // faint glass fill
  float inside = 1.0 - smoothstep(-b - aa, b + aa, d);
  float fill = inside * 0.13;
  // inner data texture (mip-blurred by the same blur radius)
  float inset = 0.035;
  vec2 uvIn = vec2((vLocal.x / (halfLen - inset)) * 0.5 + 0.5, (vLocal.y / (halfH - inset)) * 0.5 + 0.5);
  float innerMask = (1.0 - smoothstep(-inset - b - aa, -inset + b + aa, d));
  float texPerW = ${ATLAS_W.toFixed(1)} / (2.0 * (halfLen - inset));
  float lod = log2(max((b * 1.5 + aa) * texPerW, 1.0));
  vec2 auv = vec2(clamp(uvIn.x, 0.0, 1.0), (vMeta.x + clamp(uvIn.y, 0.02, 0.98)) / 8.0);
  float data = textureLod(atlas, auv, lod).r * innerMask * 1.0;
  // connector dots at both ends
  vec2 e1 = vLocal - vec2(halfLen, 0.0);
  vec2 e2 = vLocal + vec2(halfLen, 0.0);
  float rs = 0.028 + b;
  float dots = (exp(-dot(e1, e1) / (rs * rs)) + exp(-dot(e2, e2) / (rs * rs))) * (0.028 * 0.028) / (rs * rs) * 1.3;
  float energy = (outline * 1.6 + halo + fill + dots) * vMeta.y;
  // data marks read near-white, like the reference
  gl_FragColor = vec4(color * energy + mix(color, vec3(1.0), 0.55) * data * vMeta.y, 1.0);
}
`;

const lineVert = /* glsl */ `
${DOF_GLSL}
in vec3 nextPos;
in float side;
in float arc;
in float sParam;
in vec3 edgeMeta; // k, phase, brightness
out float vAcross;    // -1..1 across the ribbon
out float vHalfPx;    // ribbon half width in real px
out float vCorePx;
out float vArc;
out float vS;
out vec3 vEdge;
out float vBlurPx;
uniform vec2 res;
void main() {
  vec4 c0 = projectionMatrix * viewMatrix * vec4(position, 1.0);
  vec4 c1 = projectionMatrix * viewMatrix * vec4(nextPos, 1.0);
  vec2 s0 = c0.xy / c0.w * 0.5 * res;
  vec2 s1 = c1.xy / c1.w * 0.5 * res;
  vec2 dir = s1 - s0;
  float L = length(dir);
  dir = L > 1e-5 ? dir / L : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float z = c0.w;
  float blur = cocPx(z);
  float core = 0.55 * pxScale;
  float halfPx = core + blur * 2.0 + 2.5 * pxScale;
  vec2 off = nrm * side * halfPx;
  c0.xy += off / (0.5 * res) * c0.w;
  gl_Position = c0;
  vAcross = side;
  vHalfPx = halfPx;
  vCorePx = core;
  vBlurPx = blur;
  vArc = arc;
  vS = sParam;
  vEdge = edgeMeta;
}
`;

const lineFrag = /* glsl */ `
${FRAG_OUT}
uniform vec3 color;
uniform vec3 pulseColor;
uniform float tf;
uniform float pxScale;
in float vAcross;
in float vHalfPx;
in float vCorePx;
in float vArc;
in float vS;
in vec3 vEdge;
in float vBlurPx;
void main() {
  float dpx = abs(vAcross) * vHalfPx;
  float s = sqrt(vCorePx * vCorePx + vBlurPx * vBlurPx * 0.35 + 0.25 * pxScale * pxScale);
  float prof = (vCorePx / s) * exp(-0.5 * dpx * dpx / (s * s));
  // fine dotted texture + bigger node beads along the line
  float beads = smoothstep(0.35, 0.0, abs(fract(vArc / 0.07) - 0.5)) * 0.45 + 0.55;
  float node = exp(-pow((fract(vArc / 0.35 + vEdge.y) - 0.5) * 0.35 / 0.018, 2.0));
  float nodeProf = exp(-0.5 * dpx * dpx / ((s + 1.6 * pxScale) * (s + 1.6 * pxScale))) * (vCorePx + 1.6 * pxScale) / (s + 1.6 * pxScale);
  // pulse travelling along s (k whole cycles per loop)
  float ph = fract(vEdge.y - tf * vEdge.x);
  float dp = vS - ph;
  dp -= floor(dp + 0.5);
  float pulse = exp(-dp * dp / 0.00025);
  vec3 col = color * (prof * beads * 0.85 + node * nodeProf * 0.9) * vEdge.z
           + pulseColor * pulse * (prof * 2.2 + nodeProf * 0.6) * vEdge.z;
  gl_FragColor = vec4(col, 1.0);
}
`;

const speckVert = /* glsl */ `
${DOF_GLSL}
in vec3 iPos;
in vec4 iMeta; // size, square, bright, twinkle phase
out vec2 vLocal;
out float vSize;
out float vBlurW;
out float vPxW;
out vec4 vMeta;
uniform vec3 camRight;
uniform vec3 camUp;
void main() {
  vec3 viewC = (viewMatrix * vec4(iPos, 1.0)).xyz;
  float z = -viewC.z;
  float pxW = z / focalPx;
  float blurW = cocPx(z) * pxW;
  float ext = iMeta.x + blurW * 2.0 + pxW * 2.0;
  vec3 wp = iPos + (camRight * position.x + camUp * position.y) * ext;
  vLocal = position.xy * ext;
  vSize = iMeta.x;
  vBlurW = blurW;
  vPxW = pxW;
  vMeta = iMeta;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const speckFrag = /* glsl */ `
${FRAG_OUT}
uniform vec3 color;
uniform float tf;
in vec2 vLocal;
in float vSize;
in float vBlurW;
in float vPxW;
in vec4 vMeta;
void main() {
  float hs = vSize * 0.5;
  // square or round speck, blurred by the object's own CoC
  vec2 q = abs(vLocal) - hs;
  float dsq = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  float dci = length(vLocal) - hs;
  float d = mix(dci, dsq, vMeta.y);
  float soft = vBlurW + vPxW * 0.7;
  float cover = 1.0 - smoothstep(-soft, soft, d);
  float area = (hs * hs) / ((hs + vBlurW) * (hs + vBlurW));
  float tw = 0.75 + 0.25 * sin(6.28318530718 * (tf * 2.0 + vMeta.w));
  float e = cover * mix(1.0, area, 0.85) * vMeta.z * tw * 2.2;
  gl_FragColor = vec4(color * e, 1.0);
}
`;

// ---------- world ----------
const capsuleBasis = (c: Cap, f: number) => {
  const yaw = c.yaw + c.ay * Math.sin(TAU * c.ky * f + c.py);
  const roll = c.roll + c.ar * Math.sin(TAU * c.kr * f + c.pr);
  const e = new THREE.Euler(c.pitch, yaw, roll, "YXZ");
  const q = new THREE.Quaternion().setFromEuler(e);
  return {
    x: new THREE.Vector3(1, 0, 0).applyQuaternion(q),
    y: new THREE.Vector3(0, 1, 0).applyQuaternion(q),
  };
};

const SEG = 48;

export const makeDataPills =
  (params: DataPillsParams) =>
  (): World => {
    const scene = new THREE.Scene();
    scene.add(
      makeBackdrop(params.background, [
        { x: -0.03, y: 0.6, rx: 0.12, ry: 0.22, color: params.haze, strength: 0.9 },
        { x: 0.35, y: 0.55, rx: 0.8, ry: 0.75, color: params.haze, strength: 0.12 },
      ]),
    );
    const capColor = new THREE.Color(params.capsule);
    const lineColor = new THREE.Color(params.line);
    const dofUniforms = {
      pxScale: { value: 1 },
      focalPx: { value: 1 },
      focus: { value: FOCUS },
      farK: { value: FAR_K },
      nearK: { value: NEAR_K },
      maxBlur: { value: MAX_BLUR },
    };
    const atlas = makeAtlas();

    // capsules
    const nCap = caps.length * (2 * COPIES + 1);
    const capGeo = new THREE.InstancedBufferGeometry();
    const plane = new THREE.PlaneGeometry(2, 2);
    capGeo.index = plane.index;
    capGeo.setAttribute("position", plane.getAttribute("position"));
    const iCenter = new THREE.InstancedBufferAttribute(new Float32Array(nCap * 3), 3);
    const iAxisX = new THREE.InstancedBufferAttribute(new Float32Array(nCap * 3), 3);
    const iAxisY = new THREE.InstancedBufferAttribute(new Float32Array(nCap * 3), 3);
    const iMeta = new THREE.InstancedBufferAttribute(new Float32Array(nCap * 2), 2);
    capGeo.setAttribute("iCenter", iCenter);
    capGeo.setAttribute("iAxisX", iAxisX);
    capGeo.setAttribute("iAxisY", iAxisY);
    capGeo.setAttribute("iMeta", iMeta);
    capGeo.instanceCount = nCap;
    const capMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: capVert,
      fragmentShader: capFrag,
      uniforms: {
        ...dofUniforms,
        atlas: { value: atlas },
        color: { value: capColor },
        halfLen: { value: HALF_LEN },
        halfH: { value: HALF_H },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const capMesh = new THREE.Mesh(capGeo, capMat);
    capMesh.frustumCulled = false;
    scene.add(capMesh);

    // lines (ribbons rebuilt on the CPU each frame from the capsule poses)
    const nEdge = edges.length * (2 * COPIES + 1);
    const vPerEdge = (SEG + 1) * 2;
    const lPos = new Float32Array(nEdge * vPerEdge * 3);
    const lNext = new Float32Array(nEdge * vPerEdge * 3);
    const lSide = new Float32Array(nEdge * vPerEdge);
    const lArc = new Float32Array(nEdge * vPerEdge);
    const lS = new Float32Array(nEdge * vPerEdge);
    const lMeta = new Float32Array(nEdge * vPerEdge * 3);
    const idx: number[] = [];
    for (let e = 0; e < nEdge; e++) {
      for (let k = 0; k < SEG; k++) {
        const a = e * vPerEdge + k * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const lineGeo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(lPos, 3);
    const nextAttr = new THREE.BufferAttribute(lNext, 3);
    const arcAttr = new THREE.BufferAttribute(lArc, 1);
    lineGeo.setAttribute("position", posAttr);
    lineGeo.setAttribute("nextPos", nextAttr);
    lineGeo.setAttribute("side", new THREE.BufferAttribute(lSide, 1));
    lineGeo.setAttribute("arc", arcAttr);
    lineGeo.setAttribute("sParam", new THREE.BufferAttribute(lS, 1));
    lineGeo.setAttribute("edgeMeta", new THREE.BufferAttribute(lMeta, 3));
    lineGeo.setIndex(idx);
    const lineUniforms = {
      ...dofUniforms,
      color: { value: lineColor.clone().lerp(capColor, 0.35).multiplyScalar(0.95) },
      pulseColor: { value: capColor.clone().multiplyScalar(1.6) },
      tf: { value: 0 },
      res: { value: new THREE.Vector2(1280, 720) },
    };
    const lineMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: lineVert,
      fragmentShader: lineFrag,
      uniforms: lineUniforms,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const lineMesh = new THREE.Mesh(lineGeo, lineMat);
    lineMesh.frustumCulled = false;
    scene.add(lineMesh);
    // static per-vertex data
    {
      let v = 0;
      for (let c = -COPIES; c <= COPIES; c++) {
        edges.forEach((e, ei) => {
          const bright = 0.6 + 0.4 * mulberry32(ei * 7 + 3)();
          for (let k = 0; k <= SEG; k++) {
            for (const sd of [-1, 1]) {
              lSide[v] = sd;
              lS[v] = k / SEG;
              lMeta[v * 3] = e.k;
              lMeta[v * 3 + 1] = e.phase;
              lMeta[v * 3 + 2] = bright;
              v++;
            }
          }
        });
      }
    }

    // specks
    const nSp = specks.length * (2 * COPIES + 1);
    const spGeo = new THREE.InstancedBufferGeometry();
    spGeo.index = plane.index;
    spGeo.setAttribute("position", plane.getAttribute("position"));
    const spPos = new Float32Array(nSp * 3);
    const spMeta = new Float32Array(nSp * 4);
    {
      let n = 0;
      for (let c = -COPIES; c <= COPIES; c++) {
        specks.forEach((s) => {
          const p = s.p.clone().addScaledVector(V, c);
          spPos.set([p.x, p.y, p.z], n * 3);
          spMeta.set([s.size, s.square, s.bright, s.tw], n * 4);
          n++;
        });
      }
    }
    spGeo.setAttribute("iPos", new THREE.InstancedBufferAttribute(spPos, 3));
    spGeo.setAttribute("iMeta", new THREE.InstancedBufferAttribute(spMeta, 4));
    spGeo.instanceCount = nSp;
    const spUniforms = {
      ...dofUniforms,
      color: { value: lineColor.clone().lerp(capColor, 0.4).multiplyScalar(1.3) },
      tf: { value: 0 },
      camRight: { value: new THREE.Vector3(1, 0, 0) },
      camUp: { value: new THREE.Vector3(0, 1, 0) },
    };
    const spMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: speckVert,
      fragmentShader: speckFrag,
      uniforms: spUniforms,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const spMesh = new THREE.Mesh(spGeo, spMat);
    spMesh.frustumCulled = false;
    spMesh.renderOrder = -1;
    scene.add(spMesh);

    const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 200);
    const tmpA = new THREE.Vector3();
    const tmpB = new THREE.Vector3();
    const p0 = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    const p3 = new THREE.Vector3();
    const bez = (t: number, out: THREE.Vector3) => {
      const it = 1 - t;
      return out
        .copy(p0)
        .multiplyScalar(it * it * it)
        .addScaledVector(p1, 3 * it * it * t)
        .addScaledVector(p2, 3 * it * t * t)
        .addScaledVector(p3, t * t * t);
    };

    return {
      scene,
      overlay: null,
      camera,
      post: {
        dof: null,
        bloom: { strength: 0.55, threshold: 0.35, knee: 0.3, weights: [1, 0.9, 0.75, 0.55, 0.35, 0.2] },
        exposure: 1.0,
        aces: true,
        grain: 0.015,
        grainLumaFade: 0,
        msaa: 4,
      },
      update(t, pxScale) {
        const f = t / LOOP;
        // camera: exactly one layout period V per loop
        const cp = new THREE.Vector3(0, 0.4, 0).addScaledVector(V, f);
        camera.position.copy(cp);
        camera.rotation.set(0.12, -0.18, -0.06, "YXZ");
        camera.updateMatrixWorld();
        const focalPx = (720 * pxScale) / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
        dofUniforms.pxScale.value = pxScale;
        dofUniforms.focalPx.value = focalPx;
        lineUniforms.tf.value = f;
        lineUniforms.res.value.set(1280 * pxScale, 720 * pxScale);
        spUniforms.tf.value = f;
        spUniforms.camRight.value.setFromMatrixColumn(camera.matrixWorld, 0);
        spUniforms.camUp.value.setFromMatrixColumn(camera.matrixWorld, 1);

        // capsule poses
        const bases = caps.map((c) => capsuleBasis(c, f));
        let n = 0;
        for (let c = -COPIES; c <= COPIES; c++) {
          caps.forEach((cap, i) => {
            const p = tmpA.copy(cap.base).addScaledVector(V, c);
            iCenter.setXYZ(n, p.x, p.y, p.z);
            iAxisX.setXYZ(n, bases[i].x.x, bases[i].x.y, bases[i].x.z);
            iAxisY.setXYZ(n, bases[i].y.x, bases[i].y.y, bases[i].y.z);
            iMeta.setXY(n, cap.variant, cap.bright);
            n++;
          });
        }
        iCenter.needsUpdate = iAxisX.needsUpdate = iAxisY.needsUpdate = iMeta.needsUpdate = true;

        // ribbons: from A's right end to B's left end
        let v = 0;
        for (let c = -COPIES; c <= COPIES; c++) {
          edges.forEach((e) => {
            const A = caps[e.a];
            const B = caps[e.b];
            const ba = bases[e.a];
            const bb = bases[e.b];
            p0.copy(A.base).addScaledVector(V, c).addScaledVector(ba.x, HALF_LEN + 0.02);
            p3.copy(B.base).addScaledVector(V, c + e.shift).addScaledVector(bb.x, -HALF_LEN - 0.02);
            const span = p0.distanceTo(p3);
            p1.copy(p0).addScaledVector(ba.x, span * 0.45);
            p2.copy(p3).addScaledVector(bb.x, -span * 0.45);
            let arc = 0;
            bez(0, tmpB);
            for (let k = 0; k <= SEG; k++) {
              const tt = k / SEG;
              bez(tt, tmpA);
              if (k > 0) arc += tmpA.distanceTo(tmpB);
              tmpB.copy(tmpA);
              for (let sd = 0; sd < 2; sd++) {
                lPos[(v + sd) * 3] = tmpA.x;
                lPos[(v + sd) * 3 + 1] = tmpA.y;
                lPos[(v + sd) * 3 + 2] = tmpA.z;
                lArc[v + sd] = arc;
              }
              v += 2;
            }
          });
        }
        // next-point attribute (forward difference; last point mirrors)
        for (let e = 0; e < nEdge; e++) {
          for (let k = 0; k <= SEG; k++) {
            const i0 = e * vPerEdge + k * 2;
            const kn = k < SEG ? k + 1 : k - 1;
            const i1 = e * vPerEdge + kn * 2;
            const sign = k < SEG ? 1 : -1;
            for (let sd = 0; sd < 2; sd++) {
              for (let a = 0; a < 3; a++) {
                const cur = lPos[i0 * 3 + a];
                const nx = lPos[i1 * 3 + a];
                lNext[(i0 + sd) * 3 + a] = sign > 0 ? nx : 2 * cur - nx;
              }
            }
          }
        }
        posAttr.needsUpdate = nextAttr.needsUpdate = arcAttr.needsUpdate = true;
      },
    };
  };
