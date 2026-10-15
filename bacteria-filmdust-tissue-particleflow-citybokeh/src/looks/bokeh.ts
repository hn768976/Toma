import { Container, Sprite } from "pixi.js";
import { blurred, canvasTexture, makeCanvas } from "../engine/bake";
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
  front: string[]; // the near, bright headlight discs
};

const BG = /* glsl */ `
${GLSL_COMMON}
in vec2 vUV; out vec4 o;
uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uGlow; uniform vec3 uBlob;
uniform float uPhase; uniform float uAspect;
void main() {
  vec2 p = vUV;
  vec3 col = mix(uTop * 0.3, uBottom * 0.85, smoothstep(0.4, 1.0, p.y));
  // faint glow along the lower third (street level), slowly breathing
  float band = exp(-pow((p.y - 0.62) / 0.2, 2.0));
  float n = fbmP(vec2(p.x * 3.0 + cos(TAU * uPhase) * 0.4, p.y * 2.0 + sin(TAU * uPhase) * 0.2), vec2(4096.0), 4);
  col += uGlow * band * (0.3 + 0.5 * n);
  // a darker horizontal band (the far kerb) and soft blotches
  col *= 1.0 - 0.35 * exp(-pow((p.y - 0.55) / 0.05, 2.0));
  col *= 0.8 + 0.4 * fbmP(p * vec2(5.0, 3.0) + 31.0 + vec2(cos(TAU * uPhase), sin(TAU * uPhase)) * 0.2, vec2(4096.0), 3);
  // a big defocused far light in the upper left
  vec2 d = (p - vec2(0.12 + 0.02 * sin(TAU * uPhase), 0.1)) * vec2(uAspect, 1.0);
  col += uBlob * 0.4 * smoothstep(0.32, 0.12, length(d * vec2(0.9, 1.3)));
  // a large soft dark silhouette mid-left (a passing car / street furniture)
  vec2 sdk = (p - vec2(0.33 + 0.03 * sin(TAU * uPhase), 0.42)) * vec2(uAspect * 0.6, 1.4);
  col *= 1.0 - 0.55 * exp(-dot(sdk, sdk) / 0.03);
  // keep the shadows' colour cast (saturated, never neutral grey)
  col = max(mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, 1.7), 0.0);
  o = vec4(col, 1.0);
}`;

const bakeDisc = (rng: Rng, D: number, px: number) => {
  const S = Math.ceil(D * 1.08) + 4;
  const { c, g } = makeCanvas(S, S);
  const cx = S / 2;
  const r = D / 2;
  const soft = Math.max(1, 6.5 * px) / r; // edge softness as a fraction of r
  g.globalCompositeOperation = "lighter";
  // one pass per channel with slightly different radii -> chromatic fringe
  const chans: [string, number][] = [
    ["255,0,0", 1.003],
    ["0,255,0", 1.0],
    ["0,0,255", 0.997],
  ];
  for (const [rgb, k] of chans) {
    const R = r * k;
    const gr = g.createRadialGradient(cx, cx, 0, cx, cx, R);
    gr.addColorStop(0, `rgba(${rgb},0.86)`);
    gr.addColorStop(0.7, `rgba(${rgb},0.87)`);
    gr.addColorStop(Math.max(0.7, 0.97 - soft * 2.2), `rgba(${rgb},0.97)`);
    gr.addColorStop(Math.max(0.78, 1 - soft * 1.2), `rgba(${rgb},0.95)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cx, cx, R, 0, Math.PI * 2);
    g.fill();
  }
  // faint onion rings
  g.globalCompositeOperation = "source-atop";
  for (let i = 0; i < 5; i++) {
    g.strokeStyle = `rgba(0,0,0,${range(rng, 0.004, 0.01)})`;
    g.lineWidth = Math.max(1, r * 0.03);
    g.beginPath();
    g.arc(cx + range(rng, -0.02, 0.02) * r, cx + range(rng, -0.02, 0.02) * r, r * (0.25 + i * 0.13), 0, Math.PI * 2);
    g.stroke();
  }
  // lens dust: a few faint darker specks inside the disc
  for (let i = 0; i < 10; i++) {
    const a = range(rng, 0, Math.PI * 2);
    const rr = Math.sqrt(rng()) * r * 0.85;
    g.fillStyle = `rgba(0,0,0,${range(rng, 0.01, 0.025)})`;
    g.beginPath();
    g.arc(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr, r * range(rng, 0.02, 0.06), 0, Math.PI * 2);
    g.fill();
  }
  return c;
};

type LayerDef = { n: number; d: number[]; a: number[]; turns: number; lw: number; y: number[]; soft: boolean };
const LAYERS: LayerDef[] = [
  // count, diameter range (fraction of H), alpha range, turns per loop, layout width (x W), y range
  { n: 40, d: [0.1, 0.18], a: [0.006, 0.025], turns: 1, lw: 1.15, y: [0.3, 0.8], soft: true },
  { n: 25, d: [0.2, 0.28], a: [0.01, 0.06], turns: 1, lw: 1.5, y: [0.35, 0.8], soft: true },
  { n: 12, d: [0.3, 0.36], a: [0.45, 1.0], turns: 2, lw: 2.4, y: [0.32, 0.7], soft: false },
];
const PERIODS = [600, 300, 200, 150, 120];
const smooth01 = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}; // fade schedules divide 600

type Disc = {
  s: Sprite;
  refl?: Sprite;
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
  const Dmax = 0.36 * ph;
  const discCanvases = Array.from({ length: 4 }, () => bakeDisc(rng, Dmax, px));
  const discTex = discCanvases.map((c) => canvasTexture(c));
  // softer variants for the far layers (less defined edges)
  const softTex = discCanvases.map((c) => canvasTexture(blurred(c, Dmax * 0.035)));
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

  const pickFront = () => params.front[Math.floor(rng() * params.front.length)];
  const stage = new Container();
  const discs: Disc[] = [];
  LAYERS.forEach((L, li) => {
    for (let i = 0; i < L.n; i++) {
      const vi = Math.floor(rng() * discTex.length);
      const s = new Sprite(L.soft ? softTex[vi] : discTex[vi]);
      s.anchor.set(0.5);
      // front discs occlude rather than sum (screen); back layers add faintly
      s.blendMode = li === 2 ? "screen" : "add";
      const front = li === 2;
      // front discs come in touching pairs (two lanes of headlights), a third of them bright
      const hero = front && Math.floor(i / 2) % 2 === 0; // bright pairs: one cool, one neutral
      s.tint = front ? (hero ? params.front[i % 2] : pickFront()) : pickColor();
      stage.addChild(s);
      let refl: Sprite | undefined;
      if (hero) {
        refl = new Sprite(softTex[vi]);
        refl.anchor.set(0.5, 0);
        refl.blendMode = "add";
        refl.tint = s.tint;
        stage.addChild(refl);
      }
      const pairBase = Math.floor(i / 2) / Math.ceil(L.n / 2);
      discs.push({
        s,
        refl,
        layer: li,
        x0: front ? (pairBase + (i % 2) * 0.095 + range(rng, 0, 0.01)) % 1 : (i + range(rng, 0.1, 0.9)) / L.n,
        y: front ? (hero ? range(rng, 0.6, 0.68) : range(rng, 0.27, 0.36)) : range(rng, L.y[0], L.y[1]),
        bobA: range(rng, 0.003, 0.012),
        bobPh: range(rng, 0, Math.PI * 2),
        d: range(rng, L.d[0], L.d[1]),
        a: front ? (hero ? range(rng, 0.85, 1.0) : range(rng, 0.12, 0.32)) : L.a[0] + (L.a[1] - L.a[0]) * rng() ** 0.8,
        per: PERIODS[Math.floor(rng() * PERIODS.length)],
        fadePh: rng(),
        fadeDepth: range(rng, 0.3, 1.0),
      });
    }
  });

  const grade: Grade = { mode: "rgb", exposure: 1.0, bloom: 0.3, vignette: 0.45, vignetteShape: [0.45, 1.15], grain: 0.015, toneMap: true };
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
        // lights cluster on the right of the street; they fade out towards the left
        const side = 0.25 + 0.75 * smooth01((sx / W - 0.15) / 0.45);
        d.s.alpha = d.a * fade * side;
        if (d.refl) {
          // a faint vertical smear reflected on the wet street below the light
          const sc = (d.d * H) / texPx;
          d.refl.position.set(sx, sy + d.d * H * 0.6);
          d.refl.scale.set(sc * 0.8, sc * 0.45);
          d.refl.alpha = d.s.alpha * 0.07;
        }
      }
      drawInto(ctx.renderer, stage, ctx.post.hdr, false);
      ctx.post.present(f);
    },
  };
};
