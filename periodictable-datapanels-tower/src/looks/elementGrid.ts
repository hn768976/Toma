import * as THREE from "three";
import { buildAtlas } from "../lib/atlas";
import { ELEMENTS } from "../lib/elements";
import { DEFAULT_POST } from "../lib/pipeline";
import type { LookFactory } from "../lib/Stage";

export type GridParams = {
  paper: string; // tile face
  line: string; // tile outlines
  text: string; // symbols
  dot: string; // blinking dots
  streak: string; // light streaks
  streakStrength: number;
};

// Close, low view across a pale periodic table. The camera slides exactly
// one tile width per loop. For frame 600 to equal frame 0 the labels must
// move one cell per loop as well: a soft horizontal scanning light crosses
// the rows once per loop, and each row's labels shift by one cell at the
// moment the band washes that row out. Every row always reads in the right
// order. The dot pattern travels with the camera's one-cell shift, so every
// value is continuous across the loop point.

const ASPECT = 1.12; // tile pitch z / x
const LAYOUT_COLS = 18;
const LAYOUT_ROWS = 10;
const DOT_WIDTH = 0.46; // share of the loop a dot is visible on its tile
// the scanning band travels from SCAN_A to SCAN_B (world z) once per loop;
// both ends are outside the visible rows
const SCAN_A = -7.0;
const SCAN_B = 9.5;

const VERT = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D atlas;
uniform sampler2D rects;
uniform sampler2D layout_; // 18×10, element Z per cell (0 = blank)
uniform vec3 paper, lineCol, textCol, dotCol, streakCol;
uniform float t; // loop phase 0..1 (frame mod length / length)
uniform float camX; // camera x (world)
uniform float streakAmt;
uniform float aspect;
uniform float dotWidth;
uniform vec2 scan; // band start/end z
varying vec3 vW;
uint h32(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v.x ^ v.y ^ v.z;
}
float r01(int a, int b, uint salt) { return float(h32(uvec3(uint(a + 65536), uint(b + 65536), salt))) / 4294967295.0; }
int labelAt(int c, int r) {
  if (c < 0 || c >= ${LAYOUT_COLS} || r < 0 || r >= ${LAYOUT_ROWS}) return 0;
  return int(texelFetch(layout_, ivec2(c, r), 0).r + 0.5);
}
// Dot bump m of row r is centred at slot coordinate m + beta(m, r). A cell's
// slot coordinate is c - t, so the pattern is a function of (c - t) only.
float beta(int m, int r) { return 0.06 + 0.88 * r01(m, r, 17u); }
float bump(float d) { float x = clamp(abs(d) / (dotWidth * 0.5), 0.0, 1.0); return 1.0 - x * x * (3.0 - 2.0 * x); }
void main() {
  vec2 p = vec2(vW.x + 0.5, (vW.z + 0.5 * aspect) / aspect); // cell units
  vec2 cellF = floor(p);
  vec2 f = fract(p);
  int c = int(cellF.x);
  int r = int(cellF.y);

  // dot intensity on this cell: bumps m = c-2 .. c+1 of the travelling
  // pattern (a function of c - t only, so it is continuous across the loop)
  float I = 0.0;
  float rad = 0.2;
  for (int k = -2; k <= 1; k++) {
    int m = c + k;
    float bk = bump((float(c) - t) - (float(m) + beta(m, r)));
    if (bk > I) { I = bk; rad = 0.2 + 0.14 * r01(m, r, 29u); }
  }

  // row label shift, hidden under the scanning band
  float zb = mix(scan.x, scan.y, t);
  float rowZ = float(r) * aspect;
  int hop = zb >= rowZ ? 1 : 0;
  int z = labelAt(c - hop, r);
  float dzRows = abs(vW.z - zb) / aspect;

  vec3 col = paper;
  // thin outlines (anti-aliased in screen space)
  vec2 fw = fwidth(p);
  vec2 e = min(f, 1.0 - f);
  float ol = max(1.0 - smoothstep(0.0, fw.x * 1.2, e.x - 0.006), 1.0 - smoothstep(0.0, fw.y * 1.2, e.y - 0.006 / aspect));
  col = mix(col, lineCol, ol);

  float textA = (1.0 - smoothstep(0.08, 0.55, I)) * smoothstep(0.55, 1.1, abs(rowZ - zb) / aspect);
  if (z > 0) {
    vec4 rc = texelFetch(rects, ivec2(z - 1, 0), 0);
    vec2 auv = mix(rc.xy, rc.zw, vec2(f.x, 1.0 - f.y));
    // gradients from the continuous coordinate: no mip seams at cell edges
    vec2 scale = rc.zw - rc.xy;
    vec2 gx = dFdx(p) * vec2(scale.x, -scale.y);
    vec2 gy = dFdy(p) * vec2(scale.x, -scale.y);
    float m = textureGrad(atlas, auv, gx, gy).r;
    col = mix(col, textCol, m * textA);
  }

  // dark dot
  vec2 q = (f - 0.5) * vec2(1.0, aspect);
  float dd = length(q);
  float aa = max(fw.x, fw.y) * 1.5;
  float rr = rad * (0.55 + 0.45 * smoothstep(0.0, 0.6, I));
  float disc = 1.0 - smoothstep(rr - aa, rr + aa, dd);
  col = mix(col, dotCol, disc * smoothstep(0.0, 0.5, I));

  // soft light streaks: vertical bands travel with the camera's one-tile
  // shift plus whole periods; horizontal bands move by whole periods.
  float s = 0.0;
  const float P = 26.0;
  for (int k = 0; k < 4; k++) {
    float x0 = r01(k, 3, 41u) * P;
    float n = 1.0 + float(k % 2);
    float bx = camX + mod(x0 + n * P * t, P) - P * 0.5;
    float w = 0.7 + 1.1 * r01(k, 4, 43u);
    float dx = vW.x - bx;
    s += exp(-dx * dx / (w * w)) * (0.55 + 0.45 * r01(k, 5, 47u));
  }
  for (int k = 0; k < 4; k++) {
    float z0 = r01(k, 6, 53u) * P;
    float n = 1.0 + float(k % 2);
    float bz = mod(z0 - n * P * t, P) - P * 0.8;
    float w = 0.7 + 1.1 * r01(k, 7, 59u);
    float dz = vW.z - bz;
    s += exp(-dz * dz / (w * w)) * (0.55 + 0.45 * r01(k, 8, 61u));
  }
  // the scanning band itself: a strong, soft light washing out the rows
  s += exp(-dzRows * dzRows / 0.45) * 1.2;
  col = mix(col, streakCol, clamp(s, 0.0, 1.0) * streakAmt);
  gl_FragColor = vec4(col, 1.0);
}
`;

export const elementGrid =
  (p: GridParams, frames: number): LookFactory =>
  ({ gl, aspect }) => {
    // white-on-black text mask; tile faces and outlines are drawn in the shader
    const atlas = buildAtlas(
      {
        id: "grid",
        px: 256,
        aspect: ASPECT,
        layout: "classic",
        bg: "#000000",
        border: "#000000",
        borderWidth: 0,
        radius: 0,
        inset: 0.02,
        symbol: "#FFFFFF",
        text: "#FFFFFF",
        sub: "#FFFFFF",
        showName: false,
        showMass: false,
        symbolWeight: 500,
        symbolSize: 0.3,
        numberSize: 0.1,
        nameSize: 0.1,
        massSize: 0.1,
      },
      gl,
    );
    const layoutData = new Float32Array(LAYOUT_COLS * LAYOUT_ROWS * 4);
    for (const e of ELEMENTS) layoutData[((e.row - 1) * LAYOUT_COLS + (e.col - 1)) * 4] = e.z;
    const layoutTex = new THREE.DataTexture(layoutData, LAYOUT_COLS, LAYOUT_ROWS, THREE.RGBAFormat, THREE.FloatType);
    layoutTex.needsUpdate = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(p.paper);
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.2, 80);

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        atlas: { value: atlas.texture },
        rects: { value: atlas.rectTexture },
        layout_: { value: layoutTex },
        paper: { value: new THREE.Color(p.paper) },
        lineCol: { value: new THREE.Color(p.line) },
        textCol: { value: new THREE.Color(p.text) },
        dotCol: { value: new THREE.Color(p.dot) },
        streakCol: { value: new THREE.Color(p.streak) },
        streakAmt: { value: p.streakStrength },
        t: { value: 0 },
        camX: { value: 0 },
        aspect: { value: ASPECT },
        dotWidth: { value: DOT_WIDTH },
        scan: { value: new THREE.Vector2(SCAN_A, SCAN_B) },
      },
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(9, 0, 5);
    scene.add(plane);

    const elev = THREE.MathUtils.degToRad(30);
    const dist = 4.6;
    const X0 = 8.2; // start column (world x) of the look-at point
    const Z0 = 4.4 * ASPECT; // look-at row (period 5)

    return {
      scene,
      camera,
      update: (frame) => {
        const fm = ((frame % frames) + frames) % frames;
        const t = fm / frames;
        const camX = X0 + t; // exactly one tile width per loop
        mat.uniforms.t.value = t;
        mat.uniforms.camX.value = camX;
        camera.position.set(camX - 0.25, dist * Math.sin(elev), Z0 + dist * Math.cos(elev));
        camera.lookAt(camX, 0, Z0);
        camera.updateMatrixWorld();
        return {
          ...DEFAULT_POST,
          focusDist: dist,
          aperture: 2.4,
          focusBand: 0.03,
          nearScale: 1.0,
          maxBlur: 0.02,
          bloomStrength: 0,
          vignette: 0.06,
        };
      },
      dispose: () => {
        atlas.texture.dispose();
        atlas.rectTexture.dispose();
        layoutTex.dispose();
        mat.dispose();
      },
    };
  };
