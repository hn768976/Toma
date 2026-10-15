import { Container, Sprite } from "pixi.js";
import { canvasTexture, makeCanvas } from "../engine/bake";
import { GLSL_COMMON, Pass, drawInto } from "../engine/gl";
import { hexToRgb, type Grade } from "../engine/post";
import { mulberry32, range, type Rng } from "../engine/rng";
import type { LookFactory } from "../engine/types";

// ---------------------------------------------------------------------------
// Look 5 — City Bokeh. Prebaked lens-bokeh discs (bright rim, faint onion
// rings and lens dust, slight chromatic fringe) on three depth layers that
// drift sideways a whole number of layout widths per loop; each disc fades
// in and out on a schedule whose period divides 600 frames.
// ---------------------------------------------------------------------------

export type BokehParams = {
  seed: number;
  bgTop: string;
  bgBottom: string;
  glow: string; // street-level glow
  blob: string; // a big, very soft far light (top-left)
  colors: { c: string; w: number }[];
};

const BG = /* glsl */ `
${GLSL_COMMON}
in vec2 vUV; out vec4 o;
uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uGlow; uniform vec3 uBlob;
uniform float uPhase; uniform float uAspect;
void main() {
  vec2 p = vUV;
  vec3 col = mix(uTop * 0.75, uBottom, smoothstep(0.3, 1.0, p.y));
  // faint warm glow along the lower third (street level), slowly breathing
  float band = exp(-pow((p.y - 0.78) / 0.16, 2.0));
  float n = fbmP(vec2(p.x * 3.0 + cos(TAU * uPhase) * 0.4, p.y * 2.0 + sin(TAU * uPhase) * 0.2), vec2(4096.0), 4);
  col += uGlow * band * (0.55 + 0.6 * n);
  // a big defocused far light in the upper left
  vec2 d = (p - vec2(0.12 + 0.02 * sin(TAU * uPhase), 0.1)) * vec2(uAspect, 1.0);
  col += uBlob * 0.7 * exp(-dot(d, d) / 0.04);
  o = vec4(col, 1.0);
}`;

const bakeDisc = (rng: Rng, D: number, px: number) => {
  const S = Math.ceil(D * 1.08) + 4;
  const { c, g } = makeCanvas(S, S);
  const cx = S / 2;
  const r = D / 2;
  const soft = Math.max(1, 3.2 * px) / r; // edge softness as a fraction of r
  g.globalCompositeOperation = "lighter";
  // one pass per channel with slightly different radii -> chromatic fringe
  const chans: [string, number][] = [
    ["255,0,0", 1.006],
    ["0,255,0", 1.0],
    ["0,0,255", 0.992],
  ];
  for (const [rgb, k] of chans) {
    const R = r * k;
    const gr = g.createRadialGradient(cx, cx, 0, cx, cx, R);
    gr.addColorStop(0, `rgba(${rgb},0.80)`);
    gr.addColorStop(0.7, `rgba(${rgb},0.82)`);
    gr.addColorStop(Math.max(0.75, 0.97 - soft * 2), `rgba(${rgb},0.95)`);
    gr.addColorStop(Math.max(0.8, 1 - soft), `rgba(${rgb},1)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cx, cx, R, 0, Math.PI * 2);
    g.fill();
  }
  // faint onion rings
  g.globalCompositeOperation = "source-atop";
  for (let i = 0; i < 5; i++) {
    g.strokeStyle = `rgba(0,0,0,${range(rng, 0.008, 0.02)})`;
    g.lineWidth = Math.max(1, r * 0.03);
    g.beginPath();
    g.arc(cx + range(rng, -0.02, 0.02) * r, cx + range(rng, -0.02, 0.02) * r, r * (0.25 + i * 0.13), 0, Math.PI * 2);
    g.stroke();
  }
  // lens dust: a few faint darker specks inside the disc
  for (let i = 0; i < 10; i++) {
    const a = range(rng, 0, Math.PI * 2);
    const rr = Math.sqrt(rng()) * r * 0.85;
    g.fillStyle = `rgba(0,0,0,${range(rng, 0.02, 0.05)})`;
    g.beginPath();
    g.arc(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr, r * range(rng, 0.02, 0.06), 0, Math.PI * 2);
    g.fill();
  }
  return c;
};

const LAYERS = [
  // count, diameter range (fraction of H), alpha range, turns per loop, layout width (x W), y range
  { n: 40, d: [0.06, 0.13], a: [0.03, 0.25], turns: 1, lw: 1.15, y: [0.15, 0.8] },
  { n: 25, d: [0.13, 0.22], a: [0.08, 0.6], turns: 1, lw: 1.5, y: [0.2, 0.8] },
  { n: 12, d: [0.22, 0.32], a: [0.12, 1.0], turns: 2, lw: 1.35, y: [0.3, 0.75] },
];
const PERIODS = [600, 300, 200, 150, 120]; // fade schedules divide 600

type Disc = {
  s: Sprite;
  layer: number;
  x0: number;
  y: number;
  bobA: number;
  bobPh: number;
  d: number;
  a: number;
  per: number;
  fadePh: number;
  fadeDepth: number;
};

export const createBokeh: LookFactory<BokehParams> = (ctx, params) => {
  const { W, H, px, ph } = ctx;
  const rng = mulberry32(params.seed);
  const v3 = (hex: string) => new Float32Array(hexToRgb(hex));
  const bg = new Pass("bokeh-bg", BG, {
    uTop: { value: v3(params.bgTop), type: "vec3<f32>" },
    uBottom: { value: v3(params.bgBottom), type: "vec3<f32>" },
    uGlow: { value: v3(params.glow), type: "vec3<f32>" },
    uBlob: { value: v3(params.blob), type: "vec3<f32>" },
    uPhase: { value: 0, type: "f32" },
    uAspect: { value: W / H, type: "f32" },
  });

  // a few disc variants baked at the largest on-screen size
  const Dmax = 0.32 * ph;
  const discTex = Array.from({ length: 4 }, () => canvasTexture(bakeDisc(rng, Dmax, px)));
  const texPx = Dmax; // diameter in texture px

  const totalW = params.colors.reduce((a, c) => a + c.w, 0);
  const pickColor = () => {
    let t = rng() * totalW;
    for (const c of params.colors) {
      t -= c.w;
      if (t <= 0) return c.c;
    }
    return params.colors[0].c;
  };

  const stage = new Container();
  const discs: Disc[] = [];
  LAYERS.forEach((L, li) => {
    for (let i = 0; i < L.n; i++) {
      const s = new Sprite(discTex[Math.floor(rng() * discTex.length)]);
      s.anchor.set(0.5);
      s.blendMode = "add";
      s.tint = pickColor();
      stage.addChild(s);
      discs.push({
        s,
        layer: li,
        x0: (i + range(rng, 0.1, 0.9)) / L.n, // stratified so discs spread out
        y: range(rng, L.y[0], L.y[1]),
        bobA: range(rng, 0.003, 0.012),
        bobPh: range(rng, 0, Math.PI * 2),
        d: range(rng, L.d[0], L.d[1]),
        a: L.a[0] + (L.a[1] - L.a[0]) * rng() ** 3.2, // mostly dim, a few bright
        per: PERIODS[Math.floor(rng() * PERIODS.length)],
        fadePh: rng(),
        fadeDepth: range(rng, 0.3, 1.0),
      });
    }
  });

  const grade: Grade = { mode: "rgb", bloom: 0.3, vignette: 0.45, vignetteShape: [0.45, 1.15], grain: 0.015, toneMap: true };
  ctx.post.setGrade(grade);
  const TAU = Math.PI * 2;

  return {
    render(f) {
      const phase = f / 600;
      bg.uniforms.uPhase = phase;
      bg.run(ctx.renderer, ctx.post.hdr);
      for (const d of discs) {
        const L = LAYERS[d.layer];
        const lw = L.lw * W;
        const margin = (lw - W) / 2;
        // drift right-to-left by `turns` layout widths per loop, wrapping
        let x = (d.x0 - L.turns * phase) % 1;
        if (x < 0) x += 1;
        const sx = x * lw - margin;
        const sy = (d.y + d.bobA * Math.sin(TAU * phase + d.bobPh)) * H;
        // soft fade in/out on a schedule dividing 600
        const t = ((f / d.per + d.fadePh) % 1 + 1) % 1;
        const pulse = 0.5 - 0.5 * Math.cos(TAU * t);
        const fade = 1 - d.fadeDepth * (1 - pulse * pulse * (3 - 2 * pulse));
        d.s.position.set(sx, sy);
        d.s.scale.set((d.d * H * ctx.res) / texPx / ctx.res);
        d.s.alpha = d.a * fade;
      }
      drawInto(ctx.renderer, stage, ctx.post.hdr, false);
      ctx.post.present(f);
    },
  };
};
