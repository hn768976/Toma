import * as THREE from "three";
import { canvasTexture, makeCanvas } from "../../lib/assets";
import { PostFX } from "../../lib/post";
import { mulberry32 } from "../../lib/random";
import { screenLines } from "../../lib/screenLines";
import type { LookFactory } from "../../lib/Stage";
import type { FilesRow } from "../../versions";

export const FILES_FRAMES = 600;

// ---- layout --------------------------------------------------------------------
const N_ITEMS = 60;
const SPACING = 0.3;
const ROW_LEN = N_ITEMS * SPACING; // the row is treated as periodic with this length
const ITEM_W = 1.0;
const ITEM_H = 1.32;
const ROW2_Z = -2.3;
const WAVE_LAPS = 2; // whole row lengths travelled per 600-frame loop
const WAVE_SIGMA = 1.15;
const WAVE_LIFT = 0.62;

const glassVert = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

// kind: 0 = page (lines + checkboxes), 1 = folder panel (with tab), 2 = paper sheet, 3 = plain panel
const glassFrag = /* glsl */ `
uniform vec3 uGlass; uniform vec3 uEdge; uniform float uGlow; uniform float uAlpha; uniform float uKind;
uniform vec2 uSize; uniform float uSeed; uniform float uFade;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float h1(float x) { return fract(sin(x * 91.7 + uSeed * 13.1) * 43758.5); }
void main() {
  vec2 p = (vUv - 0.5) * uSize;          // world-size coords on the item
  float d;
  if (uKind > 0.5 && uKind < 1.5) {
    // folder back: body + tab on the top-left
    float body = sdRound(p - vec2(0.0, -0.05 * uSize.y), uSize * vec2(0.5, 0.45), 0.05);
    float tab = sdRound(p - vec2(-0.22 * uSize.x, 0.43 * uSize.y), vec2(0.17 * uSize.x, 0.07 * uSize.y), 0.035);
    d = min(body, tab);
  } else {
    d = sdRound(p, uSize * 0.5, uKind > 1.5 ? 0.012 : 0.045);
  }
  float px = fwidth(d);
  float inside = 1.0 - smoothstep(-px, px, d);
  if (inside < 0.002) discard;
  float edgeW = 0.018;
  float edge = 1.0 - smoothstep(edgeW - px, edgeW + px, abs(d + edgeW * 0.6));
  float fres = pow(1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.0);
  // fake environment: brighter towards the top of the item
  float sky = 0.6 + 0.4 * smoothstep(-0.5, 0.5, p.y / uSize.y);
  vec3 col = uGlass * (0.2 + 0.3 * fres) * sky;
  float a = uAlpha * (0.55 + 0.3 * fres);
  float marks = 0.0;
  if (uKind < 0.5) {
    // page print: checkbox squares + rounded text lines
    vec2 q = vUv;
    float rows = 7.0;
    float rv = (q.y - 0.12) / 0.74 * rows;
    float ri = floor(rv);
    float rf = fract(rv);
    if (ri >= 0.0 && ri < rows) {
      float yc = (rf - 0.5) * (0.74 / rows) * uSize.y;
      // checkbox at left
      vec2 cb = vec2(p.x + 0.33 * uSize.x, yc);
      float box = abs(sdRound(cb, vec2(0.045), 0.012));
      float hasBox = step(0.25, h1(ri + 0.5));
      marks = max(marks, (1.0 - smoothstep(0.006, 0.006 + px * 1.5, box)) * hasBox);
      // text line(s)
      float len = mix(0.28, 0.56, h1(ri));
      float x0 = -0.22 * uSize.x;
      vec2 lp = vec2(p.x - (x0 + len * 0.5 * uSize.x * 0.9), yc);
      float line = sdRound(lp, vec2(len * 0.5 * uSize.x * 0.9, 0.024), 0.024);
      marks = max(marks, 1.0 - smoothstep(-px, px, line));
    }
  }
  if (uKind > 1.5 && uKind < 2.5) {
    // paper: whiter, more opaque
    col = mix(uGlass, vec3(1.0), 0.6) * (0.22 + 0.25 * fres) * sky;
    a = uAlpha * 0.6;
  }
  col += mix(uGlass, uEdge, 0.5) * edge * 0.7;
  col += uGlass * marks * 0.55;
  a = max(a, edge * 0.9);
  a = max(a, marks * 0.85);
  col *= uGlow * uFade;
  gl_FragColor = vec4(col, a * inside * uFade);
}
`;

function bokehTexture(): THREE.Texture {
  const N = 128;
  const [c, ctx] = makeCanvas(N, N);
  const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.55, "rgba(255,255,255,0.75)");
  g.addColorStop(0.8, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, N, N);
  return canvasTexture(c, false);
}
function pointTexture(): THREE.Texture {
  const N = 64;
  const [c, ctx] = makeCanvas(N, N);
  const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.15, "rgba(255,255,255,0.8)");
  g.addColorStop(0.4, "rgba(255,255,255,0.12)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, N, N);
  return canvasTexture(c, false);
}

type Part = { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; base: number };
type Item = { group: THREE.Group; s0: number; row: number; parts: Part[] };

export const createFileWave: LookFactory<FilesRow> = async ({ gl, width, height, props: row }) => {
  const scene = new THREE.Scene();
  const glass = new THREE.Color(row.glass);
  const edge = new THREE.Color(row.edge);
  const gridC = new THREE.Color(row.grid);

  const makePart = (kind: number, w: number, h: number, alpha: number, seed: number) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: glassVert,
      fragmentShader: glassFrag,
      uniforms: {
        uGlass: { value: glass },
        uEdge: { value: edge },
        uGlow: { value: 1 },
        uAlpha: { value: alpha },
        uKind: { value: kind },
        uSize: { value: new THREE.Vector2(w, h) },
        uSeed: { value: seed },
        uFade: { value: 1 },
      },
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
      extensions: { derivatives: true } as never,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    return { mesh, mat, base: alpha };
  };

  // items: planes standing on edge, facing along the row (+x)
  const items: Item[] = [];
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < N_ITEMS; i++) {
      const group = new THREE.Group();
      const parts: Part[] = [];
      const seed = i + r * 100;
      if (row.item === "document") {
        const p = makePart(0, ITEM_W, ITEM_H, 0.55, seed);
        p.mesh.position.y = ITEM_H / 2;
        parts.push(p);
      } else {
        // folder: back panel with tab, two paper sheets, front panel
        const FW = 1.12, FH = 1.0;
        const back = makePart(1, FW, FH * 1.12, 0.5, seed);
        back.mesh.position.set(0, (FH * 1.12) / 2, 0);
        const p1 = makePart(2, FW * 0.92, FH * 1.0, 0.75, seed + 0.3);
        p1.mesh.position.set(0.012, FH * 0.5 + 0.06, -0.035);
        const p2 = makePart(2, FW * 0.9, FH * 0.98, 0.75, seed + 0.6);
        p2.mesh.position.set(-0.01, FH * 0.49 + 0.035, -0.07);
        const front = makePart(3, FW, FH * 0.86, 0.5, seed + 0.9);
        front.mesh.position.set(0, FH * 0.43, -0.11);
        front.mesh.rotation.x = 0.06;
        parts.push(back, p1, p2, front);
      }
      parts.forEach((p) => group.add(p.mesh));
      // planes face +z by default; turn them to face along the row (+x)
      group.rotation.y = Math.PI / 2;
      scene.add(group);
      items.push({ group, s0: i * SPACING, row: r, parts });
    }
  }

  // grid lattice + floor lines
  const rng = mulberry32(0xf11e);
  const segs: { a: THREE.Vector3; b: THREE.Vector3; i: number }[] = [];
  const GS = 2.4;
  for (let gy = 0; gy <= 3; gy++)
    for (let gz = -5; gz <= 2; gz++) {
      if (rng() < 0.45) continue;
      const y = -0.05 + gy * GS * 0.8, z = gz * GS;
      segs.push({ a: new THREE.Vector3(-30, y, z), b: new THREE.Vector3(30, y, z), i: 0.25 + 0.5 * rng() });
    }
  for (let gx = -10; gx <= 10; gx++)
    for (let gy = 0; gy <= 3; gy++) {
      if (rng() < 0.5) continue;
      const x = gx * GS, y = -0.05 + gy * GS * 0.8;
      segs.push({ a: new THREE.Vector3(x, y, -16), b: new THREE.Vector3(x, y, 8), i: 0.2 + 0.45 * rng() });
    }
  for (let gx = -10; gx <= 10; gx++)
    for (let gz = -5; gz <= 2; gz++) {
      if (rng() < 0.82) continue;
      const x = gx * GS, z = gz * GS;
      segs.push({ a: new THREE.Vector3(x, -0.05, z), b: new THREE.Vector3(x, 8, z), i: 0.15 + 0.35 * rng() });
    }
  // floor lines under the rows
  for (let k = -12; k <= 12; k++) segs.push({ a: new THREE.Vector3(-30, -0.06, k * 0.9), b: new THREE.Vector3(30, -0.06, k * 0.9), i: 0.18 });
  for (let k = -30; k <= 30; k++) segs.push({ a: new THREE.Vector3(k * 0.9, -0.06, -16), b: new THREE.Vector3(k * 0.9, -0.06, 10), i: 0.12 });
  const lines = screenLines(segs, gridC.clone().multiplyScalar(2.6), 1.2 / 1080, height, { depthWrite: true, fadeFar: 40 });
  (lines.material as THREE.ShaderMaterial).uniforms.uAspect.value = width / height;
  scene.add(lines);

  // glowing points at intersections + bokeh specks
  const pTex = pointTexture();
  const bTex = bokehTexture();
  const pointMat = (tex: THREE.Texture, c: THREE.Color, o: number) =>
    new THREE.SpriteMaterial({ map: tex, color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: o });
  const pc = new THREE.Color(row.glass).lerp(new THREE.Color(1, 1, 1), 0.3).multiplyScalar(2.5);
  for (let k = 0; k < 90; k++) {
    const x = (Math.floor(rng() * 21) - 10) * GS, y = -0.05 + Math.floor(rng() * 4) * GS * 0.8, z = (Math.floor(rng() * 8) - 5) * GS;
    const s = new THREE.Sprite(pointMat(pTex, pc, 0.6 + 0.4 * rng()));
    s.position.set(x, y, z);
    s.scale.setScalar(0.12 + 0.12 * rng());
    scene.add(s);
  }
  const bc = new THREE.Color(row.glass).lerp(new THREE.Color(row.grid), 0.4);
  for (let k = 0; k < 70; k++) {
    const s = new THREE.Sprite(pointMat(bTex, bc, 0.08 + 0.2 * rng()));
    s.position.set((rng() - 0.5) * 30, -0.5 + rng() * 6, -12 + rng() * 18);
    s.scale.setScalar(0.08 + Math.pow(rng(), 2) * 0.5);
    scene.add(s);
  }

  const camera = new THREE.PerspectiveCamera(30, width / height, 0.2, 120);
  const post = new PostFX(gl, width, height, {
    exposure: 1.0,
    bloomStrength: 0.45,
    bloomThreshold: 0.5,
    bloomKnee: 0.5,
    bloomWeights: [0.6, 0.9, 1, 1, 0.8, 0.6],
    dof: { focus: 10, nearK: 1.8, farK: 0.55, maxBlur: 0.018 },
    grain: 0.02,
    vignette: 0.35,
    clearColor: new THREE.Color(row.background),
  });

  const wrap = (d: number) => d - ROW_LEN * Math.round(d / ROW_LEN);

  return {
    render(frame) {
      const f = ((frame % FILES_FRAMES) + FILES_FRAMES) % FILES_FRAMES;
      const t = f / FILES_FRAMES;
      const c = t * WAVE_LAPS * ROW_LEN; // wave centre along the row
      items.forEach((it) => {
        const s = it.s0;
        const d = wrap(s - c - (it.row ? 1.4 : 0));
        const bump = Math.exp(-(d * d) / (2 * WAVE_SIGMA * WAVE_SIGMA));
        const x = s - ROW_LEN / 2;
        it.group.position.set(x, WAVE_LIFT * bump * (it.row ? 0.8 : 1), it.row ? ROW2_Z : 0);
        // tilt slightly as the wave passes (sign follows the wave slope)
        it.group.rotation.set(0, Math.PI / 2, 0);
        it.group.rotateX(-0.12 * bump * Math.sign(d) * Math.min(1, Math.abs(d)));
        // fade at the row ends so the periodic wrap never shows
        const endFade = Math.min(1, (x + ROW_LEN / 2) / 1.5, (ROW_LEN / 2 - x) / 4);
        const glow = (0.75 + 1.4 * bump) * (it.row ? 0.45 : 1);
        it.parts.forEach((p) => {
          p.mat.uniforms.uGlow.value = glow;
          p.mat.uniforms.uFade.value = Math.max(0, endFade);
        });
      });
      // camera ~25 degrees above, looking along the row; closed drift
      const a = Math.PI * 2 * t;
      camera.position.set(-7.2 + 0.3 * Math.sin(a), 3.1 + 0.12 * Math.sin(2 * a), 4.6 + 0.25 * Math.cos(a));
      camera.lookAt(0.2 + 0.15 * Math.cos(a), 0.75, -0.8);
      camera.updateMatrixWorld();
      post.opts.dof!.focus = camera.position.distanceTo(new THREE.Vector3(-1.0, 0.7, 0));
      post.render(scene, camera, f);
    },
  };
};
