import * as THREE from "three";
import { canvasTexture, makeCanvas } from "../../lib/assets";
import { PostFX } from "../../lib/post";
import { mulberry32 } from "../../lib/random";
import { screenLines } from "../../lib/screenLines";
import type { LookFactory } from "../../lib/Stage";
import type { FilesRow } from "../../versions";
import { richer } from "../../lib/color";

export const FILES_FRAMES = 600;

// ---- layout --------------------------------------------------------------------
const N_ITEMS = 60;
const SPACING_DOC = 0.3;
const SPACING_FOLDER = 0.72;
const ITEM_W = 0.78;
const ITEM_H = 1.25;
const ROW2_Z = -2.3;
const WAVE_LAPS = 2; // whole row lengths travelled per 600-frame loop
const WAVE_SIGMA_DOC = 0.75;
const WAVE_SIGMA_FOLDER = 1.3;

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
uniform vec2 uSize; uniform float uSeed; uniform float uFade; uniform vec3 uTint; uniform float uEdgeAmt;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float h1(float x) { return fract(sin(x * 91.7 + uSeed * 13.1) * 43758.5); }
void main() {
  vec2 p = (vUv - 0.5) * uSize;          // world-size coords on the item
  float d;
  if (uKind > 0.5 && uKind < 1.5) {
    // folder back: body + tab on the top-left
    float body = sdRound(p - vec2(0.0, -0.06 * uSize.y), uSize * vec2(0.5, 0.44), 0.05);
    float tab = sdRound(p - vec2(-0.26 * uSize.x, 0.42 * uSize.y), vec2(0.16 * uSize.x, 0.08 * uSize.y), 0.04);
    d = min(body, tab);
  } else {
    d = sdRound(p, uSize * 0.5, uKind > 1.5 ? 0.012 : 0.045);
  }
  float px = fwidth(d);
  float inside = 1.0 - smoothstep(-px, px, d);
  if (inside < 0.002) discard;
  float edgeW = 0.014;
  float edge = 1.0 - smoothstep(edgeW - px, edgeW + px, abs(d + edgeW * 0.6));
  float fres = pow(1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.0);
  // frosted glass: lit from above, soft inner falloff towards the rim
  float sky = 0.5 + 0.5 * smoothstep(-0.55, 0.5, p.y / uSize.y);
  float inner = 0.8 + 0.2 * smoothstep(0.0, -0.12, d);
  vec3 col = uGlass * uTint * (0.72 + 0.3 * fres) * sky * inner;
  float a = uAlpha * (0.72 + 0.25 * fres);
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
      vec2 cb = vec2(p.x + 0.33 * uSize.x, yc);
      float box = abs(sdRound(cb, vec2(0.04), 0.012));
      float hasBox = step(0.4, h1(ri + 0.5));
      marks = max(marks, (1.0 - smoothstep(0.007, 0.007 + px * 1.5, box)) * hasBox * 0.8);
      float len = mix(0.3, 0.58, h1(ri));
      float x0 = -0.22 * uSize.x;
      vec2 lp = vec2(p.x - (x0 + len * 0.5 * uSize.x * 0.9), yc);
      float line = sdRound(lp, vec2(len * 0.5 * uSize.x * 0.9, 0.028), 0.028);
      marks = max(marks, 1.0 - smoothstep(-px, px, line));
    }
  }
  if (uKind > 1.5 && uKind < 2.5) {
    // paper: matte off-white, nearly opaque, slightly darker towards the bottom
    col = vec3(0.82, 0.9, 1.0) * (0.34 + 0.1 * fres) * (0.55 + 0.45 * smoothstep(-0.5, 0.5, p.y / uSize.y));
    a = uAlpha;
  }
  col += mix(uGlass, uEdge, 0.4) * edge * uEdgeAmt;
  col += mix(uGlass, vec3(1.0), 0.55) * marks * 0.5;
  a = max(a, edge * uEdgeAmt);
  a = max(a, marks * 0.8);
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
  const glass = richer(row.glass, 0.8);
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
        uTint: { value: new THREE.Vector3(1, 1, 1) },
        uEdgeAmt: { value: kind === 2 ? 0.12 : kind === 0 ? 0.22 : 0.45 },
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
  const SPACING = row.item === "folder" ? SPACING_FOLDER : SPACING_DOC;
  const ROW_LEN = N_ITEMS * SPACING; // the row is treated as periodic with this length
  const WAVE_LIFT = row.item === "folder" ? 0.45 : 1.15;
  const WAVE_SIGMA = row.item === "folder" ? WAVE_SIGMA_FOLDER : WAVE_SIGMA_DOC;
  const baseGlow = row.item === "folder" ? 0.8 : 1.15;
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
        // folder: back panel with tab, a fan of paper sheets, front panel
        // tilted forward so the folder reads as open (deeper blue panels)
        const FW = 1.0, FH = 1.08;
        const deep = new THREE.Vector3(0.5, 0.72, 1.25);
        const back = makePart(1, FW, FH * 1.2, 0.78, seed);
        back.mesh.position.set(0, (FH * 1.2) / 2, 0);
        back.mat.uniforms.uTint.value.copy(deep);
        back.mat.uniforms.uEdgeAmt.value = 0.3;
        parts.push(back);
        for (let k = 0; k < 6; k++) {
          const sh = makePart(2, FW * (0.9 - k * 0.012), FH * (0.98 - k * 0.025), 0.92, seed + 0.2 * (k + 1));
          const tilt = -0.03 - k * 0.04;
          sh.mesh.position.set((k - 2.5) * 0.006, FH * 0.47 + 0.06 - k * 0.01, -0.03 - k * 0.022);
          sh.mesh.rotation.x = tilt;
          parts.push(sh);
        }
        const front = makePart(3, FW, FH * 0.78, 0.8, seed + 0.9);
        front.mesh.position.set(0, FH * 0.37, -0.2);
        front.mesh.rotation.x = -0.3;
        front.mat.uniforms.uTint.value.copy(deep);
        front.mat.uniforms.uEdgeAmt.value = 0.6;
        parts.push(front);
      }
      parts.forEach((p) => group.add(p.mesh));
      // planes face +z by default; turn them to face along the row (+x)
      group.rotation.y = Math.PI / 2;
      scene.add(group);
      items.push({ group, s0: i * SPACING, row: r, parts });
    }
  }

  // 3D lattice: lines along the row (x), across it (z) and vertical, on a
  // regular grid; glowing nodes sit exactly where an x-line meets a z-line
  const rng = mulberry32(0xf11e);
  const segs: { a: THREE.Vector3; b: THREE.Vector3; i: number }[] = [];
  const GS = 2.4;
  const LY = [-0.05, 1.9, 3.8, 5.7];
  const xLines = new Set<string>();
  const zLines = new Set<string>();
  for (let gy = 0; gy < LY.length; gy++)
    for (let gz = -6; gz <= 1; gz++) {
      // keep high lines away from the camera so they never smear into bands
      if ((gy > 0 && gz > -1) || rng() < 0.4) continue;
      xLines.add(`${gy},${gz}`);
      segs.push({ a: new THREE.Vector3(-30, LY[gy], gz * GS), b: new THREE.Vector3(30, LY[gy], gz * GS), i: 0.3 + 0.5 * rng() });
    }
  for (let gx = -8; gx <= 12; gx++)
    for (let gy = 0; gy < LY.length; gy++) {
      if (rng() < 0.45) continue;
      zLines.add(`${gx},${gy}`);
      segs.push({ a: new THREE.Vector3(gx * GS, LY[gy], -16), b: new THREE.Vector3(gx * GS, LY[gy], gy > 0 ? -2 : 6), i: 0.25 + 0.45 * rng() });
    }
  for (let gx = -8; gx <= 12; gx++)
    for (let gz = -6; gz <= 0; gz++) {
      if (rng() < 0.8) continue;
      segs.push({ a: new THREE.Vector3(gx * GS, -0.05, gz * GS), b: new THREE.Vector3(gx * GS, LY[3], gz * GS), i: 0.15 + 0.35 * rng() });
    }
  if (row.item === "folder") {
    // the folder shot also shows a fine floor grid under the row
    for (let k = -8; k <= 4; k++) segs.push({ a: new THREE.Vector3(-30, -0.06, k * 1.2), b: new THREE.Vector3(30, -0.06, k * 1.2), i: 0.14 });
    for (let k = -20; k <= 25; k++) segs.push({ a: new THREE.Vector3(k * 1.2, -0.06, -16), b: new THREE.Vector3(k * 1.2, -0.06, 8), i: 0.1 });
  }
  const lines = screenLines(segs, richer(row.grid, 0.5).multiplyScalar(6.0), 1.3 / 1080, height, { depthWrite: true, fadeFar: 40 });
  (lines.material as THREE.ShaderMaterial).uniforms.uAspect.value = width / height;
  scene.add(lines);

  const pTex = pointTexture();
  const bTex = bokehTexture();
  const pointMat = (tex: THREE.Texture, c: THREE.Color, o: number) =>
    new THREE.SpriteMaterial({ map: tex, color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: o });
  const pc = richer(row.glass, 0.8).lerp(new THREE.Color(1, 1, 1), 0.1).multiplyScalar(6);
  for (let gx = -8; gx <= 12; gx++)
    for (let gy = 0; gy < LY.length; gy++)
      for (let gz = -6; gz <= 1; gz++) {
        if (!xLines.has(`${gy},${gz}`) || !zLines.has(`${gx},${gy}`) || rng() < 0.25) continue;
        const sp = new THREE.Sprite(pointMat(pTex, pc, 0.7 + 0.3 * rng()));
        sp.position.set(gx * GS, LY[gy], gz * GS);
        sp.scale.setScalar(0.12 + 0.1 * rng());
        scene.add(sp);
      }
  // a few extra sparks riding along the lines
  for (let k = 0; k < 40; k++) {
    const sg = segs[Math.floor(rng() * segs.length)];
    const sp = new THREE.Sprite(pointMat(pTex, pc, 0.5 + 0.4 * rng()));
    sp.position.lerpVectors(sg.a, sg.b, 0.2 + 0.6 * rng());
    sp.scale.setScalar(0.06 + 0.08 * rng());
    scene.add(sp);
  }
  const bc = richer(row.glass, 0.8).lerp(richer(row.grid, 0.6), 0.3);
  for (let k = 0; k < 70; k++) {
    const s = new THREE.Sprite(pointMat(bTex, bc, 0.1 + 0.25 * rng()));
    s.position.set((rng() - 0.5) * 30, -0.5 + rng() * 6, -12 + rng() * 18);
    s.scale.setScalar(0.08 + Math.pow(rng(), 2) * 0.5);
    scene.add(s);
  }
  // foreground bokeh between the camera and the row (lower right of frame)
  for (let k = 0; k < 18; k++) {
    const s = new THREE.Sprite(pointMat(bTex, bc, 0.12 + 0.25 * rng()));
    s.position.set(-2.5 + rng() * 6, -0.3 + rng() * 1.2, 1.2 + rng() * 2.2);
    s.scale.setScalar(0.04 + rng() * 0.1);
    scene.add(s);
  }

  const camera = new THREE.PerspectiveCamera(30, width / height, 0.2, 120);
  const post = new PostFX(gl, width, height, {
    exposure: 1.0,
    bloomStrength: 0.55,
    bloomThreshold: 0.45,
    bloomKnee: 0.5,
    bloomWeights: [0.6, 0.9, 1, 1, 0.8, 0.6],
    dof: { focus: 10, nearK: 1.3, farK: 0.9, maxBlur: 0.024 },
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
        const glow = (baseGlow + 1.3 * bump) * (it.row ? 0.3 : 1);
        it.parts.forEach((p) => {
          p.mat.uniforms.uGlow.value = glow;
          p.mat.uniforms.uFade.value = Math.max(0, endFade);
        });
      });
      // camera ~25 degrees above, looking along the row; closed drift
      const a = Math.PI * 2 * t;
      camera.position.set(-4.6 + 0.25 * Math.sin(a), 3.5 + 0.08 * Math.sin(2 * a), 5.2 + 0.2 * Math.cos(a));
      camera.lookAt(1.2 + 0.12 * Math.cos(a), 0.7, -0.8);
      camera.updateMatrixWorld();
      post.opts.dof!.focus = camera.position.distanceTo(new THREE.Vector3(-0.2, 0.8, 0));
      post.render(scene, camera, f);
    },
  };
};
