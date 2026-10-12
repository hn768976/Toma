// Rising air bubbles. Every bubble is a seeded record; its on-screen state is a
// pure function of age = (frame − birth) mod 600. No state is carried between
// frames, so any frame can be rendered alone, in any order, on any thread.

import { Particle, ParticleContainer } from "pixi.js";
import { LOOP, loopFrame, TAU } from "../lib/loop";
import { gauss, mulberry32, range, Rng } from "../lib/random";
import { WaterKit } from "./kit";
import { hexToRgb, WaterPalette } from "./palettes";
import { BLUR_D, IRREG_BASE, IRREG_BLUR_BASE, IRREG_BLUR_COUNT, IRREG_COUNT, SHARP_D, Sprite } from "./sprites";

/** Layer = depth class. */
export const FAR = 0;
export const MID = 1;
export const NEAR = 2;

// Positions are computed in "720 units": y in [0,720] is the frame height,
// x in [0, 720·aspect]. They are scaled to device pixels at the end.
type Bubble = {
  birth: number;
  layer: number;
  srcX: number; // 720 units
  y0: number; // start y (below the frame)
  size: number; // diameter at 720p, before depth scale
  speed: number; // 720 units / frame
  jet: number; // initial exhale kick
  plume: number; // shared upwelling of the burst (decays with age)
  spread: number; // final lateral offset
  diff: number; // slow lateral diffusion (× sqrt(age))
  tau: number; // spread time constant (frames)
  swirlR: number;
  swirlW: number;
  swirlP: number;
  wobA: number;
  wobW: number;
  wobP: number;
  shapeW: number;
  shapeP: number;
  shapeAmp: number;
  rot0: number; // base orientation (non-cap shapes)
  asp0: number; // per-bubble aspect variation
  depthScale: number;
  parallax: number;
  alpha: number;
  sprite: Sprite;
  drawnD: number;
};

export type BubbleSpec = {
  seed: number;
  aspect: number; // width / height
  /** Burst birth frames (each must be in [0,600)). */
  bursts: { frame: number; count: number; duration: number; spreadMul?: number; srcX?: number; fizz?: number; clumps?: number }[];
  /** Burst upwelling: initial speed (720 units/frame) and decay (frames). */
  plumeV: number;
  plumeTau: number;
  /** Largest micro-bubble in a burst's fizz. */
  fizzSizeMax: number;
  /** Trickle bubbles per frame (spread evenly over the loop). */
  trickle: number;
  /** Base source x as a fraction of width. */
  sourceX: number;
  /** Seeded per-burst drift of the source, fraction of width. */
  sourceJitter: number;
  sizeMin: number;
  /** Smallest bubble among a burst's main bubbles (defaults to sizeMin). */
  burstSizeMin?: number;
  sizeMax: number;
  powerLaw: number; // p(s) ∝ s^-powerLaw
  trickleSizeMax: number;
  nearFraction: number;
  farFraction: number;
  /** Lateral column waver amplitude (720 units). */
  waver: number;
  brightness: number;
  /** Lateral random-walk strength (× sqrt(age)). */
  diffusion: number;
  /** Lateral spread scale for bursts. */
  spreadScale: number;
  /** Optional source y (below frame) range. */
  y0: [number, number];
};

const powerLawSize = (rng: Rng, lo: number, hi: number, alpha: number) => {
  const a1 = 1 - alpha;
  const u = rng();
  return Math.pow(Math.pow(lo, a1) + u * (Math.pow(hi, a1) - Math.pow(lo, a1)), 1 / a1);
};

/** Rise speed grows with size (720 units per frame). */
const riseSpeed = (s: number) => 1.45 + 2.1 * Math.pow(Math.min(s, 14) / 14, 0.6);

const spriteFor = (s: number, layer: number, rng: Rng): Sprite => {
  if (layer === NEAR) {
    if (s > 4 && rng() < 0.7) return IRREG_BLUR_BASE + Math.floor(rng() * IRREG_BLUR_COUNT);
    if (s > 10) return Sprite.CapBlur;
    if (s > 4) return Sprite.OblateBlur;
    return Sprite.RoundBlur;
  }
  if (s < 3) return Sprite.Tiny;
  if (s < 5) return rng() < 0.3 ? IRREG_BASE + Math.floor(rng() * IRREG_COUNT) : Sprite.Round;
  if (s < 7) return rng() < 0.5 ? IRREG_BASE + Math.floor(rng() * IRREG_COUNT) : Sprite.Oblate;
  const r = rng();
  if (r < 0.7) return IRREG_BASE + Math.floor(rng() * IRREG_COUNT);
  if (s < 10.5) return Sprite.Wobbly;
  return r < 0.85 ? Sprite.Cap : Sprite.CapWide;
};

const isCap = (s: Sprite) => s === Sprite.Cap || s === Sprite.CapWide || s === Sprite.CapBlur;

const pickLayer = (rng: Rng, spec: BubbleSpec) => {
  const r = rng();
  return r < spec.nearFraction ? NEAR : r < spec.nearFraction + spec.farFraction ? FAR : MID;
};

const layerSpeed = (layer: number) => (layer === FAR ? 0.8 : layer === NEAR ? 1.35 : 1);

const makeBubble = (
  rng: Rng,
  spec: BubbleSpec,
  birth: number,
  srcX: number,
  size: number,
  spreadMul: number,
  jetMul: number,
  plume: number,
  forcedLayer?: number,
): Bubble => {
  let layer = forcedLayer ?? pickLayer(rng, spec);
  // Large out-of-focus bubbles are rare: most near bubbles are small soft glints.
  if (layer === NEAR && size > 4 && rng() < 0.85) layer = MID;
  const depthScale = layer === NEAR ? (size > 4 ? range(rng, 3.5, 5) : range(rng, 2.2, 3.4)) : layer === FAR ? range(rng, 0.45, 0.65) : range(rng, 0.85, 1.15);
  const parallax = layer === NEAR ? range(rng, 1.3, 1.8) : layer === FAR ? range(rng, 0.55, 0.7) : 1;
  const y0 = range(rng, spec.y0[0], spec.y0[1]) + (layer === NEAR ? 40 : 0);
  const big = size > 3;
  const sprite = spriteFor(size, layer, rng);
  const b: Bubble = {
    birth,
    layer,
    srcX,
    y0: 720 + y0,
    size,
    speed: riseSpeed(size) * layerSpeed(layer) * range(rng, 0.9, 1.1),
    jet: jetMul * range(rng, 1.5, 4.5) * (0.4 + size / 14),
    plume: plume * range(rng, 0.8, 1.1) * layerSpeed(layer),
    spread: gauss(rng) * spec.spreadScale * spreadMul * parallax,
    diff: gauss(rng) * spec.diffusion * parallax,
    tau: range(rng, 45, 140),
    swirlR: range(rng, 4, 22) * spreadMul * parallax,
    swirlW: range(rng, 0.015, 0.04) * (rng() < 0.5 ? -1 : 1),
    swirlP: range(rng, 0, TAU),
    // Larger bubbles zigzag.
    wobA: big ? range(rng, 1.5, 4.5) * (size / 8) * parallax : 0.4,
    wobW: big ? range(rng, 0.12, 0.22) : range(rng, 0.05, 0.1),
    wobP: range(rng, 0, TAU),
    shapeW: range(rng, 0.25, 0.45),
    shapeP: range(rng, 0, TAU),
    shapeAmp: size < 3 ? 0 : size < 8 ? 0.08 : 0.14,
    rot0: isCap(sprite) ? range(rng, -0.15, 0.15) : range(rng, -0.6, 0.6),
    asp0: range(rng, 0.82, 1.12),
    depthScale,
    parallax,
    alpha: layer === NEAR ? range(rng, 0.35, 0.65) : layer === FAR ? range(rng, 0.4, 0.7) : range(rng, 0.6, 1.0),
    sprite,
    drawnD: layer === NEAR ? BLUR_D : SHARP_D,
  };
  return ensureExit(b, spec);
};

/** Every bubble must leave the top of the frame before its age wraps at 600. */
const ensureExit = (b: Bubble, spec: BubbleSpec) => {
  const travel = b.y0 + 40 - b.plume * spec.plumeTau * 0.9;
  b.speed = Math.max(b.speed, travel / (LOOP - 30));
  return b;
};

/** A clump: a sub-cloud of a burst whose bubbles share one trajectory. */
type Clump = {
  t: number;
  dx: number;
  dy: number;
  spread: number;
  tau: number;
  swirlR: number;
  swirlW: number;
  swirlP: number;
  plume: number;
  speed: number;
  sigma: number;
  layer: number;
};

const makeClump = (rng: Rng, spec: BubbleSpec, duration: number, spreadMul: number): Clump => {
  const r = rng();
  const layer = r < 0.06 ? NEAR : r < 0.26 ? FAR : MID;
  return {
    t: Math.pow(rng(), 1.6) * duration,
    dx: gauss(rng) * 24,
    dy: gauss(rng) * 22,
    spread: gauss(rng) * spec.spreadScale * spreadMul,
    tau: range(rng, 25, 80),
    swirlR: range(rng, 5, 18) * spreadMul,
    swirlW: range(rng, 0.012, 0.035) * (rng() < 0.5 ? -1 : 1),
    swirlP: range(rng, 0, TAU),
    plume: spec.plumeV * range(rng, 0.7, 1.2),
    speed: range(rng, 1.5, 2.5),
    sigma: range(rng, 4, 16),
    layer,
  };
};

/** Bind a bubble to a clump's shared trajectory. */
const joinClump = (rng: Rng, spec: BubbleSpec, b: Bubble, c: Clump, ownSpeed: boolean) => {
  const par = b.parallax;
  const ls = layerSpeed(b.layer);
  b.spread = c.spread * par + gauss(rng) * c.sigma * 1.0 * par;
  b.tau = c.tau;
  b.swirlR = c.swirlR * par;
  b.swirlW = c.swirlW;
  b.swirlP = c.swirlP + gauss(rng) * 0.15;
  b.plume = c.plume * ls;
  if (!ownSpeed) b.speed = c.speed * ls * (1 + gauss(rng) * 0.05);
  b.y0 += c.dy + gauss(rng) * c.sigma;
  b.diff = gauss(rng) * spec.diffusion * 0.3 * par;
  b.jet *= 0.5;
  return ensureExit(b, spec);
};

export const buildBubbles = (spec: BubbleSpec): Bubble[] => {
  const rng = mulberry32(spec.seed);
  const W = 720 * spec.aspect;
  const list: Bubble[] = [];
  for (const b of spec.bursts) {
    const src = (b.srcX ?? spec.sourceX + (rng() * 2 - 1) * spec.sourceJitter) * W;
    const spreadMul = b.spreadMul ?? 1;
    const clumps = Array.from({ length: b.clumps ?? 0 }, () => makeClump(rng, spec, b.duration, spreadMul));
    for (let i = 0; i < b.count; i++) {
      // Most of the burst leaves in the first ~third of the exhale.
      const size = powerLawSize(rng, spec.burstSizeMin ?? spec.sizeMin, spec.sizeMax, spec.powerLaw);
      if (clumps.length && rng() < 0.65) {
        const c = clumps[Math.floor(rng() * clumps.length)];
        const bb = makeBubble(rng, spec, (b.frame + c.t + rng() * 4) % LOOP, src + c.dx + gauss(rng) * c.sigma, size, spreadMul, 1, spec.plumeV);
        list.push(joinClump(rng, spec, bb, c, true));
      } else {
        const t = Math.pow(rng(), 1.8) * b.duration;
        list.push(makeBubble(rng, spec, (b.frame + t) % LOOP, src + gauss(rng) * 5, size, spreadMul, 1, spec.plumeV));
      }
    }
    // Dense micro-bubble fizz, packed into the clumps: this is what makes an
    // exhaled plume read as a bright, clumpy white mass.
    for (let i = 0; i < (b.fizz ?? 0); i++) {
      const size = powerLawSize(rng, spec.sizeMin, spec.fizzSizeMax, 1.5);
      if (clumps.length) {
        // Bigger clumps get more fizz (pick with a skew).
        const c = clumps[Math.floor(Math.pow(rng(), 1.5) * clumps.length)];
        const layer = c.layer === NEAR && rng() < 0.75 ? MID : c.layer;
        const bb = makeBubble(rng, spec, (b.frame + c.t + rng() * 3) % LOOP, src + c.dx + gauss(rng) * c.sigma, size, spreadMul, 0.5, spec.plumeV, layer);
        list.push(joinClump(rng, spec, bb, c, false));
      } else {
        const t = Math.pow(rng(), 1.4) * b.duration * 1.6;
        list.push(makeBubble(rng, spec, (b.frame + t) % LOOP, src + gauss(rng) * 6, size, spreadMul * 0.8, 0.5, spec.plumeV * range(rng, 0.5, 1.0)));
      }
    }
  }
  const nTrickle = Math.round(spec.trickle * LOOP);
  for (let i = 0; i < nTrickle; i++) {
    const birth = (i / spec.trickle) % LOOP;
    const src = (spec.sourceX + 0.012 * Math.sin((TAU * 2 * birth) / LOOP + 1.3)) * W + gauss(rng) * 6;
    const size = powerLawSize(rng, spec.sizeMin, spec.trickleSizeMax, spec.powerLaw);
    list.push(makeBubble(rng, spec, birth, src, size, 0.45, 0.3, 0));
  }
  // Sort small→large within layers so bigger bubbles draw on top.
  list.sort((a, b) => a.layer - b.layer || a.size - b.size);
  return list;
};

/** Approximate god-ray brightness at (xN, yN) — the same sway terms as the shader, no caustic. */
export const rayLight = (xN: number, yN: number, th: number, sun: [number, number], aspect: number, D: number, src: number, fan: number, lean = 0) => {
  const dx = (xN - sun[0] - lean) * aspect;
  const dy = yN - (sun[1] - src);
  const ang = Math.atan2(dx, dy);
  let s = 0;
  s += 0.42 * Math.pow(0.5 + 0.5 * Math.cos(ang * 23 * D + 1.3 + 0.9 * Math.sin(th + 0.4) + 0.4 * Math.sin(2 * th + 2.1)), 5);
  s += 0.36 * Math.pow(0.5 + 0.5 * Math.cos(ang * 37 * D + 4.1 - 1.1 * Math.sin(th + 1.9) + 0.5 * Math.sin(3 * th + 0.2)), 7);
  s += 0.3 * Math.pow(0.5 + 0.5 * Math.cos(ang * 53 * D + 2.6 + 1.3 * Math.sin(2 * th + 4.4)), 9);
  s += 0.22 * Math.pow(0.5 + 0.5 * Math.cos(ang * 79 * D + 0.7 - 1.6 * Math.sin(th + 3.3) + 0.6 * Math.sin(2 * th)), 12);
  return Math.min(1.2, s) * Math.exp(-ang * ang * fan);
};

export class BubbleField {
  readonly layers: ParticleContainer[];
  private readonly bubbles: Bubble[];
  private readonly parts: Particle[] = [];
  private readonly tint: [number, number, number];
  private readonly farTint: [number, number, number];
  aliveLastFrame = 0;

  constructor(
    private kit: WaterKit,
    private spec: BubbleSpec,
    palette: WaterPalette,
  ) {
    this.bubbles = buildBubbles(spec);
    const top = hexToRgb(palette.top);
    // Water colours what the bubble reflects: a little of the lit water in the rim.
    const white = hexToRgb(palette.bubble);
    this.tint = [0, 1, 2].map((i) => white[i] * 0.78 + top[i] * 0.22) as [number, number, number];
    this.farTint = [0, 1, 2].map((i) => this.tint[i] * 0.45 + top[i] * 0.55) as [number, number, number];
    this.layers = [FAR, MID, NEAR].map(
      () =>
        new ParticleContainer({
          dynamicProperties: { position: true, vertex: true, rotation: true, color: true, uvs: false },
          texture: kit.atlas,
        }),
    );
    for (const b of this.bubbles) {
      const p = new Particle({ texture: kit.sprite(b.sprite), anchorX: 0.5, anchorY: 0.5 });
      this.parts.push(p);
      this.layers[b.layer].addParticle(p);
    }
  }

  get count() {
    return this.bubbles.length;
  }

  update(frame: number) {
    const f = loopFrame(frame);
    const th = (TAU * f) / LOOP;
    const { pw, ph } = this.kit;
    const k = ph / 720;
    const W = 720 * this.spec.aspect;
    const sun = this.kit.look.sun;
    let alive = 0;
    for (let i = 0; i < this.bubbles.length; i++) {
      const b = this.bubbles[i];
      const p = this.parts[i];
      let age = f - b.birth;
      age = ((age % LOOP) + LOOP) % LOOP;
      const tj = 18;
      const tp = this.spec.plumeTau;
      const y = b.y0 - b.speed * age - b.jet * tj * (1 - Math.exp(-age / tj)) - b.plume * tp * (1 - Math.exp(-age / tp));
      if (y < -40 || y > 720 + 120) {
        p.alpha = 0;
        p.scaleX = p.scaleY = 0;
        continue;
      }
      const yN = y / 720;
      const grow = 1 - Math.exp(-age / b.tau);
      const swirl = b.swirlR * (0.3 + grow) * Math.sin(b.swirlW * age + b.swirlP);
      const zig = b.wobA * Math.sin(b.wobW * age + b.wobP);
      // Column wavers with the current (whole cycles in the loop frame).
      const waver =
        this.spec.waver * b.parallax * (Math.sin((TAU * 2 * f) / LOOP + yN * 2.6 + 0.4) * 0.7 + Math.sin((TAU * 3 * f) / LOOP - yN * 4.1 + 2.0) * 0.3) * (1 - yN * 0.3);
      const [dX, dY] = this.kit.drift;
      const x = b.srcX + b.spread * grow + b.diff * Math.sqrt(age) + swirl + zig + waver * (1 - Math.exp(-age / 60)) + dX * W * b.parallax;
      const xN = x / W;

      // Bubbles expand as they rise (pressure drops).
      const d = b.size * b.depthScale * k * (1 + 0.28 * (1 - yN)); // device px
      const dd = Math.max(1.0, d);
      // Sub-pixel bubbles still read as sparkles: soften the area falloff.
      const area = Math.min(1, Math.pow(d / dd, 1.2));
      const sc = dd / b.drawnD;
      const sh = b.shapeAmp * Math.sin(b.shapeW * age + b.shapeP);
      // 180° shutter motion blur: stretch along the direction of travel.
      const vy = b.speed + b.jet * Math.exp(-age / tj) + b.plume * Math.exp(-age / tp);
      const blur = 0.5 * vy * k;
      p.scaleX = sc * (1 + sh * 0.5);
      p.scaleY = (dd * b.asp0 * (1 - sh) + blur) / b.drawnD;
      p.rotation = b.rot0 * 0.4 + (b.wobA > 1 ? 0.35 * Math.cos(b.wobW * age + b.wobP) * Math.min(1, b.size / 10) : 0);
      p.x = (x / W) * pw;
      p.y = (yN + dY * b.parallax) * ph;

      // Brighter near the lit surface; catch ray light; fade into the glare at the top.
      const up = Math.max(0, 1 - yN);
      // Bubbles flash as they cross the rays.
      const L = this.kit.look;
      const ray = rayLight(xN, yN, th, sun, this.spec.aspect, L.rayDensity, L.raySrc, L.rayFan, L.rayLean);
      const lit = Math.min(1, (0.62 + 0.35 * Math.pow(up, 1.8) + 0.75 * ray * (0.4 + 0.6 * up)) * this.spec.brightness);
      const glare = smooth(0.0, 0.2, yN) * (1 - 0.6 * Math.exp(-(((xN - sun[0]) * this.spec.aspect) ** 2 + (yN - sun[1]) ** 2) / 0.04));
      const a = b.alpha * area * glare;
      p.alpha = Math.max(0, Math.min(1, a));
      const tint = b.layer === FAR ? this.farTint : this.tint;
      const l = b.layer === FAR ? lit * 0.75 : lit;
      p.tint = (Math.round(tint[0] * l * 255) << 16) | (Math.round(tint[1] * l * 255) << 8) | Math.round(tint[2] * l * 255);
      if (p.alpha > 0.002) alive++;
    }
    this.aliveLastFrame = alive;
  }
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
