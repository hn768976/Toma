import * as THREE from "three";
import { defaultPost } from "../lib/post";
import { TAU } from "../lib/random";
import { ThreeLook } from "../lib/ThreeStage";

// Look 3 — Neon Waves. ~14 satin wave sheets stacked diagonally; each crest
// carries a thin neon line. Sheet shape is a sum of whole-cycle travelling
// sines (closed over 600 frames), evaluated in the vertex shader.

export type NeonWavesProps = {
  neon: [string, string, string];
  base: string;
  lightL: string;
  lightR: string;
};

const LOOP = 600;
const SHEETS = 24;
const SEG_U = 360;
const SEG_V = 28;
const X0 = -9,
  X1 = 9;
const WIDTH = 2.0;

const SHEET_FN = /* glsl */ `
uniform float uT;
const float TAU = 6.2831853;
vec3 crest(float i, float x) {
  float ph = i * 0.42;
  float y = (i - 9.5) * 0.42
    + (0.16 + 0.1 * sin(i * 1.7)) * sin(0.52 * x + ph - TAU * uT)
    + (0.06 + 0.06 * cos(i * 2.3)) * sin(1.07 * x + 1.9 * ph + TAU * 2.0 * uT)
    + 0.06 * sin(2.3 * x + 0.6 * ph - TAU * 3.0 * uT);
  float z = -(i - 9.5) * 0.45 + 0.42 * sin(0.41 * x + 1.3 * ph + TAU * uT);
  return vec3(x, y, z);
}
vec3 sheetPos(float i, float x, float v) {
  vec3 c = crest(i, x);
  // sheet falls away from its crest: down and back, curling slightly
  float w = v * ${WIDTH.toFixed(3)};
  vec3 d = normalize(vec3(0.0, -1.0, -0.32 + 0.12 * sin(0.47 * x + i * 0.2 + TAU * uT)));
  return c + d * w + vec3(0.0, 0.0, -0.04 * w * w);
}
`;

const SHEET_VERT = /* glsl */ `
attribute vec3 aSheet; // u (0..1 along), v (0..1 across), sheet index
${SHEET_FN}
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vT;
varying float vV;
varying float vSheet;
void main() {
  float x = mix(${X0.toFixed(1)}, ${X1.toFixed(1)}, aSheet.x);
  float v = aSheet.y;
  float i = aSheet.z;
  vec3 p = sheetPos(i, x, v);
  vec3 px = sheetPos(i, x + 0.01, v) - p;
  vec3 pv = sheetPos(i, x, v + 0.01) - p;
  vec3 n = normalize(cross(px, pv));
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vN = normalize(mat3(modelMatrix) * n);
  vT = normalize(mat3(modelMatrix) * px);
  vV = v;
  vSheet = i;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const SHEET_FRAG = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uLightL;
uniform vec3 uLightR;
uniform vec3 uNeon0;
uniform vec3 uNeon1;
uniform vec3 uNeon2;
uniform vec3 uCamPos;
uniform float uSpill;
uniform vec2 uRes;
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vT;
varying float vV;
varying float vSheet;
vec3 neonColor(float i) {
  float k = mod(floor(i + 0.5), 3.0);
  return k < 0.5 ? uNeon0 : (k < 1.5 ? uNeon1 : uNeon2);
}
float satin(vec3 T, vec3 H, float e) {
  float th = dot(T, H);
  return pow(max(0.0, sqrt(max(0.0, 1.0 - th * th))), e);
}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uCamPos - vWorld);
  if (dot(N, V) < 0.0) N = -N;
  vec3 T = normalize(vT);
  vec3 L1 = normalize(vec3(-1.0, 0.45, 0.75));
  vec3 L2 = normalize(vec3(1.0, -0.2, 0.7));
  vec3 L3 = normalize(vec3(0.0, 1.0, 0.4));
  // coloured wash across the frame (magenta left, cyan right)
  float sx = smoothstep(0.2, 0.8, gl_FragCoord.x / uRes.x + 0.15 * (gl_FragCoord.y / uRes.y - 0.5));
  float d1 = pow(dot(N, L1) * 0.5 + 0.5, 1.6);
  float d2 = pow(dot(N, L2) * 0.5 + 0.5, 1.6);
  float d3 = (dot(N, L3) * 0.5 + 0.5);
  vec3 col = uBase * (
      uLightL * d1 * d1 * mix(1.7, 0.1, sx)
    + uLightR * d2 * d2 * mix(0.1, 2.6, sx)
    + vec3(0.3, 0.28, 0.42) * d3);
  // satin anisotropic sheen along the sheet
  vec3 H1 = normalize(L1 + V), H2 = normalize(L2 + V);
  col += uLightL * satin(T, H1, 140.0) * 0.8 * mix(1.0, 0.15, sx);
  col += uLightR * satin(T, H2, 140.0) * 0.8 * mix(0.15, 1.0, sx);
  // broad gloss reflection of the coloured wash
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += mix(uLightL, uLightR, sx) * fr * 0.5;
  // the crest's own neon spills onto the face just below it
  vec3 nc = neonColor(vSheet) * uSpill;
  col += nc * mix(vec3(1.0), mix(uLightL, uLightR, sx), 0.5) * (exp(-vV / 0.035) * 0.45 + exp(-vV / 0.15) * 0.08);
  // darker deep in the folds (far down the sheet, where the next sheet sits)
  col *= mix(1.0, 0.6, smoothstep(0.1, 0.45, vV));
  // thin dark crease right under each crest (where the ribbon folds away)
  col *= 1.0 - 0.45 * smoothstep(0.012, 0.025, vV) * (1.0 - smoothstep(0.035, 0.07, vV));
  gl_FragColor = vec4(col, 1.0);
}`;

const LINE_VERT = /* glsl */ `
attribute vec3 aLine; // u, side, sheet
uniform vec2 uRes;
${SHEET_FN}
varying vec3 vColor;
varying float vDist;
varying float vHalf;
varying float vFade;
uniform vec3 uNeon0;
uniform vec3 uNeon1;
uniform vec3 uNeon2;
uniform float uLineW;
void main() {
  float x = mix(${X0.toFixed(1)}, ${X1.toFixed(1)}, aLine.x);
  float i = aLine.z;
  vec3 p0 = sheetPos(i, x, 0.0);
  vec3 p1 = sheetPos(i, x + 0.02, 0.0);
  vec4 c0 = projectionMatrix * modelViewMatrix * vec4(p0, 1.0);
  vec4 c1 = projectionMatrix * modelViewMatrix * vec4(p1, 1.0);
  vec2 s0 = c0.xy / c0.w * 0.5 * uRes, s1 = c1.xy / c1.w * 0.5 * uRes;
  vec2 d = normalize(s1 - s0 + 1e-6);
  vec2 n = vec2(-d.y, d.x);
  float hw = uLineW * uRes.y / 720.0;
  float wq = hw + 1.0;
  c0.xy += n * aLine.y * wq / (0.5 * uRes) * c0.w;
  // pull slightly towards the camera so the line sits on the crest edge
  c0.z -= 0.0005 * c0.w;
  gl_Position = c0;
  vDist = aLine.y * wq;
  vHalf = hw;
  // some lines fade out along part of their length (irregular, as if hidden)
  float gate = sin(0.33 * x + i * 2.1 + TAU * uT) + 0.6 * sin(0.71 * x - i * 1.3);
  vFade = smoothstep(-0.9, -0.2, gate);
  float k = mod(floor(i + 0.5), 3.0);
  vColor = k < 0.5 ? uNeon0 : (k < 1.5 ? uNeon1 : uNeon2);
}`;

const LINE_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vDist;
varying float vHalf;
varying float vFade;
void main() {
  float a = abs(vDist);
  float core = clamp(vHalf + 0.5 - a, 0.0, 1.0);
  float halo = exp(-a * a / (vHalf * vHalf * 3.0 + 0.6));
  vec3 c = (vColor * (core * 1.0 + halo * 0.5) + vec3(1.0) * core * 1.2) * vFade;
  gl_FragColor = vec4(c, 1.0);
}`;

export const createNeonWaves =
  (props: NeonWavesProps) =>
  (): ThreeLook => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#2A1A5A");
    const camera = new THREE.PerspectiveCamera(22, 16 / 9, 0.1, 100);
    const group = new THREE.Group();
    group.rotation.z = -0.5;
    scene.add(group);

    const lin = (h: string, k = 1) => new THREE.Color(h).multiplyScalar(k);
    const neonGain = 5.0;
    const uniforms = {
      uT: { value: 0 },
      uBase: { value: lin(props.base) },
      uLightL: { value: lin(props.lightL, 0.75) },
      uLightR: { value: lin(props.lightR, 0.75) },
      uNeon0: { value: lin(props.neon[0], neonGain) },
      uNeon1: { value: lin(props.neon[1], neonGain * 0.8) },
      uNeon2: { value: lin(props.neon[2], neonGain) },
      uCamPos: { value: new THREE.Vector3() },
      uRes: { value: new THREE.Vector2(1280, 720) },
      uLineW: { value: 0.55 },
      uSpill: { value: 1 / neonGain },
    };

    // sheets: one grid per sheet, index carried in an attribute
    const verts: number[] = [];
    const idx: number[] = [];
    for (let s = 0; s < SHEETS; s++) {
      const base = verts.length / 3;
      for (let j = 0; j <= SEG_V; j++)
        for (let i = 0; i <= SEG_U; i++) verts.push(i / SEG_U, j / SEG_V, s);
      for (let j = 0; j < SEG_V; j++)
        for (let i = 0; i < SEG_U; i++) {
          const a = base + j * (SEG_U + 1) + i;
          const b = a + 1,
            c = a + SEG_U + 1,
            d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
    }
    const sheetGeo = new THREE.BufferGeometry();
    sheetGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(verts.length), 3));
    sheetGeo.setAttribute("aSheet", new THREE.Float32BufferAttribute(verts, 3));
    sheetGeo.setIndex(idx);
    const sheetMat = new THREE.ShaderMaterial({
      vertexShader: SHEET_VERT,
      fragmentShader: SHEET_FRAG,
      uniforms,
      side: THREE.DoubleSide,
    });
    const sheets = new THREE.Mesh(sheetGeo, sheetMat);
    sheets.frustumCulled = false;
    group.add(sheets);

    // neon crest ribbons
    const lv: number[] = [];
    const li: number[] = [];
    const LSEG = 720;
    for (let s = 0; s < SHEETS; s++) {
      const base = lv.length / 3;
      for (let i = 0; i <= LSEG; i++) {
        lv.push(i / LSEG, -1, s, i / LSEG, 1, s);
        if (i < LSEG) {
          const a = base + i * 2;
          li.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(lv.length), 3));
    lineGeo.setAttribute("aLine", new THREE.Float32BufferAttribute(lv, 3));
    lineGeo.setIndex(li);
    const lineMat = new THREE.ShaderMaterial({
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      uniforms,
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lines = new THREE.Mesh(lineGeo, lineMat);
    lines.frustumCulled = false;
    lines.renderOrder = 2;
    group.add(lines);

    const post = defaultPost();
    post.tonemap = 1;
    post.exposure = 1.1;
    post.saturation = 1.2;
    post.vignette = 0.18;
    post.bloom = { strength: 0.55, threshold: 1.4, knee: 0.6, radius: 0.8 };
    post.dof = { focus: 9.6, aperture: 0.09, maxCoc: 0.045 };

    return {
      scene,
      camera,
      post,
      msaa: 4,
      update(frame, size) {
        const t = (((frame % LOOP) + LOOP) % LOOP) / LOOP;
        camera.aspect = size.w / size.h;
        uniforms.uT.value = t;
        uniforms.uRes.value.set(size.w, size.h);
        // close camera, slow closed drift
        camera.position.set(
          0.45 * Math.sin(TAU * t),
          0.25 * Math.sin(TAU * t + 1.2),
          9.8 + 0.4 * Math.cos(TAU * t),
        );
        camera.lookAt(0.25 * Math.sin(TAU * t + 0.4), 0.1 * Math.cos(TAU * t), 0);
        camera.updateMatrixWorld();
        uniforms.uCamPos.value.copy(camera.position);
        // focus drifts through the stack: whole cycles per loop
        post.dof!.focus = 9.6 + 1.4 * Math.sin(TAU * t) + 0.5 * Math.sin(TAU * 2 * t + 0.8);
      },
    };
  };
