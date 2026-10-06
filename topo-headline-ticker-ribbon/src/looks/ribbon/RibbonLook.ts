import * as THREE from "three";
import { FONT_MONO } from "../../lib/assets";
import { GLSL_AALINE } from "../../lib/glsl";
import { applyDotMatrix, GlyphAtlas, SpriteLayer, RGBA } from "../../lib/glyphs";
import { hash01, mod, mulberry32, TAU } from "../../lib/random";
import type { LookFactory } from "../../lib/Stage";

export type RibbonVersion = {
  id: string;
  bg: string;
  gradient: string[]; // colours along one period (cyclic)
  candleUp: string;
  candleDown: string;
  label: string[];
  seed: number;
};

const LOOP = 600;
const L = 64; // path period along x (world units)
const DOT = "";

function softDot(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.45, "rgba(255,255,255,0.95)");
  g.addColorStop(0.7, "rgba(255,255,255,0.2)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

const ribbonVert = /* glsl */ `
in float aAcross; in float aAlong; in float aCol;
out float vAcross; out float vAlong; out float vCol; out float vDist;
void main(){
  vAcross = aAcross; vAlong = aAlong; vCol = aCol;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const ribbonFrag = /* glsl */ `
precision highp float;
${GLSL_AALINE}
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;
uniform float uStrands; uniform float uPx; uniform float uGain;
in float vAcross; in float vAlong; in float vCol; in float vDist;
out vec4 o;
vec3 grad(float t){
  t = fract(t) * 4.0;
  if (t < 1.0) return mix(uC0, uC1, smoothstep(0.0,1.0,t));
  if (t < 2.0) return mix(uC1, uC2, smoothstep(0.0,1.0,t-1.0));
  if (t < 3.0) return mix(uC2, uC3, smoothstep(0.0,1.0,t-2.0));
  return mix(uC3, uC0, smoothstep(0.0,1.0,t-3.0));
}
void main(){
  // strands across the width, each made of fine dots along the path
  // 40 fine strands; every 4th is brighter so the dotted grid still reads
  // when the fine strands average out at small sizes
  float strand = aaLine(vAcross * uStrands, 0.75 * uPx + 0.28);
  float major = aaLine(vAcross * uStrands * 0.25, 1.1 * uPx + 0.45);
  float dots = aaLine(vAlong, 1.0 * uPx + 0.3);
  float dotsMajor = aaLine(vAlong * 0.25, 1.4 * uPx + 0.55);
  float m = strand * mix(0.1, 1.0, dots) * 0.25 + major * dotsMajor * 1.4;
  float edge = smoothstep(0.0, 0.06, vAcross) * smoothstep(1.0, 0.94, vAcross);
  vec3 c = grad(vCol) * m * uGain * (0.55 + 0.45 * edge) + grad(vCol) * 0.012;
  o = vec4(c, 1.0);
}`;
const ribbonDepthFrag = /* glsl */ `
precision highp float;
out vec4 o;
void main(){ o = vec4(0.0); }`;

const gridVert = /* glsl */ `
out vec2 vW; out float vDist;
void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vW = wp.xy; vec4 mv = viewMatrix*wp; vDist = -mv.z; gl_Position = projectionMatrix*mv; }`;
const gridFrag = /* glsl */ `
precision highp float;
${GLSL_AALINE}
uniform vec3 uC; uniform float uSpacing; uniform float uPx;
in vec2 vW; in float vDist; out vec4 o;
void main(){
  float g = max(aaLine(vW.x / uSpacing, 1.8 * uPx + 0.5), aaLine(vW.y / uSpacing, 1.8 * uPx + 0.5));
  float g2 = max(aaLine(vW.x / (uSpacing*0.2), 0.6 * uPx + 0.25), aaLine(vW.y / (uSpacing*0.2), 0.6 * uPx + 0.25));
  o = vec4(uC * (g + g2 * 0.18), 1.0);
}`;

export const makeRibbonLook = (v: RibbonVersion): LookFactory => (ctx) => {
  const rng = mulberry32(v.seed);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(v.bg);
  const camera = new THREE.PerspectiveCamera(46, ctx.width / ctx.height, 0.1, 400);

  // ---- periodic zig-zag path: turn points within one period
  const turns: Array<[number, number, number]> = [];
  {
    const n = 7;
    let x = 0;
    const ys = [0, 5.5, 3.2, 8.4, 4.0, 6.8, 1.6];
    for (let i = 0; i < n; i++) {
      turns.push([x, ys[i] - 4, (rng() - 0.5) * 3.2]);
      x += L / n + (i < n - 1 ? (rng() - 0.5) * 3 : 0);
    }
    // normalise x so the last segment closes the period exactly
    const xs = turns.map((t) => t[0]);
    const span = xs[n - 1] + L / n;
    turns.forEach((t) => (t[0] = (t[0] / span) * L));
  }
  const pathAt = (x: number): [number, number, number] => {
    const k = Math.floor(x / L);
    const xl = x - k * L;
    const n = turns.length;
    let i = 0;
    while (i < n - 1 && turns[i + 1][0] <= xl) i++;
    const a = turns[i];
    const b = i + 1 < n ? turns[i + 1] : [L, turns[0][1], turns[0][2]];
    const t = (xl - a[0]) / (b[0] - a[0]);
    return [x, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  };
  // arc length table over one period (for periodic along-coordinate & colour)
  const AL_N = 4096;
  const arc = new Float64Array(AL_N + 1);
  for (let i = 1; i <= AL_N; i++) {
    const p0 = pathAt(((i - 1) / AL_N) * L), p1 = pathAt((i / AL_N) * L);
    arc[i] = arc[i - 1] + Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  }
  const ARC = arc[AL_N];
  const arcAt = (x: number) => {
    const k = Math.floor(x / L);
    const f = ((x - k * L) / L) * AL_N;
    const i = Math.floor(f);
    const a = arc[i] + (arc[Math.min(AL_N, i + 1)] - arc[i]) * (f - i);
    return k * ARC + a;
  };
  const DOTS_PER_PERIOD = Math.round(ARC * 11 / 4) * 4;
  const smoothY = (x: number) => {
    let s = 0;
    for (let i = -12; i <= 12; i++) s += pathAt(x + i * 0.6)[1];
    return s / 25;
  };
  const smoothZ = (x: number) => {
    let s = 0;
    for (let i = -8; i <= 8; i++) s += pathAt(x + i * 0.8)[2];
    return s / 17;
  };

  // ---- ribbon mesh (rebuilt per frame over a window around the camera)
  const NR = 2400;
  const WIDTH = 1.6;
  const widthDir = new THREE.Vector3(0, 0.18, 1).normalize();
  const rpos = new Float32Array(NR * 2 * 3);
  const across = new Float32Array(NR * 2);
  const along = new Float32Array(NR * 2);
  const colp = new Float32Array(NR * 2);
  const rg = new THREE.BufferGeometry();
  const idx: number[] = [];
  for (let i = 0; i < NR - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  for (let i = 0; i < NR; i++) {
    across[i * 2] = 0;
    across[i * 2 + 1] = 1;
  }
  rg.setIndex(idx);
  const dyn = (arr: Float32Array, n: number) => {
    const a = new THREE.BufferAttribute(arr, n);
    a.setUsage(THREE.DynamicDrawUsage);
    return a;
  };
  rg.setAttribute("position", dyn(rpos, 3));
  rg.setAttribute("aAcross", new THREE.BufferAttribute(across, 1));
  rg.setAttribute("aAlong", dyn(along, 1));
  rg.setAttribute("aCol", dyn(colp, 1));
  const cs = v.gradient.map((h) => new THREE.Color(h));
  const ribbonMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: ribbonVert,
    fragmentShader: ribbonFrag,
    uniforms: { uC0: { value: cs[0] }, uC1: { value: cs[1] }, uC2: { value: cs[2] }, uC3: { value: cs[3] }, uStrands: { value: 40 }, uPx: { value: ctx.pxScale }, uGain: { value: 0.5 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const ribbon = new THREE.Mesh(rg, ribbonMat);
  ribbon.frustumCulled = false;
  scene.add(ribbon);
  const ribbonDepth = new THREE.Mesh(rg, new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: ribbonVert, fragmentShader: ribbonDepthFrag, colorWrite: false, depthWrite: true, side: THREE.DoubleSide }));
  ribbonDepth.frustumCulled = false;
  ribbonDepth.renderOrder = -1;
  scene.add(ribbonDepth);

  // ---- background grids at two depths
  const grids: THREE.Mesh[] = [];
  for (const [z, spacing, k] of [
    [-14, 5, 0.16],
    [-38, 10, 0.1],
  ] as Array<[number, number, number]>) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 200),
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: gridVert,
        fragmentShader: gridFrag,
        uniforms: { uC: { value: new THREE.Color("#3A6A62").multiplyScalar(k * 2.2) }, uSpacing: { value: spacing }, uPx: { value: ctx.pxScale } },
        transparent: true,
        depthWrite: true,
        blending: THREE.AdditiveBlending,
      }),
    );
    m.position.z = z;
    grids.push(m);
    scene.add(m);
  }

  const fmtN = (r: number, d: number) => (r * 100).toFixed(d);
  const fmtW = (r: number) => (r < 0.5 ? (r * 200).toFixed(4) : (r * 90).toFixed(4) + (r * 1e4).toFixed(0).slice(-4));
  // ---- dense walls of dim dot-matrix numbers (static texture, periodic in x with L)
  const wallTex = (() => {
    const W = 4096, H = 2048;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, W, H);
    const rowH = 26;
    for (let y = rowH; y < H; y += rowH * (0.9 + rng() * 0.5)) {
      let x = -rng() * 200;
      const fs = 14 + rng() * 7;
      g.font = `700 ${fs.toFixed(0)}px ${FONT_MONO}`;
      while (x < W) {
        const str = fmtW(rng());
        const w = g.measureText(str).width;
        const r = rng();
        if (r < 0.42) {
          const col = r < 0.36 ? "255,160,58" : r < 0.4 ? "58,232,106" : "255,58,74";
          g.fillStyle = `rgba(${col},${(0.25 + rng() * 0.75).toFixed(2)})`;
          for (const sh of [0, W]) g.fillText(str, x - sh, y);
        }
        x += w + 14 + rng() * 160;
      }
    }
    applyDotMatrix(g, W, H, 3);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  })();
  for (const [z, u0, gain, y0] of [
    [-9, 0, 0.16, -12],
    [-22, 0.37, 0.16, -14],
  ] as Array<[number, number, number, number]>) {
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(L * 10, 32 * 1.25),
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: gridVert,
        fragmentShader: /* glsl */ `
        precision highp float; uniform sampler2D tMap; uniform float uU0; uniform float uGain; uniform float uY0;
        in vec2 vW; in float vDist; out vec4 o;
        void main(){
          vec4 t = texture(tMap, vec2(vW.x / ${L.toFixed(1)} + uU0, (vW.y - uY0) / 40.0));
          if (t.a < 0.03) discard;
          o = vec4(t.rgb * t.a * uGain, 1.0);
        }`,
        uniforms: { tMap: { value: wallTex }, uU0: { value: u0 }, uGain: { value: gain }, uY0: { value: y0 } },
        transparent: true,
        depthWrite: true,
        blending: THREE.AdditiveBlending,
      }),
    );
    wall.position.set(L * 5, y0 + 20, z);
    scene.add(wall);
  }

  // ---- sprites: numbers, candles, markers
  const atlas = new GlyphAtlas({ font: `700 96px ${FONT_MONO}`, fontPx: 96, chars: "0123456789.+-", cellW: 80, cellH: 128, icons: { [DOT]: softDot }, dotMatrix: 9 });
  const far = new SpriteLayer(atlas, 30000, { billboard: false, right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0), depthWrite: true, alphaTest: 0.05 });
  const near = new SpriteLayer(atlas, 30000, { billboard: false, right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0), depthWrite: true, alphaTest: 0.05 });
  const marks = new SpriteLayer(atlas, 20000, { billboard: true, depthWrite: true, alphaTest: 0.1 });
  scene.add(far.mesh, near.mesh, marks.mesh);

  const ORANGE = new THREE.Color("#FFA03A"), GREEN = new THREE.Color("#3AE86A"), RED = new THREE.Color("#FF3A4A");
  const palette = [ORANGE, ORANGE, ORANGE, ORANGE, GREEN, GREEN, ORANGE, RED];
  type Num = { x: number; y: number; z: number; s: number; text: string; c: THREE.Color; a: number; tick: boolean };
  const nums: Num[] = [];

  // columns of small numbers (order-book like), several depths
  for (const [z, count, size, alpha] of [
    [-34, 130, 0.42, 0.28],
    [-22, 90, 0.3, 0.32],
    [-12, 50, 0.22, 0.36],
  ] as Array<[number, number, number, number]>) {
    for (let c = 0; c < count; c++) {
      const x = rng() * L;
      const y0 = -8 + rng() * 22;
      const rows = 4 + Math.floor(rng() * 10);
      const col = palette[Math.floor(rng() * palette.length)];
      for (let r = 0; r < rows; r++) nums.push({ x, y: y0 - r * size * 1.45, z: z + (rng() - 0.5) * 2, s: size, text: fmtN(rng(), 4), c: col, a: alpha * (0.5 + rng() * 0.5), tick: rng() < 0.15 });
    }
  }
  // scattered tiny numbers filling the space
  for (let i = 0; i < 520; i++) {
    const z = -8 - rng() * 34;
    nums.push({ x: rng() * L, y: -9 + rng() * 26, z, s: 0.16 + rng() * 0.16, text: fmtN(rng(), 3 + Math.floor(rng() * 2)), c: palette[Math.floor(rng() * palette.length)], a: 0.22 + rng() * 0.2, tick: rng() < 0.1 });
  }
  // big dim numbers far back
  for (let i = 0; i < 14; i++) nums.push({ x: rng() * L, y: 1.5 + rng() * 8, z: -7 - rng() * 14, s: 0.9 + rng() * 0.8, text: rng() < 0.4 ? "+0." + String(Math.floor(rng() * 900 + 100)).padStart(3, "0") : rng() < 0.5 ? String(Math.floor(rng() * 9000 + 1000)) : (rng() * 99).toFixed(3), c: rng() < 0.85 ? GREEN : RED, a: 0.75, tick: false });
  // a few near, very soft
  const nearNums: Num[] = [];
  for (let i = 0; i < 6; i++) nearNums.push({ x: rng() * L, y: -6 + rng() * 14, z: 6 + rng() * 2, s: 0.22 + rng() * 0.15, text: fmtN(rng(), 3), c: palette[Math.floor(rng() * palette.length)], a: 0.3, tick: false });

  // a few big out-of-focus candles in the foreground
  const nearCandles = Array.from({ length: 9 }, () => ({ x: rng() * L, y: -3 + rng() * 2, h: 0.7 + rng() * 0.9, wick: 0.8 + rng(), up: rng() < 0.3, z: 6.5 + rng() * 1.5 }));
  type Candle = { x: number; dy: number; h: number; wick: number; up: boolean; dz: number };
  const candles: Candle[] = [];
  for (let x = 0.6; x < L; x += 1.5 + rng() * 2.5) {
    if (rng() < 0.3) continue;
    const n = 1 + Math.floor(rng() * 3);
    for (let j = 0; j < n; j++) candles.push({ x: x + j * 0.42, dy: 0.1 + rng() * 1.0, h: 0.3 + rng() * 1.1, wick: 0.3 + rng() * 0.9, up: rng() < 0.8, dz: (rng() - 0.5) * 0.6 });
  }
  type Label = { x: number; text: string; c: THREE.Color };
  const peakLabels: Label[] = turns.map((t) => ({ x: t[0], text: (20 + rng() * 60).toFixed(4), c: [ORANGE, GREEN, GREEN, RED][Math.floor(rng() * 4)] }));

  const cUp = new THREE.Color(v.candleUp), cDown = new THREE.Color(v.candleDown);
  const rgba = (c: THREE.Color, k: number): RGBA => [c.r * k, c.g * k, c.b * k, 1];

  return {
    scene,
    camera,
    grainFrame: (f) => f % LOOP,
    update(frame) {
      const f = mod(frame, LOOP);
      const ph = f / LOOP;
      const xc = L * ph; // camera travels exactly one period per loop

      // camera alongside, slightly behind, following rises and falls (smoothed)
      const cy = smoothY(xc + 2);
      const cz = smoothZ(xc + 2);
      camera.position.set(xc - 3, cy + 1.4, cz + 13.5);
      const ly = smoothY(xc + 9);
      camera.up.set(0, 1, 0);
      camera.lookAt(xc + 5, ly + 2.2, smoothZ(xc + 9) - 2);
      camera.updateMatrixWorld();

      // ribbon geometry around the camera
      const x0 = xc - 22, x1 = xc + 70;
      for (let i = 0; i < NR; i++) {
        const x = x0 + ((x1 - x0) * i) / (NR - 1);
        const p = pathAt(x);
        const al = (arcAt(x) / ARC) * DOTS_PER_PERIOD;
        const cp = arcAt(x) / ARC;
        for (let s = 0; s < 2; s++) {
          const k = (i * 2 + s) * 3;
          const w = (s - 0.5) * WIDTH;
          rpos[k] = p[0] + widthDir.x * w;
          rpos[k + 1] = p[1] + widthDir.y * w;
          rpos[k + 2] = p[2] + widthDir.z * w;
          along[i * 2 + s] = al;
          colp[i * 2 + s] = cp;
        }
      }
      rg.getAttribute("position").needsUpdate = true;
      rg.getAttribute("aAlong").needsUpdate = true;
      rg.getAttribute("aCol").needsUpdate = true;

      // numbers (periodic copies around the camera)
      far.begin();
      near.begin();
      marks.begin();
      const kMin = Math.floor((xc - 70) / L), kMax = Math.floor((xc + 110) / L);
      for (let k = kMin; k <= kMax; k++) {
        const off = k * L;
        for (let i = 0; i < nums.length; i++) {
          const n = nums[i];
          const x = n.x + off;
          const depth = 14 - n.z;
          if (Math.abs(x - xc - 3) > depth * 1.2 + 6) continue;
          const text = n.tick ? fmtN(hash01(i, Math.floor(f / 10), 3), 4) : n.text;
          far.text(text, x, n.y + cy * 0.5, n.z, n.s, rgba(n.c, n.a));
        }
        for (const c of nearCandles) {
          const x = c.x + off;
          if (x - xc < -9 || x - xc > -3) continue; // left foreground only
          const col = c.up ? cUp : cDown;
          near.rect(x, c.y + cy * 0.6, c.z, 1, rgba(col, 0.7), -0.03, -c.wick * 0.5, 0.06, c.h + c.wick);
          near.rect(x, c.y + cy * 0.6, c.z, 1, rgba(col, 0.8), -0.12, 0, 0.24, c.h);
        }
        for (const n of nearNums) {
          const x = n.x + off;
          if (Math.abs(x - xc + 3) > 10) continue;
          near.text(n.text, x, n.y + cy * 0.6, n.z, n.s, rgba(n.c, n.a));
        }
        // candles along the ribbon
        for (const c of candles) {
          const x = c.x + off;
          if (x < xc - 15 || x > xc + 65) continue;
          const p = pathAt(x);
          const col = c.up ? cUp : cDown;
          const base = p[1] + c.dy;
          const z = p[2] + c.dz;
          marks.rect(x, base, z, 1, rgba(col, 0.8), -0.02, -c.wick * 0.5, 0.04, c.h + c.wick);
          marks.rect(x, base, z, 1, rgba(col, 0.95), -0.07, 0, 0.14, c.h);
        }
        // dotted arcs + dots at turns, labels near peaks
        for (let t = 0; t < turns.length; t++) {
          const [tx0, ty, tz] = turns[t];
          const x = tx0 + off;
          if (x < xc - 15 || x > xc + 65) continue;
          const prev = turns[(t + turns.length - 1) % turns.length][1];
          const next = turns[(t + 1) % turns.length][1];
          const peak = ty >= prev && ty >= next;
          const dir = peak ? 1 : -1;
          const R = 2.0 + (t % 3) * 0.6;
          for (let j = 0; j <= 8; j++) {
            const a = (j / 8) * Math.PI;
            const px = x - Math.cos(a) * R;
            const py = ty + dir * (0.5 + Math.sin(a) * R * 0.8);
            const tw = 0.6 + 0.4 * Math.sin(TAU * (ph * 2 + j / 8 + t * 0.3));
            marks.icon(DOT, px, py, tz, 0.34, rgba(cs[(t + (j > 4 ? 1 : 0)) % 4].clone().lerp(new THREE.Color(1, 1, 1), 0.3), 0.9 * tw), -0.5, -0.5, 1, 1);
          }
          marks.icon(DOT, x, ty, tz, 0.3, rgba(new THREE.Color("#FFFFFF"), 1.0), -0.5, -0.5, 1, 1);
          if (peak) {
            const lab = peakLabels[t];
            const val = (parseFloat(lab.text) + (hash01(t, Math.floor(f / 6), 9) - 0.5) * 0.02).toFixed(4);
            marks.text(val, x, ty + 1.3 + R * 0.8, tz, 0.32, rgba(lab.c, 1.3), "center");
          }
        }
      }
      far.end();
      near.end();
      marks.end();

      return {
        focusNear: 11,
        focusFar: 22,
        nearBlurAt: 5,
        farBlurAt: 42,
        nearCoc: 0.01,
        farCoc: 0.006,
        bloom: 0.25,
        bloomRadius: 0.5,
        exposure: 0.85,
        vignette: 0.55,
        grain: 0.015,
      };
    },
  };
};
