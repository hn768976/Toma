import { getTree, trunkFraction } from "./assets";
import { GLOW_HEIGHT, GLOW_X, GROUND_TOP, LOW_RES as LOW, REF_WIDTH } from "./constants";
import {
  getTierLayout,
  TIERS,
  variantFor,
  type Tier,
  type TreeInstance,
} from "./forest";
import { getGrainTiles, makeFogTexture } from "./noise";
import type { Palette } from "./palettes";
import { loopWave, mix } from "./prng";

/**
 * The whole shot is composited back to front on a single 2D canvas: sky, the
 * distant light, then alternating tree tiers and fog planes, then ground,
 * bloom, vignette and grain.
 *
 * The fog washes are drawn *between* the tree tiers rather than as one global
 * overlay. That interleaving is what puts the distant trees inside the fog
 * instead of under a filter, and it is the whole illusion of depth here.
 */

export type SceneOptions = {
  width: number;
  height: number;
  frame: number;
  duration: number;
  palette: Palette;
};

const buffers = new Map<string, HTMLCanvasElement>();

const buffer = (name: string, w: number, h: number) => {
  const key = `${name}:${w}x${h}`;
  let c = buffers.get(key);
  if (!c) {
    c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    buffers.set(key, c);
  }
  const ctx = c.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.clearRect(0, 0, w, h);
  return { canvas: c, ctx };
};

/** Fog planes, far to near. Each drifts at its own rate and breathes on its
 *  own long cycle, so the glow is alternately veiled and revealed. */
type FogPlane = {
  seed: number;
  cellsX: number;
  cellsY: number;
  octaves: number;
  lo: number;
  hi: number;
  /** Vertical extent of the band, as fractions of frame height. */
  top: number;
  bottom: number;
  /** Full texture widths travelled over the loop — integer, so it seams up. */
  drift: number;
  /** Texture width as a multiple of frame width. */
  span: number;
  blur: number;
  breatheCycles: number;
  breathePhase: number;
  breatheAmp: number;
};

const FOG_PLANES: readonly FogPlane[] = [
  { seed: 7001, cellsX: 5, cellsY: 2, octaves: 4, lo: 0.36, hi: 0.74, top: 0.14, bottom: 1.0, drift: 1, span: 1.7, blur: 34, breatheCycles: 2, breathePhase: 0.0, breatheAmp: 0.42 },
  { seed: 7013, cellsX: 6, cellsY: 2, octaves: 4, lo: 0.38, hi: 0.74, top: 0.22, bottom: 1.0, drift: -1, span: 1.6, blur: 28, breatheCycles: 3, breathePhase: 0.31, breatheAmp: 0.38 },
  { seed: 7027, cellsX: 4, cellsY: 2, octaves: 5, lo: 0.39, hi: 0.73, top: 0.3, bottom: 1.0, drift: 2, span: 1.8, blur: 24, breatheCycles: 2, breathePhase: 0.62, breatheAmp: 0.45 },
  { seed: 7039, cellsX: 7, cellsY: 4, octaves: 5, lo: 0.41, hi: 0.74, top: 0.38, bottom: 1.0, drift: -2, span: 1.5, blur: 13, breatheCycles: 3, breathePhase: 0.18, breatheAmp: 0.4 },
  { seed: 7057, cellsX: 9, cellsY: 4, octaves: 5, lo: 0.43, hi: 0.75, top: 0.46, bottom: 1.0, drift: 3, span: 1.4, blur: 10, breatheCycles: 2, breathePhase: 0.77, breatheAmp: 0.36 },
  // Ground mist, hugging the bottom of the frame.
  { seed: 7071, cellsX: 6, cellsY: 2, octaves: 4, lo: 0.36, hi: 0.72, top: 0.84, bottom: 1.06, drift: -1, span: 1.6, blur: 22, breatheCycles: 2, breathePhase: 0.45, breatheAmp: 0.3 },
];

const FOG_TEX_W = 1024;
const FOG_TEX_H = 320;

const fogTexture = (plane: FogPlane) =>
  makeFogTexture({
    seed: plane.seed,
    width: FOG_TEX_W,
    height: FOG_TEX_H,
    cellsX: plane.cellsX,
    cellsY: plane.cellsY,
    octaves: plane.octaves,
    lo: plane.lo,
    hi: plane.hi,
  });

/** Pre-bakes every fog texture, so no frame pays for noise generation. */
export const warmFogTextures = () => FOG_PLANES.forEach(fogTexture);

const glowPath = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  palette: Palette,
  intensity: number,
  spreadScale: number,
) => {
  const gx = GLOW_X * W;
  const groundY = GROUND_TOP * H + H * 0.02;
  const glowH = GLOW_HEIGHT * H * spreadScale;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(gx, groundY - glowH * 0.42);
  // A tall, soft column: light diffusing through fog, with no visible source.
  ctx.scale(0.58, 1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, glowH);
  // A long tail of low-alpha stops: the light has to fade out into the fog
  // without ever showing an edge of its own.
  g.addColorStop(0, palette.glow);
  g.addColorStop(0.14, `${palette.glow}b4`);
  g.addColorStop(0.3, `${palette.glowOuter}96`);
  g.addColorStop(0.48, `${palette.glowOuter}52`);
  g.addColorStop(0.68, `${palette.glowOuter}24`);
  g.addColorStop(0.86, `${palette.glowOuter}0a`);
  g.addColorStop(1, "#00000000");
  ctx.globalAlpha = intensity;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, glowH, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawTree = (
  ctx: CanvasRenderingContext2D,
  inst: TreeInstance,
  W: number,
  H: number,
  frame: number,
  duration: number,
  tier: Tier,
  palette: Palette,
  frameHeight: number,
) => {
  // The raster already *is* the window this instance draws — cropping happens
  // in the SVG viewBox at rasterisation time — so this is a whole-image draw.
  // Note `frameHeight` is the composition height, not `H`: a low-resolution
  // tier draws into a smaller buffer but its raster is keyed on the frame.
  const art = getTree(variantFor(tier, inst, palette, frameHeight));

  const h = inst.height * H;
  const w = h * (art.width / art.height);
  // Anchor on the trunk, not on the middle of the artwork.
  const anchorX = -w * trunkFraction(inst.crop);
  const sway =
    inst.swayAmp * loopWave(frame, duration, inst.swayCycles, inst.swayPhase);

  ctx.save();
  ctx.translate(inst.x * W, inst.y * H);
  // Pivot about the trunk base, so the crown moves and the base does not.
  ctx.rotate(((inst.rotation + sway) * Math.PI) / 180);
  if (inst.flip) ctx.scale(-1, 1);
  ctx.drawImage(art, anchorX, -h, w, h);
  ctx.restore();
};

const drawTier = (
  ctx: CanvasRenderingContext2D,
  tier: Tier,
  opts: SceneOptions,
  scale: number,
) => {
  const { width: W, height: H, frame, duration, palette } = opts;
  const trees = getTierLayout(tier);
  const blurPx = tier.blur * scale;

  if (tier.lowRes) {
    const lowW = Math.max(2, Math.round(W * LOW));
    const lowH = Math.max(2, Math.round(H * LOW));
    const sharp = buffer(`tier-${tier.name}`, lowW, lowH);
    for (const inst of trees) {
      drawTree(sharp.ctx, inst, lowW, lowH, frame, duration, tier, palette, H);
    }
    const soft = buffer(`tier-blur-${tier.name}`, lowW, lowH);
    soft.ctx.filter = `blur(${(blurPx * LOW).toFixed(2)}px)`;
    soft.ctx.drawImage(sharp.canvas, 0, 0);
    soft.ctx.filter = "none";

    ctx.save();
    ctx.globalAlpha = tier.alpha;
    ctx.drawImage(soft.canvas, 0, 0, W, H);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.globalAlpha = tier.alpha;
  if (blurPx > 0.4) ctx.filter = `blur(${blurPx.toFixed(2)}px)`;
  for (const inst of trees) {
    drawTree(ctx, inst, W, H, frame, duration, tier, palette, H);
  }
  ctx.restore();
};

const drawFogPlane = (
  ctx: CanvasRenderingContext2D,
  index: number,
  density: number,
  opts: SceneOptions,
  scale: number,
) => {
  if (density <= 0.001) return;
  const { width: W, height: H, frame, duration, palette } = opts;
  const plane = FOG_PLANES[index % FOG_PLANES.length];
  const tex = fogTexture(plane);

  const lowW = Math.max(2, Math.round(W * LOW));
  const lowH = Math.max(2, Math.round(H * LOW));
  const fog = buffer(`fog-${index}`, lowW, lowH);

  // --- drift: an integer number of texture widths over the loop ---
  const spanW = lowW * plane.span;
  const t = frame / duration;
  const offset = ((t * plane.drift * spanW) % spanW + spanW) % spanW;
  const top = plane.top * lowH;
  const bandH = (plane.bottom - plane.top) * lowH;

  for (let i = -1; i <= 1; i++) {
    fog.ctx.drawImage(tex, -offset + i * spanW, top, spanW, bandH);
  }

  // Soft vertical falloff so the band has no visible edge.
  fog.ctx.globalCompositeOperation = "destination-in";
  const vg = fog.ctx.createLinearGradient(0, top, 0, top + bandH);
  vg.addColorStop(0, "#00000000");
  vg.addColorStop(0.42, "#000000ff");
  vg.addColorStop(0.85, "#000000ff");
  vg.addColorStop(1, "#00000044");
  fog.ctx.fillStyle = vg;
  fog.ctx.fillRect(0, top, lowW, bandH);

  // Colour: lit near the distant glow, falling to near-black at the edges.
  fog.ctx.globalCompositeOperation = "source-in";
  const cg = fog.ctx.createRadialGradient(
    GLOW_X * lowW,
    GROUND_TOP * lowH,
    0,
    GLOW_X * lowW,
    GROUND_TOP * lowH,
    lowW * 0.82,
  );
  cg.addColorStop(0, palette.fogNear);
  cg.addColorStop(0.55, mixHex(palette.fogNear, palette.fogFar, 0.6));
  cg.addColorStop(1, palette.fogFar);
  fog.ctx.fillStyle = cg;
  fog.ctx.fillRect(0, 0, lowW, lowH);

  const soft = buffer(`fog-blur-${index}`, lowW, lowH);
  soft.ctx.filter = `blur(${(plane.blur * scale * LOW).toFixed(2)}px)`;
  soft.ctx.drawImage(fog.canvas, 0, 0);
  soft.ctx.filter = "none";

  // --- density breathes on a long cycle ---
  const breath =
    1 +
    plane.breatheAmp *
      loopWave(frame, duration, plane.breatheCycles, plane.breathePhase);

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, density * breath));
  ctx.drawImage(soft.canvas, 0, 0, W, H);
  ctx.restore();
};

const hex = (c: string) => {
  const s = c.replace("#", "");
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
};

const mixHex = (a: string, b: string, t: number) => {
  const [ar, ag, ab] = hex(a);
  const [br, bg, bb] = hex(b);
  const to = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${to(mix(ar, br, t))}${to(mix(ag, bg, t))}${to(mix(ab, bb, t))}`;
};

export const drawScene = (
  ctx: CanvasRenderingContext2D,
  opts: SceneOptions,
) => {
  const { width: W, height: H, frame, duration, palette } = opts;
  const scale = W / REF_WIDTH;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";

  // --- 1. sky / void: lightest around the glow, falling off to the edges ---
  const sky = ctx.createRadialGradient(
    GLOW_X * W,
    GROUND_TOP * H,
    0,
    GLOW_X * W,
    GROUND_TOP * H,
    W * 0.95,
  );
  sky.addColorStop(0, mixHex(palette.fogNear, palette.fogFar, 0.58));
  sky.addColorStop(0.45, mixHex(palette.fogNear, palette.fogFar, 0.86));
  sky.addColorStop(1, palette.fogFar);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Extra darkening toward the top of the frame.
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.62);
  top.addColorStop(0, `${palette.fogFar}dd`);
  top.addColorStop(1, `${palette.fogFar}00`);
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * 0.62);

  // --- 2. the distant light, pulsing almost imperceptibly ---
  const pulse = 1 + 0.07 * loopWave(frame, duration, 2, 0.12);
  glowPath(ctx, W, H, palette, 1.0 * pulse, 1);

  // --- 3. tree tiers, each followed by the fog that sits in front of it ---
  const globalBreath = 1 + 0.16 * loopWave(frame, duration, 1, 0.4);
  for (const tier of TIERS) {
    drawTier(ctx, tier, opts, scale);
    drawFogPlane(ctx, tier.washPlane, tier.wash * globalBreath, opts, scale);
  }

  // --- 4. ground: a dark band, lifted a little where the glow reaches it ---
  const groundY = GROUND_TOP * H;
  const gg = ctx.createLinearGradient(0, groundY - H * 0.08, 0, H);
  gg.addColorStop(0, `${palette.ground}00`);
  gg.addColorStop(0.3, `${palette.ground}5c`);
  gg.addColorStop(0.62, `${palette.ground}c8`);
  gg.addColorStop(1, palette.ground);
  ctx.fillStyle = gg;
  ctx.fillRect(0, groundY - H * 0.08, W, H - groundY + H * 0.08);

  const lit = ctx.createRadialGradient(
    GLOW_X * W,
    groundY + H * 0.02,
    0,
    GLOW_X * W,
    groundY + H * 0.02,
    W * 0.3,
  );
  lit.addColorStop(0, `${palette.glowOuter}26`);
  lit.addColorStop(1, "#00000000");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = lit;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Mist hugging the ground, in front of everything.
  drawFogPlane(ctx, 5, 0.24 * globalBreath, opts, scale);

  // --- 5. bloom, on the distant glow only ---
  const lowW = Math.max(2, Math.round(W * LOW));
  const lowH = Math.max(2, Math.round(H * LOW));
  const bloomSrc = buffer("bloom-src", lowW, lowH);
  glowPath(bloomSrc.ctx, lowW, lowH, palette, 1, 0.92);
  const bloom = buffer("bloom", lowW, lowH);
  bloom.ctx.filter = `blur(${(52 * scale * LOW).toFixed(2)}px)`;
  bloom.ctx.drawImage(bloomSrc.canvas, 0, 0);
  bloom.ctx.filter = "none";
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.3 * pulse;
  ctx.drawImage(bloom.canvas, 0, 0, W, H);
  ctx.restore();

  // --- 6. vignette, fairly strong, centred on the glow ---
  const vig = ctx.createRadialGradient(
    GLOW_X * W,
    H * 0.6,
    W * 0.16,
    GLOW_X * W,
    H * 0.6,
    W * 0.78,
  );
  vig.addColorStop(0, `${palette.vignette}00`);
  vig.addColorStop(0.55, `${palette.vignette}62`);
  vig.addColorStop(1, `${palette.vignette}ee`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // --- 7. grain: dithers the big soft ramps so H.264 cannot band them ---
  const tiles = getGrainTiles();
  const tile = tiles[frame % tiles.length];
  const pattern = ctx.createPattern(tile, "repeat");
  if (pattern) {
    // Grain size tracks the frame, so it looks the same at 1080p and 4K.
    const s = scale * 1.6;
    pattern.setTransform(new DOMMatrix([s, 0, 0, s, 0, 0]));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.025;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
};
