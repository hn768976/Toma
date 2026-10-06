import {
  Color,
  CustomBlending,
  DoubleSide,
  Mesh,
  OneFactor,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Texture,
  Vector3,
  Vector4,
  WebGLRenderer,
} from "three";
import { FONT } from "../lib/assets";
import { canvasTexture, makeCanvas } from "../lib/canvas";
import { candlesFrom, drawCandles, drawLine, periodicSeries } from "../lib/charts";
import { TAU } from "../lib/ease";
import { makeGlobe } from "../lib/globe";
import { LabelSpec, makeAtlas, makeLabels } from "../lib/labels";
import { LookFactory } from "../lib/LookCanvas";
import { makeBackground, makeTexPlane } from "../lib/materials";
import { defaultPost } from "../lib/postfx";
import { mulberry32, Rng, SEEDS } from "../lib/rand";
import { GLSL_COMMON, Shared } from "../lib/shared";

export interface MarketGlobeParams {
  globe: string; // continent dots / lines
  bgTop: string;
  bgBottom: string;
  floor: string;
  cyan: string;
  red: string;
}

const LOOP = 600; // frames — every periodic motion completes whole cycles in this

// ── Chart strip textures (one data period across the width; wrapS = repeat) ──
const candleStrip = (gl: WebGLRenderer, r: Rng, p: MarketGlobeParams, n: number, w = 2048, h = 512) => {
  const { c, ctx } = makeCanvas(w, h);
  const cs = candlesFrom(r, periodicSeries(r, n, { harmonics: 5, noise: 2.2 }), 0.3);
  const colors = cs.map((k) => {
    const up = k.c >= k.o;
    const x = r();
    return !up && x < 0.45 ? p.red : x < 0.45 ? "#EAF6FF" : p.cyan;
  });
  drawCandles(ctx, cs, 0, h * 0.06, w, h * 0.88, {
    up: "#fff",
    down: p.red,
    wick: 1.5,
    body: 0.38,
    glow: 3,
    color: (i) => colors[i],
  });
  return canvasTexture(c, gl, { repeat: true });
};

const lineStrip = (gl: WebGLRenderer, r: Rng, n: number, w = 2048, h = 512) => {
  const { c, ctx } = makeCanvas(w, h);
  const s = periodicSeries(r, n, { harmonics: 3, noise: 1.6 });
  drawLine(ctx, s, 0, h * 0.15, w, h * 0.7, { color: "#F4FAFF", width: 2.2, dots: 4.5, dotEvery: 1, glow: 4, closed: true });
  return canvasTexture(c, gl, { repeat: true });
};

const barStrip = (gl: WebGLRenderer, r: Rng, n: number, color: string, w = 2048, h = 512) => {
  const { c, ctx } = makeCanvas(w, h);
  const s = periodicSeries(r, n, { harmonics: 4, noise: 2.5 });
  const lo = Math.min(...s);
  const hi = Math.max(...s);
  const slot = w / n;
  ctx.shadowColor = color;
  ctx.shadowBlur = 5;
  s.forEach((v, i) => {
    const bh = ((v - lo) / (hi - lo)) * h * 0.85 + h * 0.05;
    const g = ctx.createLinearGradient(0, h - bh, 0, h);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(80,160,255,0.0)");
    ctx.fillStyle = g;
    ctx.fillRect(i * slot + slot * 0.18, h - bh, slot * 0.64, bh);
  });
  return canvasTexture(c, gl, { repeat: true });
};

const areaStrip = (gl: WebGLRenderer, r: Rng, n: number, w = 2048, h = 256) => {
  const { c, ctx } = makeCanvas(w, h);
  const s = periodicSeries(r, n, { harmonics: 6, noise: 1.0 });
  const lo = Math.min(...s);
  const hi = Math.max(...s);
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i <= n; i++) ctx.lineTo((i / n) * w, h - ((s[i % n] - lo) / (hi - lo)) * h * 0.8 - h * 0.1);
  ctx.lineTo(w, h);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(140,200,255,0.75)");
  g.addColorStop(1, "rgba(60,120,255,0.05)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(220,240,255,0.9)";
  ctx.lineWidth = 2;
  ctx.stroke();
  return canvasTexture(c, gl, { repeat: true });
};

/** Thin frame / grid overlay texture (static HUD panel). */
const panelTex = (gl: WebGLRenderer, w = 1024, h = 512) => {
  const { c, ctx } = makeCanvas(w, h);
  ctx.strokeStyle = "rgba(150,200,255,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, w - 4, h - 4);
  ctx.strokeStyle = "rgba(150,200,255,0.12)";
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  return canvasTexture(c, gl);
};

/** Donut ring (shader): segments sweep periodically; DoF by widening the AA edge. */
const makeDonut = (shared: Shared, size: number, color: Color, phase: number, cycles: number) => {
  const m = new ShaderMaterial({
    uniforms: { ...shared, uC: { value: color }, uPhase: { value: phase }, uCycles: { value: cycles }, uAlpha: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vDist;
      void main() {
        vUv = uv * 2.0 - 1.0;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      uniform vec3 uC;
      uniform float uPhase;
      uniform float uCycles;
      uniform float uAlpha;
      varying vec2 vUv;
      varying float vDist;
      void main() {
        float r = length(vUv);
        float pxPerUv = 1.0 / max(fwidth(r), 1e-5);
        float soft = (1.0 + cocPx(vDist)) / pxPerUv;
        float ring = smoothstep(0.62 - soft, 0.62 + soft, r) * (1.0 - smoothstep(0.92 - soft, 0.92 + soft, r));
        float inner = smoothstep(0.42 - soft, 0.42 + soft, r) * (1.0 - smoothstep(0.5 - soft, 0.5 + soft, r));
        float a = fract(atan(vUv.y, vUv.x) / 6.2831853 + 0.25);
        float t = uFrame / ${LOOP.toFixed(1)} * uCycles + uPhase;
        float sweep = 0.35 + 0.55 * (0.5 + 0.5 * sin(t * 6.2831853));
        float filled = 1.0 - smoothstep(sweep - 0.004, sweep + 0.004, a);
        float gap = smoothstep(0.0, 0.01, fract(a * 24.0)) * smoothstep(1.0, 0.99, fract(a * 24.0));
        float v = ring * (0.18 + 0.95 * filled) * mix(1.0, gap, 0.35) + inner * 0.35;
        gl_FragColor = vec4(uC * v * uAlpha, 0.0);
      }`,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneFactor,
  });
  return new Mesh(new PlaneGeometry(size, size), m);
};

export const marketGlobe: LookFactory<MarketGlobeParams> = ({ gl, assets, shared, params, width, height }) => {
  const opaque = new Scene();
  const overlay = new Scene();
  const camera = new PerspectiveCamera(34, width / height, 0.3, 400);
  const rng = mulberry32(SEEDS.marketGlobe);
  const cyan = new Color(params.cyan);

  // ── Background ─────────────────────────────────────────────────────────
  opaque.add(
    makeBackground(
      /* glsl */ `
      vec3 top = uTop;
      vec3 bot = uBot;
      float y = vUv.y;
      col = mix(bot * 1.3, mix(bot, top, 0.55) * 1.4, smoothstep(0.1, 1.0, y));
      col += uBot * 0.5 * exp(-pow((vUv.x - 0.3) * 1.6, 2.0)) * smoothstep(0.9, 0.3, y);
      // brighter haze around the horizon
      col += uBot * 0.9 * exp(-pow((y - 0.36) * 5.0, 2.0));
      // violet tint, upper right
      col += vec3(0.05, 0.0, 0.09) * smoothstep(0.55, 1.0, vUv.x) * smoothstep(0.3, 1.0, y);
      `,
      { uTop: { value: new Color(params.bgTop) }, uBot: { value: new Color(params.bgBottom) } },
      shared,
    ),
  );

  // ── Floor: perspective grid of small squares, fading into haze ───────────
  const floorMat = new ShaderMaterial({
    uniforms: { ...shared, uC: { value: new Color(params.floor) }, uScroll: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      varying float vDist;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      uniform vec3 uC;
      uniform float uScroll;
      varying vec3 vW;
      varying float vDist;
      void main() {
        vec2 p = vW.xz / 1.5 + vec2(0.0, uScroll);
        vec2 f = abs(fract(p) - 0.5);
        vec2 fw = fwidth(p);
        float blur = 0.35 * cocPx(vDist) * max(fw.x, fw.y);
        vec2 soft = fw + blur;
        float sq = (1.0 - smoothstep(0.16 - soft.x, 0.16 + soft.x, f.x)) * (1.0 - smoothstep(0.1 - soft.y, 0.1 + soft.y, f.y));
        // sub-pixel squares fade to their average instead of aliasing
        float avg = 0.32 * 0.2;
        float detail = smoothstep(0.6, 0.25, max(fw.x, fw.y));
        sq = mix(avg, sq, detail);
        // a few cells brighter
        vec2 cell = floor(p);
        float hi = step(0.93, hash12(cell * 1.37 + 3.1));
        float fade = exp(-vDist * 0.022) * smoothstep(2.0, 6.0, vDist);
        gl_FragColor = vec4(uC * sq * (2.2 + hi * 3.0) * fade, 0.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneFactor,
  });
  const floor = new Mesh(new PlaneGeometry(400, 400), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -3.6, -100);
  floor.name = "floor";
  overlay.add(floor);

  // ── Globe ──────────────────────────────────────────────────────────────
  const globeCol = new Color(params.globe);
  const globe = makeGlobe(assets, shared, {
    radius: 9.6,
    color: globeCol,
    oceanColor: new Color("#4A88F0"),
    rowStepDeg: 0.75,
    dotStepDeg: 0.4,
    dotSize: 0.06,
    landGain: 0.8,
    oceanGain: 0.34,
    coastGain: 0.7,
    backFace: 0.06,
    rim: new Color("#6AB0FF"),
    rimGain: 0.8,
    bodyGain: 0.05,
  });
  globe.group.position.set(9.4, 0.6, -15);
  globe.group.rotation.set(0.32, 0, -0.18);
  overlay.add(globe.group);

  // ── Chart layers (left), several depths ─────────────────────────────────
  type Layer = { mesh: Mesh; cycles: number; frac: number; phase: number };
  const layers: Layer[] = [];
  const addStrip = (
    tex: Texture,
    w: number,
    h: number,
    pos: [number, number, number],
    opts: { color?: Color; opacity?: number; frac?: number; cycles?: number; rotY?: number },
  ) => {
    const mesh = makeTexPlane({ map: tex, shared, width: w, height: h, color: opts.color, opacity: opts.opacity ?? 1 });
    mesh.position.set(...pos);
    mesh.rotation.y = opts.rotY ?? 0.18;
    mesh.name = "strip" + layers.length;
    overlay.add(mesh);
    layers.push({ mesh, cycles: opts.cycles ?? 1, frac: opts.frac ?? 0.5, phase: rng() });
    return mesh;
  };
  const white = new Color(1, 1, 1);
  // mid layer (in focus): candles + line chart
  addStrip(candleStrip(gl, rng, params, 220, 4096, 1024), 9.5, 3.0, [-3.4, 1.0, 0], { color: white.clone().multiplyScalar(1.5), frac: 0.45, cycles: 1 });
  addStrip(lineStrip(gl, rng, 40), 9.0, 1.4, [-3.2, 0.6, 0.2], { color: white.clone().multiplyScalar(1.3), frac: 0.5, cycles: 1 });
  addStrip(candleStrip(gl, rng, params, 160, 4096, 1024), 6.5, 2.6, [-5.2, 1.4, -2.0], { color: white.clone().multiplyScalar(1.15), frac: 0.4, cycles: 1 });
  // near layer (soft): candles at the left edge
  addStrip(candleStrip(gl, rng, params, 120, 4096, 1024), 4.2, 3.6, [-6.6, 1.0, 4.0], { color: white.clone().multiplyScalar(1.1), frac: 0.35, cycles: 2 });
  // far layers
  addStrip(barStrip(gl, rng, 80, "#9AD4FF"), 9.0, 2.0, [-4.0, 1.3, -6], { color: white.clone().multiplyScalar(0.9), frac: 0.5, cycles: 1 });
  addStrip(areaStrip(gl, rng, 60), 6.0, 1.1, [-5.5, 3.4, -9], { color: white.clone().multiplyScalar(0.8), frac: 0.5, cycles: 1 });
  addStrip(candleStrip(gl, rng, params, 120), 12.0, 3.2, [0.5, 1.0, -12], { color: white.clone().multiplyScalar(0.75), frac: 0.5, cycles: 1, rotY: 0.1 });
  addStrip(barStrip(gl, rng, 50, "#CFE8FF"), 4.0, 1.2, [-7.6, 2.7, -3.0], { color: white.clone().multiplyScalar(0.9), frac: 0.6, cycles: 1 });
  // HUD panels behind charts
  const pTex = panelTex(gl);
  for (const [x, y, z, w, h] of [
    [-6.4, 2.5, -2.0, 3.4, 1.8],
    [-1.2, 2.4, -4.5, 3.2, 1.6],
    [-7.8, -0.6, 1.5, 2.6, 1.4],
  ] as const) {
    const m = makeTexPlane({ map: pTex, shared, width: w, height: h, color: new Color(0.6, 0.8, 1.4), opacity: 0.8 });
    m.position.set(x, y, z);
    m.rotation.y = 0.18;
    m.name = "panels";
    overlay.add(m);
  }
  // Donuts
  const donuts = [
    makeDonut(shared, 1.3, white.clone().multiplyScalar(1.6), 0.1, 1),
    makeDonut(shared, 0.75, cyan.clone().multiplyScalar(1.5), 0.6, 2),
    makeDonut(shared, 0.7, cyan.clone().multiplyScalar(1.3), 0.3, 1),
    makeDonut(shared, 0.65, white.clone().multiplyScalar(1.2), 0.8, 1),
    makeDonut(shared, 1.1, white.clone().multiplyScalar(0.9), 0.45, 1),
  ];
  const dPos: [number, number, number][] = [
    [0.4, 1.7, 0.4],
    [-1.4, 0.0, 0.4],
    [-0.6, 0.0, 0.4],
    [-8.0, 1.6, 3.0],
    [4.0, 0.8, -6],
  ];
  donuts.forEach((d, i) => {
    d.position.set(...dPos[i]);
    d.rotation.y = 0.18;
    d.name = "charts";
    overlay.add(d);
  });

  // ── Floating labels (invented numbers), many depths ───────────────────────
  const texts: string[] = [];
  for (let i = 0; i < 256; i++) texts.push((10 + rng() * 980).toFixed(2));
  const atlas = makeAtlas(gl, texts, { cellW: 256, cellH: 96, font: `600 36px "${FONT.mono}"`, color: "#ffffff", align: "center" });
  const labels: LabelSpec[] = [];
  for (let i = 0; i < 110; i++) {
    const z = 2.5 - rng() * 20;
    const x = -10 + rng() * 13 + (z < -10 ? 5 : 0);
    const y = -2.4 + rng() * 6.2;
    labels.push({
      pos: [x, y, z],
      cell: (i * 4) % 252,
      variants: 4,
      period: 15, // 600 / 15 = 40 steps; 40 % 4 = 0 → loops
      phase: Math.floor(rng() * 60) * 15,
      height: 0.36 + rng() * 0.22,
      color: rng() < 0.85 ? [1.3, 1.4, 1.6] : [0.5, 1.2, 1.7],
    });
  }
  const labelMesh = makeLabels(atlas, labels, shared);
  labelMesh.name = "labels";
  overlay.add(labelMesh);

  // ── Post ──────────────────────────────────────────────────────────────
  const post = defaultPost();
  post.bloomStrength = 0.75;
  post.bloomThreshold = 0.6;
  post.bloomRadius = 0.7;
  post.vignette = 0.3;
  shared.uFocus.value = 12.5;
  shared.uFocusRange.value = 1.5;
  shared.uAperture.value = 0.03;
  shared.uNearMul.value = 1.0;
  shared.uMaxCoc.value = 0.012;

  const lookAt = new Vector3();
  const update = (frame: number) => {
    const ph = (frame / LOOP) * TAU;
    // slow camera drift on a closed path
    camera.position.set(0.6 * Math.sin(ph), 0.15 * Math.sin(ph * 2) + 0.2, 12.5 + 0.5 * Math.cos(ph));
    lookAt.set(0.4 * Math.sin(ph), 1.05, 0);
    camera.lookAt(lookAt);
    camera.updateMatrixWorld();
    globe.spin.rotation.y = -(frame / LOOP) * TAU; // one full turn per loop
    layers.forEach((l) => {
      const u = (l.mesh.material as ShaderMaterial).uniforms.uUvRect.value as Vector4;
      u.set(l.frac, 1, l.phase + (frame / LOOP) * l.cycles, 0);
    });
    (floorMat.uniforms.uScroll as { value: number }).value = 0;
  };

  return { opaque, overlay, camera, post, update };
};
