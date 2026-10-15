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
  // fine blotchy micro-texture (smeared out-of-focus cells), closed drift
  vec2 q = p * 2.6 + cyc * 0.3 + 40.0;
  vec2 w = vec2(fbm(q * 0.8 + 3.0, 4), fbm(q * 0.8 + 9.0, 4)) - 0.5;
  float broad = fbm(q * 0.9 + w * 1.2, 3);                                // large-scale light/dark
  vec2 qf = p * 10.0 + w * 2.0 + cyc * 0.6 + 7.0;
  float mott = smoothstep(0.38, 0.62, fbm(qf, 4));                        // 20-60 px patches
  float mott2 = smoothstep(0.45, 0.7, fbm(qf * 2.1 + 13.0, 3));
  float field = (0.10 + 0.17 * mott + 0.07 * mott2) * (0.5 + 0.8 * broad);
  field *= 0.55 + 0.45 * smoothstep(0.25, 0.5, fbm(q * 1.6 - w + 5.0, 4)); // dark maroon pockets, no pure-black pools
  field *= 1.0 - 0.35 * smoothstep(0.1, 0.5, vUV.y - 0.45);               // even darkening toward the bottom

  // the pale salmon plateau: large, flat, opaque, with a firm lobed edge; drifts and swells
  vec2 c = vec2(0.34, -0.08) + vec2(0.06 * sin(TAU * ph), 0.03 * sin(TAU * 2.0 * ph + 1.0));
  float size = 0.18 + 0.025 * (0.5 - 0.5 * cos(TAU * ph));
  vec2 d = (p - c) / vec2(size * 2.4, size);
  float edge = fbm(p * 4.5 + cyc * 0.3 + 70.0, 5) - 0.5;
  float r = length(d) + edge * 0.9;
  float haze = smoothstep(1.08, 0.7, r);
  float lum = field * (1.0 - 0.6 * haze) + haze * (0.80 + 0.1 * mott - 0.12 * mott2);
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

type Variant = { levels: Texture[]; fill?: Texture[] };

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

// opaque darker body for a cell, applied with a multiply blend so beads read
// as solid dark cells against the pale haze (the additive rim stays light)
const drawFill = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  const gr = g.createRadialGradient(x, y, 0, x, y, r * 0.9);
  gr.addColorStop(0, "rgba(70,70,70,1)");
  gr.addColorStop(0.7, "rgba(80,80,80,1)");
  gr.addColorStop(1, "rgba(80,80,80,0)");
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r * 0.9, 0, Math.PI * 2);
  g.fill();
};

type Baked = { rim: HTMLCanvasElement; fill: HTMLCanvasElement };

const bakeBeads = (pts: [number, number][], r: number, rng: Rng, alpha = 1): Baked => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = r * 2;
  const minx = Math.min(...xs) - pad;
  const miny = Math.min(...ys) - pad;
  const w = Math.max(...xs) - minx + pad;
  const h = Math.max(...ys) - miny + pad;
  const rim = makeCanvas(w, h);
  const fill = makeCanvas(w, h);
  rim.g.globalCompositeOperation = "lighter";
  rim.g.globalAlpha = alpha;
  for (const [px, py] of pts) {
    const rr = r * range(rng, 0.88, 1.08);
    drawBead(rim.g, px - minx, py - miny, rr, rng);
    drawFill(fill.g, px - minx, py - miny, rr);
  }
  return { rim: rim.c, fill: fill.c };
};

const bakeChain = (rng: Rng, r: number, hero = false): Baked => {
  const n = hero ? 9 : Math.floor(4 + 16 * rng() ** 2); // mostly short chains, a few long
  const pts: [number, number][] = [];
  let a = hero ? Math.PI / 2 - 0.25 : range(rng, 0, Math.PI * 2);
  const curl = hero ? 0.02 : range(rng, -0.2, 0.2);
  const wig = hero ? 0.06 : range(rng, 0.05, 0.35);
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
  return bakeBeads(pts, r, rng);
};

const bakeClump = (rng: Rng, r: number): Baked => {
  const n = Math.floor(range(rng, 6, 32));
  const pts: [number, number][] = [[0, 0]];
  for (let i = 1; i < n; i++) {
    const [bx, by] = pts[Math.floor(rng() * pts.length)];
    const a = range(rng, 0, Math.PI * 2);
    pts.push([bx + Math.cos(a) * r * 1.8, by + Math.sin(a) * r * 1.8]);
  }
  return bakeBeads(pts, r, rng, 0.75);
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
  fa?: Sprite;
  fb?: Sprite;
};

export const createBacteria: LookFactory<BacteriaParams> = (ctx, params) => {
  const rng = mulberry32(params.seed);
  const { W, H, px } = ctx;
  const maxScale = Math.max(...LAYER_DEF.map((l) => l.scale));
  const bakeR = BEAD_R * px * maxScale; // texture bead radius in output pixels at the largest layer scale

  const lv = (src: HTMLCanvasElement) => BLUR_LEVELS.map((b) => canvasTexture(blurred(src, b * px * maxScale)));
  const mkVariant = (src: HTMLCanvasElement | Baked): Variant =>
    src instanceof HTMLCanvasElement ? { levels: lv(src) } : { levels: lv(src.rim), fill: lv(src.fill) };
  const chains = Array.from({ length: N_CHAIN_VARIANTS }, () => mkVariant(bakeChain(rng, bakeR)));
  const hero = mkVariant(bakeChain(rng, bakeR, true));
  const clumps = Array.from({ length: N_CLUMP_VARIANTS }, () => mkVariant(bakeClump(rng, bakeR)));
  const specks = Array.from({ length: N_SPECK_VARIANTS }, () => mkVariant(bakeSpeck(rng, bakeR * 0.35)));

  const bg = new Pass("bacteria-bg", BG, {
    uPhase: { value: 0, type: "f32" },
    uAspect: { value: W / H, type: "f32" },
  });

  const stage = new Container();
  const layerContainers = LAYER_DEF.map(() => new Container());
  const fillC = LAYER_DEF.map(() => new Container());
  const rimC = LAYER_DEF.map(() => new Container());
  // back layers first; in each layer the multiply fills go before the additive rims
  for (let i = LAYERS - 1; i >= 0; i--) {
    layerContainers[i].addChild(fillC[i], rimC[i]);
    stage.addChild(layerContainers[i]);
  }

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
        // the hero chain: one short near-vertical chain left of centre in layers 2 and 3
        const isHero = kind === "chain" && i === 0 && (L === 1 || L === 2);
        const variant = isHero ? hero : pool[Math.floor(rng() * pool.length)];
        const mk = (fill = false) => {
          const s = new Sprite(fill ? variant.fill![0] : variant.levels[0]);
          s.anchor.set(0.5);
          s.blendMode = fill ? "multiply" : "add";
          (fill ? fillC : rimC)[L].addChild(s);
          return s;
        };
        const blobby = kind === "speck" && i < 3; // a few large soft bokeh blobs
        objs.push({
          variant,
          layer: L,
          ...(isHero
            ? { x: 0.505 + (L - 1) * 0.02, y: 0.5 }
            : kind === "speck" && rng() < 0.7
              ? { x: 0.5 + (rng() + rng() + rng() - 1.5) * 0.18 - 0.06, y: 0.5 + (rng() + rng() + rng() - 1.5) * 0.2 - 0.05 }
              : { x: rng(), y: rng() }),
          rot: isHero ? range(rng, -0.15, 0.15) : range(rng, 0, Math.PI * 2),
          rotAmp: isHero ? 0.12 : range(rng, 0.1, 0.6),
          rotK: rng() < 0.5 ? 1 : 2,
          rotPh: range(rng, 0, Math.PI * 2),
          wobR: range(rng, 0.004, 0.02),
          wobK: rng() < 0.6 ? 1 : 2,
          wobPh: range(rng, 0, Math.PI * 2),
          scale: isHero ? 1.0 : range(rng, 0.75, 1.2) * (kind === "speck" ? (blobby ? range(rng, 2.6, 3.6) : range(rng, 0.6, 1.3)) : 1),
          bright: isHero
            ? 1.35
            : kind === "chain"
              ? range(rng, 0.25, 0.6)
              : kind === "clump"
                ? range(rng, 0.25, 0.6)
                : blobby
                  ? 0.35
                  : range(rng, 0.6, 1.3),
          a: mk(),
          b: mk(),
          ...(variant.fill ? { fa: mk(true), fb: mk(true) } : {}),
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
    vignette: 0.4,
    vignetteShape: [0.45, 1.2],
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
        const defocus = 0.9 + dz * 4.0; // 720p px (nothing is perfectly crisp)
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
        if (o.fa && o.fb && o.variant.fill) {
          // fills darken; weaker when defocused (spread out, less contrast)
          const fw = Math.min(1, bright * 1.2) / (1 + dz);
          set(o.fa, o.variant.fill[k], 1 - t);
          set(o.fb, o.variant.fill[k + 1], t);
          o.fa.alpha = (1 - t) * fw;
          o.fb.alpha = t * fw;
        }
      }
      drawInto(ctx.renderer, stage, ctx.post.hdr, false);
      ctx.post.present(f);
    },
  };
};
