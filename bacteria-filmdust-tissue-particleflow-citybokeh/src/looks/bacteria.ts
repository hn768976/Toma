import { Container, Sprite, type Texture } from "pixi.js";
import { blurred, canvasTexture, makeCanvas } from "../engine/bake";
import { GLSL_COMMON, Pass, drawInto } from "../engine/gl";
import type { Grade } from "../engine/post";
import { mulberry32, range, type Rng } from "../engine/rng";
import type { LookFactory } from "../engine/types";

// ---------------------------------------------------------------------------
// Look 1 — Bacteria Chains. A dark-field microscope view rendered as a single
// luminance channel (the grade maps it through a one-colour ramp):
//   * background shader: mottled fractal field + drifting hazy bright patch
//   * ~900 prebaked sprites (beaded chains, clumps, specks) on 4 focus layers
//   * focus breathing: each sprite crossfades between prebaked blur levels
// Every motion term is a whole-cycle function of the loop phase.
// ---------------------------------------------------------------------------

export type BacteriaParams = {
  ramp: [string, string, string, string, string];
  seed: number;
};

const BG = /* glsl */ `
${GLSL_COMMON}
in vec2 vUV; out vec4 o;
uniform float uPhase;
uniform float uAspect;

float fbm(vec2 p, int oct) { return fbmP(p, vec2(4096.0), oct); }

void main() {
  float ph = uPhase;
  vec2 p = (vUV - 0.5) * vec2(uAspect, 1.0);
  vec2 cyc = vec2(cos(TAU * ph), sin(TAU * ph));
  // blotchy, cellular dark field (smeared out-of-focus cells), closed drift
  vec2 q = p * 2.6 + cyc * 0.3 + 40.0;
  vec2 w = vec2(fbm(q * 0.8 + 3.0, 4), fbm(q * 0.8 + 9.0, 4)) - 0.5;
  float m = fbm(q + w * 1.6, 5);
  float blobs = smoothstep(0.42, 0.68, fbm(q * 2.2 + w * 2.0 + 21.0, 4));
  float field = 0.03 + 0.34 * smoothstep(0.38, 0.75, m) + 0.16 * blobs * smoothstep(0.3, 0.6, m);
  // crushed near-black patches
  field *= smoothstep(0.30, 0.52, fbm(q * 1.1 - w + 5.0, 4));

  // the hazy pink cloud: wide (about 2.5:1), mottled, ragged edges; drifts and swells
  vec2 c = vec2(0.30, -0.06) + vec2(0.10 * sin(TAU * ph), 0.04 * sin(TAU * 2.0 * ph + 1.0));
  float size = 0.17 + 0.04 * (0.5 - 0.5 * cos(TAU * ph));
  vec2 d = (p - c) / vec2(size * 2.4, size);
  float edge = fbm(p * 3.5 + cyc * 0.3 + 70.0, 5) - 0.5;
  float r = length(d) + edge * 1.1;
  float haze = smoothstep(1.1, 0.45, r);
  float mottle = 0.62 + 0.38 * smoothstep(0.3, 0.7, fbm(p * 7.0 + w * 1.5 + 90.0, 4));
  float lum = field * (1.0 - 0.5 * haze) + haze * 0.92 * mottle;
  o = vec4(vec3(lum), 1.0);
}`;

const BLUR_LEVELS = [0, 1.5, 4, 9]; // in 720p pixels
const N_CHAIN_VARIANTS = 12;
const N_CLUMP_VARIANTS = 8;
const N_SPECK_VARIANTS = 3;
const LAYERS = 4;
// per layer: scale, brightness, drift radius (fraction of W), rotation amplitude (rad)
const LAYER_DEF = [
  { scale: 1.6, bright: 0.85, drift: 0.11, rot: 0.06 },
  { scale: 1.2, bright: 0.9, drift: 0.08, rot: 0.05 },
  { scale: 0.92, bright: 0.85, drift: 0.06, rot: 0.04 },
  { scale: 0.7, bright: 0.7, drift: 0.045, rot: 0.03 },
];
const BEAD_R = 6.6; // bead radius at 720p for scale 1

type Variant = { levels: Texture[] };

const drawBead = (g: CanvasRenderingContext2D, x: number, y: number, r: number, rng: Rng) => {
  // dark-field cell: dim body, bright rim, soft outer halo
  const gr = g.createRadialGradient(x, y, 0, x, y, r * 1.25);
  const core = range(rng, 0.06, 0.2);
  const rim = range(rng, 0.75, 1.0);
  gr.addColorStop(0, `rgba(255,255,255,${core})`);
  gr.addColorStop(0.45, `rgba(255,255,255,${core * 1.1})`);
  gr.addColorStop(0.7, `rgba(255,255,255,${rim})`);
  gr.addColorStop(0.86, `rgba(255,255,255,${rim * 0.4})`);
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  // slightly oval, irregular cells
  g.save();
  g.translate(x, y);
  g.rotate(range(rng, 0, Math.PI));
  g.scale(range(rng, 0.85, 1.15), range(rng, 0.8, 1.05));
  g.translate(-x, -y);
  g.beginPath();
  g.arc(x, y, r * 1.25, 0, Math.PI * 2);
  g.fill();
  g.restore();
};

const bakeChain = (rng: Rng, r: number) => {
  const n = Math.floor(4 + 16 * rng() ** 2); // mostly short chains, a few long
  const pts: [number, number][] = [];
  let a = range(rng, 0, Math.PI * 2);
  const curl = range(rng, -0.2, 0.2);
  const wig = range(rng, 0.05, 0.35);
  const ph = range(rng, 0, 6.28);
  let x = 0;
  let y = 0;
  for (let i = 0; i < n; i++) {
    pts.push([x, y]);
    a += curl + wig * Math.sin(i * 0.7 + ph);
    const step = r * range(rng, 1.7, 1.95);
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = r * 2;
  const minx = Math.min(...xs) - pad;
  const miny = Math.min(...ys) - pad;
  const { c, g } = makeCanvas(Math.max(...xs) - minx + pad, Math.max(...ys) - miny + pad);
  g.globalCompositeOperation = "lighter";
  for (const [px, py] of pts) drawBead(g, px - minx, py - miny, r * range(rng, 0.88, 1.08), rng);
  return c;
};

const bakeClump = (rng: Rng, r: number) => {
  const n = Math.floor(range(rng, 6, 32));
  const pts: [number, number][] = [[0, 0]];
  for (let i = 1; i < n; i++) {
    const [bx, by] = pts[Math.floor(rng() * pts.length)];
    const a = range(rng, 0, Math.PI * 2);
    pts.push([bx + Math.cos(a) * r * 1.8, by + Math.sin(a) * r * 1.8]);
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = r * 2;
  const minx = Math.min(...xs) - pad;
  const miny = Math.min(...ys) - pad;
  const { c, g } = makeCanvas(Math.max(...xs) - minx + pad, Math.max(...ys) - miny + pad);
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = 0.75;
  for (const [px, py] of pts) drawBead(g, px - minx, py - miny, r * range(rng, 0.8, 1.15), rng);
  return c;
};

const bakeSpeck = (rng: Rng, r: number) => {
  const { c, g } = makeCanvas(r * 4, r * 4);
  const gr = g.createRadialGradient(r * 2, r * 2, 0, r * 2, r * 2, r * range(rng, 0.9, 1.6));
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, r * 4, r * 4);
  return c;
};

type Obj = {
  variant: Variant;
  layer: number;
  x: number; // in field units (0..1 of field)
  y: number;
  rot: number;
  rotAmp: number;
  rotK: number;
  rotPh: number;
  wobR: number;
  wobK: number;
  wobPh: number;
  scale: number;
  bright: number;
  a: Sprite;
  b: Sprite;
};

export const createBacteria: LookFactory<BacteriaParams> = (ctx, params) => {
  const rng = mulberry32(params.seed);
  const { W, H, px } = ctx;
  const maxScale = Math.max(...LAYER_DEF.map((l) => l.scale));
  const bakeR = BEAD_R * px * maxScale; // texture bead radius in output pixels at the largest layer scale

  const mkVariant = (src: HTMLCanvasElement): Variant => ({
    levels: BLUR_LEVELS.map((b) => canvasTexture(blurred(src, b * px * maxScale))),
  });
  const chains = Array.from({ length: N_CHAIN_VARIANTS }, () => mkVariant(bakeChain(rng, bakeR)));
  const clumps = Array.from({ length: N_CLUMP_VARIANTS }, () => mkVariant(bakeClump(rng, bakeR)));
  const specks = Array.from({ length: N_SPECK_VARIANTS }, () => mkVariant(bakeSpeck(rng, bakeR * 0.35)));

  const bg = new Pass("bacteria-bg", BG, {
    uPhase: { value: 0, type: "f32" },
    uAspect: { value: W / H, type: "f32" },
  });

  const stage = new Container();
  const layerContainers = LAYER_DEF.map(() => new Container());
  // back layers first
  for (let i = LAYERS - 1; i >= 0; i--) stage.addChild(layerContainers[i]);

  const objs: Obj[] = [];
  const counts = [
    { kind: "chain", n: 12 },
    { kind: "clump", n: 18 },
    { kind: "speck", n: 195 },
  ];
  for (let L = 0; L < LAYERS; L++) {
    for (const { kind, n } of counts) {
      for (let i = 0; i < n; i++) {
        const pool = kind === "chain" ? chains : kind === "clump" ? clumps : specks;
        const variant = pool[Math.floor(rng() * pool.length)];
        const mk = () => {
          const s = new Sprite(variant.levels[0]);
          s.anchor.set(0.5);
          s.blendMode = "add";
          layerContainers[L].addChild(s);
          return s;
        };
        objs.push({
          variant,
          layer: L,
          ...(kind === "speck" && rng() < 0.55
            ? { x: 0.5 + (rng() + rng() + rng() - 1.5) * 0.22 - 0.07, y: 0.5 + (rng() + rng() + rng() - 1.5) * 0.22 - 0.05 }
            : { x: rng(), y: rng() }),
          rot: range(rng, 0, Math.PI * 2),
          rotAmp: range(rng, 0.1, 0.6),
          rotK: rng() < 0.5 ? 1 : 2,
          rotPh: range(rng, 0, Math.PI * 2),
          wobR: range(rng, 0.004, 0.02),
          wobK: rng() < 0.6 ? 1 : 2,
          wobPh: range(rng, 0, Math.PI * 2),
          scale: range(rng, 0.75, 1.2) * (kind === "speck" ? range(rng, 0.35, 0.9) : 1),
          bright: kind === "chain" ? range(rng, 0.7, 1.3) : kind === "clump" ? range(rng, 0.4, 0.9) : range(rng, 0.8, 1.7),
          a: mk(),
          b: mk(),
        });
      }
    }
  }
  const layerPh = LAYER_DEF.map(() => range(rng, 0, Math.PI * 2));

  const grade: Grade = {
    mode: "ramp",
    ramp: params.ramp,
    stops: [0.22, 0.55, 0.95, 1.6],
    exposure: 1.0,
    bloom: 0.15,
    vignette: 0.75,
    vignetteShape: [0.35, 1.1],
    grain: 0.018,
  };
  ctx.post.setGrade(grade);

  const TAU = Math.PI * 2;
  const fieldW = W * 1.5;
  const fieldH = H * 1.5;

  return {
    render(f) {
      const ph = f / 600;
      bg.uniforms.uPhase = ph;
      bg.run(ctx.renderer, ctx.post.hdr);

      // focus breathes from layer 1 to layer 3 (1-based) and back
      const focus = 2 - Math.cos(TAU * ph); // 1..3
      for (let L = 0; L < LAYERS; L++) {
        const def = LAYER_DEF[L];
        const lc = layerContainers[L];
        lc.pivot.set(W / 2, H / 2);
        lc.position.set(
          W / 2 + Math.cos(TAU * ph + layerPh[L]) * def.drift * W,
          H / 2 + Math.sin(TAU * ph + layerPh[L]) * def.drift * W * 0.6,
        );
        lc.rotation = def.rot * Math.sin(TAU * ph + layerPh[L] * 1.7);
      }
      for (const o of objs) {
        const def = LAYER_DEF[o.layer];
        const dz = Math.abs(o.layer + 1 - focus);
        const defocus = 0.3 + dz * 4.2; // 720p px
        let k = 0;
        while (k < BLUR_LEVELS.length - 2 && defocus > BLUR_LEVELS[k + 1]) k++;
        const t = Math.min(1, Math.max(0, (defocus - BLUR_LEVELS[k]) / (BLUR_LEVELS[k + 1] - BLUR_LEVELS[k])));
        const x = (o.x - 0.5) * fieldW + W / 2 + Math.cos(TAU * o.wobK * ph + o.wobPh) * o.wobR * W;
        const y = (o.y - 0.5) * fieldH + H / 2 + Math.sin(TAU * o.wobK * ph + o.wobPh) * o.wobR * W;
        const rot = o.rot + o.rotAmp * Math.sin(TAU * o.rotK * ph + o.rotPh);
        const sc = (def.scale * o.scale) / maxScale / ctx.res;
        const bright = (def.bright * o.bright) / (1 + dz * 0.9); // defocused objects fade into the field
        const set = (s: Sprite, tex: Texture, alpha: number) => {
          s.texture = tex;
          s.position.set(x, y);
          s.rotation = rot;
          s.scale.set(sc);
          s.alpha = alpha * bright;
          s.visible = alpha > 0.001;
        };
        set(o.a, o.variant.levels[k], 1 - t);
        set(o.b, o.variant.levels[k + 1], t);
      }
      drawInto(ctx.renderer, stage, ctx.post.hdr, false);
      ctx.post.present(f);
    },
  };
};
