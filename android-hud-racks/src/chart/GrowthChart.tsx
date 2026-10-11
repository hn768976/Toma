import { useCallback } from "react";
import { staticFile } from "remotion";
import * as THREE from "three";
import {
  barStack,
  codeLine,
  counter2,
  grid,
  HUD,
  inter,
  makeBars,
  miniBars,
  numberBox,
  orbitron,
  rgba,
  ringGauge,
  textLines,
  triangle,
} from "../hud/kit";
import { HudPanel, Widget } from "../hud/layer";
import { GLStage, loadFonts, SceneFactory } from "../lib/GLStage";
import { PostChain } from "../lib/post";
import {
  clamp,
  easeInOutCubic,
  holdIndex,
  mulberry32,
  randomDigits,
  smoothstep,
  TAU,
} from "../lib/random";

// Look 2 — Growth Chart HUD: a 15 s story. The screen fades up (0-1.5 s),
// the area chart draws itself on from JAN to DEC (1.5-10 s), then holds
// (10-15 s) while counters keep ticking and the camera keeps drifting.

export const CHART_FRAMES = 450;
const FOV = 30;

// The screen is 16 x 9 world units; its layout is in "screen px", 300 per
// unit (4800 x 2700).
const SW = 4800;
const SH = 2700;
const PPU = 300;

// Plot area in screen px.
const PLOT = { x: 950, y: 720, w: 2950, h: 930 };
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// Two seeded rising random walks, 12 points each, values 0..600.
const makeSeries = (seed: number, start: number, end: number, wiggle: number) => {
  const rnd = mulberry32(seed);
  const pts: number[] = [];
  for (let i = 0; i < 12; i++) {
    const trend = start + ((end - start) * Math.pow(i / 11, 2.1));
    pts.push(clamp(trend + (rnd() - 0.45) * wiggle * (i % 2 === 0 ? 1 : -0.8), 60, 590));
  }
  pts[11] = end;
  return pts;
};
const BACK = makeSeries(8812, 200, 590, 200);
const FRONT = makeSeries(4471, 150, 550, 150);

// Story timing (frames).
const T_DRAW_START = 45;
const T_DRAW_END = 300;

const backProgress = (f: number) =>
  easeInOutCubic(clamp((f - T_DRAW_START) / (T_DRAW_END - T_DRAW_START - 16)));
const frontProgress = (f: number) =>
  easeInOutCubic(clamp((f - T_DRAW_START - 10) / (T_DRAW_END - T_DRAW_START - 16)));

// Staggered fade/scale-in for each element group.
const appear = (f: number, delay: number) => smoothstep(delay, delay + 14, f);

const BG_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const BG_FRAG = /* glsl */ `
uniform vec3 c0, c1, cGrid;
uniform float fade;
uniform float aspect;
varying vec2 vUv;
float gridLine(vec2 p, float cells, float w) {
  vec2 g = abs(fract(p * cells - 0.5) - 0.5) / fwidth(p * cells);
  float l = min(g.x, g.y);
  return 1.0 - clamp(l - w, 0.0, 1.0);
}
void main() {
  vec2 uv = vUv;
  // Deep navy, lit by a broad glow from the upper left and falling to
  // near black at the bottom and right.
  float glow = exp(-pow(length((uv - vec2(0.18, 0.95)) * vec2(1.0, 1.4)), 2.0) * 2.2);
  vec3 col = mix(c0 * 0.35, c1, glow);
  col *= mix(0.35, 1.0, smoothstep(0.0, 0.7, uv.y * 0.8 + (1.0 - uv.x) * 0.45));
  // Faint tile grid at 20 % with small "+" marks on the crossings.
  vec2 gp = uv * vec2(16.0, 9.0) * 2.0;
  float g = gridLine(uv * vec2(16.0, 9.0), 2.0, 0.6);
  vec2 f = abs(fract(gp - 0.5) - 0.5);
  float plus = (step(f.x, 0.012) * step(f.y, 0.07) + step(f.y, 0.012) * step(f.x, 0.07));
  col += cGrid * (g * 0.2 + min(plus, 1.0) * 0.35) * (0.4 + 0.6 * glow + 0.3);
  vec2 d = (uv - 0.5) * vec2(1.6, 1.2);
  col *= 1.0 - 0.5 * smoothstep(0.35, 0.95, length(d));
  gl_FragColor = vec4(col * fade, 1.0);
}
`;

const CHART_FRAG = /* glsl */ `
uniform float back[12];
uniform float front[12];
uniform float pBack;
uniform float pFront;
uniform float opacity;
uniform vec2 sizePx; // plot size in screen px, for line widths
varying vec2 vUv;
float seriesAt(float s[12], float x) {
  float fx = clamp(x, 0.0, 1.0) * 11.0;
  int i = int(min(floor(fx), 10.0));
  return mix(s[i], s[i + 1], fx - float(i));
}
float slopeAt(float s[12], float x) {
  float e = 0.0005;
  return (seriesAt(s, x + e) - seriesAt(s, x - e)) / (2.0 * e);
}
// Filled area, top edge and the soft leading edge for one series.
vec4 area(float s[12], float prog, float fillA, float edgeA) {
  float x = vUv.x;
  float y = vUv.y;
  float v = seriesAt(s, x);
  float px = 1.0 / sizePx.y;
  float aa = fwidth(y) * 1.2;
  float inside = 1.0 - smoothstep(v - aa, v + aa, y);
  float rev = 1.0 - smoothstep(prog - fwidth(x) * 1.5, prog + fwidth(x) * 1.5, x);
  // Distance to the top edge, in plot-height units, corrected for slope.
  float sl = slopeAt(s, x) * sizePx.y / sizePx.x;
  float dist = abs(y - v) / sqrt(1.0 + sl * sl);
  float lineW = 3.2 * px;
  float edge = 1.0 - smoothstep(lineW * 0.5, lineW * 0.5 + fwidth(y) * 1.2, dist);
  float glow = exp(-dist / (5.0 * px)) * 0.12;
  float a = (inside * fillA + edge * edgeA + glow * edgeA) * rev;
  // Leading edge: a soft bright vertical line while drawing.
  float lead = exp(-abs(x - prog) * sizePx.x / 10.0) * (1.0 - smoothstep(v, v + 0.03, y)) * step(0.001, prog) * (1.0 - step(0.999, prog));
  a += lead * 0.9;
  return vec4(vec3(1.0), a);
}
void main() {
  vec4 b = area(back, pBack, 0.22, 0.7);
  vec4 f = area(front, pFront, 0.42, 1.1);
  // Layer the two translucent areas like paint (not a plain sum), then
  // scale so the result sits as soft white over the blue.
  float a = (1.0 - (1.0 - clamp(b.a, 0.0, 1.0)) * (1.0 - clamp(f.a, 0.0, 1.0))) * opacity * 0.62;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(0.957, 0.98, 1.0) * a, 1.0);
}
`;

const SWEEP_FRAG = /* glsl */ `
uniform float t;
uniform float fade;
varying vec2 vUv;
void main() {
  // Two soft diagonal bands sliding across the plane.
  float d = vUv.x * 0.8 + vUv.y * 0.45;
  float b1 = exp(-pow((d - (-0.4 + t * 1.9)) / 0.09, 2.0));
  float b2 = exp(-pow((d - (-0.9 + t * 1.6)) / 0.06, 2.0)) * 0.7;
  vec3 c = vec3(0.35, 0.55, 1.0) * (b1 + b2) * 0.22 * fade;
  gl_FragColor = vec4(c, 1.0);
}
`;

const ink = (alpha = 1) => rgba(HUD.line, alpha);

// Static drawing for the chart frame: grid, axes and labels.
const drawChartFrame = (ctx: CanvasRenderingContext2D) => {
  const { x, y, w, h } = PLOT;
  grid(ctx, x, y, w, h, 11, 6, rgba(HUD.line, 0.45), 3);
  ctx.strokeStyle = HUD.white;
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, w, h);
  ctx.font = inter(38, 400);
  ctx.fillStyle = ink(0.9);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 6; i++) ctx.fillText(String(i * 100), x - 30, y + h - (h * i) / 6);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  MONTHS.forEach((m, i) => ctx.fillText(m, x + (w * i) / 11, y + h + 26));
  ctx.textAlign = "left";
};

const bars = makeBars(31, 12);
const bars2 = makeBars(32, 5);

// One HUD sub-panel inside the screen, in screen px.
type Sub = {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  delay: number;
  intensity?: number;
  drawStatic?: (ctx: CanvasRenderingContext2D) => void;
  widgets?: Widget[];
};

const L = CHART_FRAMES;

const SUBS: Sub[] = [
  {
    name: "chart-frame",
    x: 0,
    y: 0,
    w: SW,
    h: SH,
    delay: 4,
    intensity: 1.15,
    drawStatic: drawChartFrame,
  },
  // Mini bars and months along the top edge.
  {
    name: "top-bars",
    x: 1000,
    y: 120,
    w: 2700,
    h: 380,
    delay: 18,
    intensity: 1.1,
    drawStatic: (ctx) => {
      ctx.font = inter(36, 500);
      ctx.fillStyle = ink(0.85);
      ctx.textAlign = "center";
      MONTHS.forEach((m, i) => ctx.fillText(m, 110 + i * 225, 330));
      ctx.textAlign = "left";
      ctx.strokeStyle = ink(0.6);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 300);
      ctx.lineTo(2700, 300);
      ctx.stroke();
    },
    widgets: [
      {
        x: 0,
        y: 40,
        w: 2700,
        h: 250,
        key: (f) => String(Math.floor(f / 5)),
        draw: (ctx, f) => miniBars(ctx, 0, 90, 2700, 160, bars(Math.floor(f / 5) * 5, L, 0.25, 1), 0.5),
      },
    ],
  },
  // Left edge ring gauge with a counter.
  {
    name: "ring-left",
    x: 80,
    y: 380,
    w: 600,
    h: 520,
    delay: 10,
    intensity: 1.2,
    drawStatic: (ctx) => {
      textLines(ctx, 40, 470, 30, ["SYS 4.07"], ink(0.7), "inter");
    },
    widgets: [
      {
        x: 40,
        y: 0,
        w: 460,
        h: 460,
        key: (f) => `${counter2(51, f, 30, L)}:${Math.floor(f / 2)}`,
        draw: (ctx, f) => ringGauge(ctx, 230, 230, 190, counter2(51, f, 30, L), (f / L) * TAU * 1.5, 6),
      },
    ],
  },
  // Right edge ring gauge with "…".
  {
    name: "ring-right",
    x: 4000,
    y: 1780,
    w: 640,
    h: 640,
    delay: 22,
    intensity: 1.3,
    widgets: [
      {
        x: 0,
        y: 0,
        w: 640,
        h: 640,
        key: (f) => String(Math.floor(f / 2)),
        draw: (ctx, f) => {
          ctx.textBaseline = "top";
          ringGauge(ctx, 320, 340, 230, "…", -(f / L) * TAU * 1.2, 9);
          ctx.font = inter(40, 500);
          ctx.fillStyle = HUD.white;
          ctx.fillText("8921 0388", 150, 40);
          ctx.strokeStyle = HUD.white;
          ctx.lineWidth = 22;
          ctx.beginPath();
          ctx.arc(320, 320, 150, 0, TAU);
          ctx.stroke();
        },
      },
    ],
  },
  // Number boxes with two-digit counters.
  {
    name: "boxes",
    x: 1850,
    y: 1900,
    w: 1650,
    h: 260,
    delay: 26,
    intensity: 1.3,
    widgets: [0, 1, 2, 3].map((i) => ({
      x: 20 + i * 410,
      y: 30,
      w: 260,
      h: 190,
      key: (f: number) => counter2(600 + i, f, 30 + i * 15, L),
      draw: (ctx: CanvasRenderingContext2D, f: number) =>
        numberBox(ctx, 0, 0, 260, 190, counter2(600 + i, f, 30 + i * 15, L), 7),
    })),
  },
  // Code lines under the boxes.
  {
    name: "codes",
    x: 2700,
    y: 2210,
    w: 1100,
    h: 200,
    delay: 30,
    intensity: 1.2,
    widgets: [
      {
        x: 0,
        y: 0,
        w: 1100,
        h: 200,
        key: (f) => String(holdIndex(f, 45, L)),
        draw: (ctx, f) => {
          const c = codeLine(71, f, 45, L);
          textLines(ctx, 0, 10, 64, [c.digits, c.caps], HUD.white, "orbitron", 1.25);
        },
      },
    ],
  },
  // Bar indicator stack, lower left.
  {
    name: "bar-stack",
    x: 600,
    y: 1860,
    w: 1050,
    h: 520,
    delay: 34,
    intensity: 1.2,
    drawStatic: (ctx) => {
      triangle(ctx, 30, 30, 26, 1, HUD.white);
      textLines(ctx, 0, 455, 28, ["BETA     ALPHA"], ink(0.8), "inter");
      textLines(ctx, 520, 15, 26, ["589680   9867   2199"], ink(0.8), "inter");
    },
    widgets: [
      {
        x: 0,
        y: 70,
        w: 1050,
        h: 370,
        key: (f) => String(Math.floor(f / 6)),
        draw: (ctx, f) => barStack(ctx, 0, 0, 1000, 40, 34, bars2(Math.floor(f / 6) * 6, L, 0.35, 1), 26),
      },
    ],
  },
  // Code lines, top right.
  {
    name: "codes-top",
    x: 3550,
    y: 470,
    w: 900,
    h: 240,
    delay: 38,
    intensity: 1.1,
    widgets: [
      {
        x: 0,
        y: 0,
        w: 900,
        h: 240,
        key: (f) => String(holdIndex(f, 25, L)),
        draw: (ctx, f) => {
          const i = holdIndex(f, 25, L);
          const c = codeLine(81, f, 25, L);
          textLines(ctx, 0, 10, 40, [`${randomDigits(5, i, 3)} ${randomDigits(6, i, 3)} ${randomDigits(7, i, 4)} ${randomDigits(8, i, 2)}`, c.digits, c.caps], HUD.white, "orbitron", 1.3);
        },
      },
    ],
  },
  // Small side labels.
  {
    name: "labels-left",
    x: 120,
    y: 1000,
    w: 520,
    h: 700,
    delay: 14,
    intensity: 1.0,
    drawStatic: (ctx) => {
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = ink(0.7);
        ctx.fillRect(0, i * 110, 300 + (i % 3) * 60, 30);
      }
      ctx.font = orbitron(34, 500);
      ctx.fillStyle = ink(0.8);
      ctx.fillText("OUTPUT", 0, 690);
    },
  },
];

// Number clusters floating above three chart peaks.
const peakIdx = (() => {
  const idx = FRONT.map((v, i) => ({ v: Math.max(v, BACK[i]), i }))
    .filter((p) => p.i > 0 && p.i < 11)
    .sort((a, b) => b.v - a.v);
  const pick: number[] = [];
  for (const p of idx) if (pick.every((q) => Math.abs(q - p.i) > 2) && pick.length < 3) pick.push(p.i);
  return pick.sort((a, b) => a - b);
})();

const factory: SceneFactory<null> = ({ renderer, width, height }) => {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const scene = new THREE.Scene();
  const screen = new THREE.Group();
  screen.rotation.set(THREE.MathUtils.degToRad(-22), THREE.MathUtils.degToRad(18), 0, "YXZ");
  scene.add(screen);

  const lin = (h: string) => {
    const c = new THREE.Color(h);
    return new THREE.Vector3(c.r, c.g, c.b);
  };
  const bgU = {
    aspect: { value: 16 / 9 },
    c0: { value: lin("#0A2A5A") },
    c1: { value: lin("#1A4A8A") },
    cGrid: { value: lin("#3A6AB8") },
    fade: { value: 0 },
  };
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(SW / PPU * 1.6, SH / PPU * 1.6),
    new THREE.ShaderMaterial({ vertexShader: BG_VERT, fragmentShader: BG_FRAG, uniforms: bgU }),
  );
  bg.position.z = -0.01;
  screen.add(bg);

  const toWorld = (x: number, y: number) =>
    new THREE.Vector3(x / PPU - SW / PPU / 2, -(y / PPU - SH / PPU / 2), 0);

  const texScale = Math.max(0.3, (height / 2160) * 1.1);
  const subs = SUBS.map((s, i) => {
    const p = new HudPanel({
      w4k: s.w,
      h4k: s.h,
      worldW: s.w / PPU,
      texScale,
      anisotropy: aniso,
      drawStatic: s.drawStatic,
      widgets: s.widgets,
      intensity: s.intensity ?? 1.2,
      tint: "#CFE4FF",
    });
    const c = toWorld(s.x + s.w / 2, s.y + s.h / 2);
    p.group.position.set(c.x, c.y, 0.002 * (i + 1));
    screen.add(p.group);
    return { spec: s, panel: p };
  });

  // Number clusters above peaks (appear as the chart reaches them).
  const clusters = peakIdx.map((pi, k) => {
    const x = PLOT.x + (PLOT.w * pi) / 11 - 200;
    const v = Math.max(FRONT[pi], BACK[pi]);
    const y = PLOT.y + PLOT.h * (1 - v / 600) - 230;
    const p = new HudPanel({
      w4k: 520,
      h4k: 180,
      worldW: 520 / PPU,
      texScale,
      anisotropy: aniso,
      intensity: 1.3,
      tint: "#CFE4FF",
      widgets: [
        {
          x: 0,
          y: 0,
          w: 520,
          h: 180,
          key: (f) => String(holdIndex(f, 30, L)),
          draw: (ctx, f) => {
            const i = holdIndex(f, 30, L);
            const c = codeLine(300 + k, f, 30, L);
            textLines(ctx, 0, 6, 34, [`${randomDigits(400 + k, i, 3)} ${randomDigits(410 + k, i, 3)} ${randomDigits(420 + k, i, 4)} ${randomDigits(430 + k, i, 2)}`, c.digits.slice(0, 15)], HUD.white, "inter", 1.25);
            ctx.font = inter(28, 600);
            ctx.fillStyle = ink(0.8);
            ctx.fillText(c.caps, 0, 110);
          },
        },
      ],
    });
    const c = toWorld(x + 260, Math.max(PLOT.y + 40, y) + 90);
    p.group.position.set(c.x, c.y, 0.03 + 0.002 * k);
    screen.add(p.group);
    return { panel: p, at: pi / 11 };
  });

  // Chart areas, drawn in a shader.
  const chartU = {
    back: { value: BACK.map((v) => v / 600) },
    front: { value: FRONT.map((v) => v / 600) },
    pBack: { value: 0 },
    pFront: { value: 0 },
    opacity: { value: 1 },
    sizePx: { value: new THREE.Vector2(PLOT.w, PLOT.h) },
  };
  const chart = new THREE.Mesh(
    new THREE.PlaneGeometry(PLOT.w / PPU, PLOT.h / PPU),
    new THREE.ShaderMaterial({
      vertexShader: BG_VERT,
      fragmentShader: CHART_FRAG,
      uniforms: chartU,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: true,
    }),
  );
  const cc = toWorld(PLOT.x + PLOT.w / 2, PLOT.y + PLOT.h / 2);
  chart.position.set(cc.x, cc.y, 0.025);
  screen.add(chart);

  const sweepU = { t: { value: 0 }, fade: { value: 0 } };
  const sweep = new THREE.Mesh(
    new THREE.PlaneGeometry(SW / PPU * 1.6, SH / PPU * 1.6),
    new THREE.ShaderMaterial({
      vertexShader: BG_VERT,
      fragmentShader: SWEEP_FRAG,
      uniforms: sweepU,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sweep.position.z = 0.06;
  screen.add(sweep);

  const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 60);
  const chartCentre = toWorld(PLOT.x + PLOT.w / 2 - 80, PLOT.y + PLOT.h / 2 + 330);

  const post = new PostChain(renderer, width, height, {
    dof: { aperture: 30, maxCoc: 20, nearScale: 1.0 },
    bloom: { threshold: 1.1, knee: 0.5, intensity: 0.12 },
    grade: { exposure: 1.0, tint: [0.98, 1.0, 1.02], lift: [0.0, 0.0, 0.004], saturation: 1.0, contrast: 1.08 },
    vignette: { strength: 0.45, radius: 0.42, softness: 0.7 },
    grain: 0.015,
    loop: CHART_FRAMES,
    clearColor: 0x020a18,
  });

  const target = new THREE.Vector3();
  return {
    render(frame) {
      const f = frame;
      const s = f / (L - 1);
      // Fade-up and staggered element entrances.
      bgU.fade.value = appear(f, 0);
      for (const { spec, panel } of subs) {
        const a = appear(f, spec.delay);
        panel.opacity = a;
        const sc = 0.94 + 0.06 * a;
        panel.group.scale.set(sc, sc, 1);
        panel.update(f);
      }
      const pb = backProgress(f);
      const pf = frontProgress(f);
      chartU.pBack.value = pb;
      chartU.pFront.value = pf;
      chartU.opacity.value = appear(f, 8);
      for (const c of clusters) {
        const a = smoothstep(c.at - 0.02, c.at + 0.06, pb);
        c.panel.opacity = a;
        c.panel.update(f);
      }
      sweepU.t.value = (f % 225) / 225;
      sweepU.fade.value = appear(f, 20);

      // Camera: slow drift, about 5 % push-in and a slight yaw.
      screen.updateMatrixWorld();
      target.copy(chartCentre).applyMatrix4(screen.matrixWorld);
      const e = 0.5 - 0.5 * Math.cos(Math.PI * s);
      const dist = 13.8 * (1 - 0.05 * e);
      const yaw = THREE.MathUtils.degToRad(-1.2 + 2.4 * e);
      camera.position.set(target.x + Math.sin(yaw) * dist, target.y + 0.35, target.z + Math.cos(yaw) * dist);
      camera.lookAt(target.x, target.y + 0.1, target.z);
      camera.updateMatrixWorld();
      post.render(scene, camera, f, camera.position.distanceTo(target));
    },
    dispose() {
      post.dispose();
    },
  };
};

const load = async () => {
  await loadFonts(staticFile);
  return null;
};

export const GrowthChart = () => {
  const l = useCallback(load, []);
  return <GLStage load={l} factory={factory} />;
};

