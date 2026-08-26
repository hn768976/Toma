import {
  BLOOM_ALPHA,
  BLOOM_BLUR_PX,
  BLOOM_DOWNSCALE,
  BLOOM_SIZE_BOOST,
  BLOOM_THRESHOLD,
  BACKGROUND_POOL,
  DOT_LATERAL_JITTER_PX,
  DRIFT_AMPLITUDE_PX,
  DURATION_IN_FRAMES,
  FLARE_SIZE_BOOST,
  GLOW_STRENGTH,
  GRAIN_ALPHA,
  GRAIN_TILE_PX,
  HEIGHT,
  MOTION_BLUR_TAP_ALPHAS,
  SOURCE_GLOW_BLOOM_SCALE,
  TWINKLE_AMPLITUDE,
  VIGNETTE_STRENGTH,
  WIDTH,
} from "./constants";
import type { Field } from "./field";
import { rand } from "./random";
import type { SpriteSet } from "./sprites";
import { FLARE_TONE_INDEX, hexToRgb, rgba, shade } from "./themes";
import type { VariantConfig } from "./variants";

const TWO_PI = Math.PI * 2;

/** Perceived weight of each tone, dim -> white. Only used to decide which
 *  dots are bright enough to feed the bloom pass. */
const TONE_WEIGHT = [0.25, 0.5, 0.85, 1];

/** How far off-frame a dot may sit and still be worth drawing: enough to
 *  cover the widest blur halo plus a full motion-blur trail. */
const CULL_MARGIN_PX = 200;

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

export type DrawTargets = {
  ctx: CanvasRenderingContext2D;
  /** Small buffer the bright dots are re-drawn into for the bloom pass. */
  bloomCtx: CanvasRenderingContext2D;
  /** Second small buffer, holding the blurred copy of the first. */
  bloomBlurCtx: CanvasRenderingContext2D;
};

/**
 * Paints one frame. Pure in `frame`: nothing is carried between calls, and
 * every time-varying quantity is derived from `frame % DURATION_IN_FRAMES`,
 * which is what makes frame 0 and frame 300 identical.
 */
export const drawFrame = (
  targets: DrawTargets,
  frame: number,
  field: Field,
  sprites: SpriteSet,
  config: VariantConfig,
) => {
  const { ctx, bloomCtx, bloomBlurCtx } = targets;
  const loopFrame =
    ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;
  const loopT = loopFrame / DURATION_IN_FRAMES;

  // Ambient drift: one revolution of a closed ellipse per loop, so it
  // returns exactly to where it started.
  const driftX = Math.sin(TWO_PI * loopT) * DRIFT_AMPLITUDE_PX;
  const driftY = Math.cos(TWO_PI * loopT) * DRIFT_AMPLITUDE_PX;

  const bloomWidth = WIDTH / BLOOM_DOWNSCALE;
  const bloomHeight = HEIGHT / BLOOM_DOWNSCALE;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  drawBackground(ctx, config);

  bloomCtx.setTransform(1, 0, 0, 1, 0, 0);
  bloomCtx.globalAlpha = 1;
  bloomCtx.globalCompositeOperation = "source-over";
  bloomCtx.clearRect(0, 0, bloomWidth, bloomHeight);
  bloomCtx.globalCompositeOperation = "lighter";
  // Draw into the bloom buffer using full-resolution coordinates; the
  // transform does the downscale.
  const bloomScale = 1 / BLOOM_DOWNSCALE;
  bloomCtx.setTransform(
    bloomScale,
    0,
    0,
    bloomScale,
    driftX * bloomScale,
    driftY * bloomScale,
  );

  // Everything luminous drifts together.
  ctx.setTransform(1, 0, 0, 1, driftX, driftY);
  ctx.globalCompositeOperation = "lighter";

  drawSourceGlow(ctx, config, 1);
  drawSourceGlow(bloomCtx, config, SOURCE_GLOW_BLOOM_SCALE);

  drawDots(ctx, bloomCtx, loopFrame, loopT, field, sprites, config.flowDirection);

  // Bloom: blur the small buffer, then add it back scaled up. The upscale's
  // own smoothing does most of the spreading, which is why a 5px blur on a
  // sixth-scale buffer is enough.
  bloomBlurCtx.setTransform(1, 0, 0, 1, 0, 0);
  bloomBlurCtx.globalAlpha = 1;
  bloomBlurCtx.globalCompositeOperation = "source-over";
  bloomBlurCtx.clearRect(0, 0, bloomWidth, bloomHeight);
  bloomBlurCtx.filter = `blur(${BLOOM_BLUR_PX}px)`;
  bloomBlurCtx.drawImage(bloomCtx.canvas, 0, 0);
  bloomBlurCtx.filter = "none";

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = BLOOM_ALPHA;
  ctx.drawImage(bloomBlurCtx.canvas, 0, 0, WIDTH, HEIGHT);

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  drawVignette(ctx, config);
  drawGrain(ctx, loopFrame, sprites);
};

const drawBackground = (
  ctx: CanvasRenderingContext2D,
  config: VariantConfig,
) => {
  const deep = hexToRgb(config.theme.backgroundDeep);
  const mid = hexToRgb(config.theme.backgroundMid);
  const glowX = WIDTH * config.sourceGlow.xFraction;
  const glowY = HEIGHT * config.sourceGlow.yFraction;

  ctx.fillStyle = rgba(deep, 1);
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // The lifted background tone pools around the source, so the frame reads
  // as lit from wherever the light is rather than flat black.
  const pool = ctx.createRadialGradient(
    glowX,
    glowY,
    0,
    glowX,
    glowY,
    WIDTH * BACKGROUND_POOL.radiusFraction,
  );
  pool.addColorStop(0, rgba(mid, BACKGROUND_POOL.strength));
  pool.addColorStop(0.3, rgba(mid, BACKGROUND_POOL.strength * 0.38));
  pool.addColorStop(0.65, rgba(mid, BACKGROUND_POOL.strength * 0.09));
  pool.addColorStop(1, rgba(mid, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
};

const drawSourceGlow = (
  ctx: CanvasRenderingContext2D,
  config: VariantConfig,
  strength: number,
) => {
  const source = config.sourceGlow;
  const glow = hexToRgb(config.theme.sourceGlow);
  const gain = GLOW_STRENGTH * strength;
  const glowX = WIDTH * source.xFraction;
  const glowY = HEIGHT * source.yFraction;

  const haloRadius = WIDTH * source.haloRadiusFraction;
  const halo = ctx.createRadialGradient(
    glowX,
    glowY,
    0,
    glowX,
    glowY,
    haloRadius,
  );
  halo.addColorStop(0, rgba(glow, source.haloAlpha * gain));
  halo.addColorStop(0.3, rgba(glow, source.haloAlpha * 0.42 * gain));
  halo.addColorStop(0.62, rgba(glow, source.haloAlpha * 0.12 * gain));
  halo.addColorStop(1, rgba(glow, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(
    glowX - haloRadius,
    glowY - haloRadius,
    haloRadius * 2,
    haloRadius * 2,
  );

  const coreRadius = WIDTH * source.coreRadiusFraction;
  const core = ctx.createRadialGradient(
    glowX,
    glowY,
    0,
    glowX,
    glowY,
    coreRadius,
  );
  core.addColorStop(0, rgba(glow, source.coreAlpha * gain));
  core.addColorStop(0.45, rgba(glow, source.coreAlpha * 0.3 * gain));
  core.addColorStop(1, rgba(glow, 0));
  ctx.fillStyle = core;
  ctx.fillRect(
    glowX - coreRadius,
    glowY - coreRadius,
    coreRadius * 2,
    coreRadius * 2,
  );
};

const drawDots = (
  ctx: CanvasRenderingContext2D,
  bloomCtx: CanvasRenderingContext2D,
  loopFrame: number,
  loopT: number,
  field: Field,
  sprites: SpriteSet,
  flowDirection: number,
) => {
  const flareSprites = sprites.tones[FLARE_TONE_INDEX];

  for (const stream of field.streams) {
    // Whole number of pattern cycles per loop, so this returns to its
    // starting value at loopT = 1.
    const travel = flowDirection * loopT * stream.cycles * stream.span;
    const patternTop = HEIGHT / 2 - stream.span / 2;
    const perFrame = flowDirection * stream.speed;
    const toneSprites = sprites.tones;
    const taps = stream.motionBlur ? MOTION_BLUR_TAP_ALPHAS.length : 1;

    for (const dot of stream.dots) {
      const raw = dot.s0 + travel;
      const cycle = Math.floor(raw / stream.span);
      const s = raw - cycle * stream.span;
      const y = patternTop + s;
      if (y < -CULL_MARGIN_PX || y > HEIGHT + CULL_MARGIN_PX) continue;

      // A dot re-seeds its offset within the stream on every wrap. The
      // wrap happens outside the frame, so the change is never seen.
      const cycleIndex =
        ((cycle % stream.cycles) + stream.cycles) % stream.cycles;
      const lateral = dot.lateral[cycleIndex] * DOT_LATERAL_JITTER_PX;
      const x = stream.xc + stream.tanLean * (y - HEIGHT / 2) + lateral;
      if (x < -CULL_MARGIN_PX || x > WIDTH + CULL_MARGIN_PX) continue;

      const twinkle =
        1 +
        TWINKLE_AMPLITUDE *
          Math.sin(loopFrame * dot.twinkleFreq + dot.twinklePhase);

      let flare = 0;
      if (dot.flareStart >= 0) {
        const since =
          ((loopFrame - dot.flareStart) % DURATION_IN_FRAMES +
            DURATION_IN_FRAMES) %
          DURATION_IN_FRAMES;
        if (since < dot.flareFrames) {
          flare = Math.sin((Math.PI * (since + 0.5)) / dot.flareFrames);
        }
      }

      const alpha = clamp01(stream.alpha * twinkle);
      const size = dot.size * (1 + (FLARE_SIZE_BOOST - 1) * flare);
      const radius = size / 2;
      const blur = stream.blurPx;

      // Blur is expressed as sprite geometry: as it grows the hard core
      // fades out and the halo widens, so a heavily blurred dot ends up a
      // soft glowing smear rather than a disc with a filter over it.
      const softness = blur / (blur + radius * 2);
      const haloRadius = radius + blur * 1.4;
      const coreAlpha = alpha * (1 - softness);
      const haloAlpha = alpha * (0.3 + 0.55 * softness) * GLOW_STRENGTH;

      const tone = toneSprites[dot.tone];

      for (let tap = 0; tap < taps; tap++) {
        // Trailing taps sit behind the dot along its motion vector,
        // together spanning about one frame of travel.
        const back = (-perFrame * tap) / MOTION_BLUR_TAP_ALPHAS.length;
        const tx = x + stream.tanLean * back;
        const ty = y + back;
        const tapAlpha = stream.motionBlur ? MOTION_BLUR_TAP_ALPHAS[tap] : 1;

        blit(ctx, tone.halo, tx, ty, haloRadius, haloAlpha * tapAlpha * (1 - flare));
        blit(ctx, tone.core, tx, ty, radius, coreAlpha * tapAlpha * (1 - flare));
        if (flare > 0) {
          blit(ctx, flareSprites.halo, tx, ty, haloRadius, haloAlpha * tapAlpha * flare);
          blit(ctx, flareSprites.core, tx, ty, radius, coreAlpha * tapAlpha * flare);
        }
      }

      const luminance = alpha * TONE_WEIGHT[dot.tone] + flare;
      if (luminance > BLOOM_THRESHOLD) {
        const sprite = flare > 0.5 ? flareSprites.halo : tone.halo;
        blit(
          bloomCtx,
          sprite,
          x,
          y,
          haloRadius * BLOOM_SIZE_BOOST,
          clamp01(luminance) * haloAlpha,
        );
      }
    }
  }
};

const blit = (
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number,
  alpha: number,
) => {
  if (alpha <= 0.002 || radius <= 0) return;
  ctx.globalAlpha = alpha > 1 ? 1 : alpha;
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
};

const drawVignette = (
  ctx: CanvasRenderingContext2D,
  config: VariantConfig,
) => {
  const tint = shade(hexToRgb(config.theme.backgroundDeep), 0.35);
  ctx.save();
  ctx.translate(WIDTH / 2, HEIGHT * 0.48);
  // Squash the circle into an ellipse matching the frame aspect, so the
  // falloff reaches all four corners at the same time.
  ctx.scale(1, HEIGHT / WIDTH);
  const outer = WIDTH * 0.72;
  const gradient = ctx.createRadialGradient(0, 0, WIDTH * 0.34, 0, 0, outer);
  gradient.addColorStop(0, rgba(tint, 0));
  gradient.addColorStop(0.65, rgba(tint, VIGNETTE_STRENGTH * 0.35));
  gradient.addColorStop(1, rgba(tint, VIGNETTE_STRENGTH));
  ctx.fillStyle = gradient;
  ctx.fillRect(-WIDTH / 2, -WIDTH / 2, WIDTH, WIDTH);
  ctx.restore();
};

const drawGrain = (
  ctx: CanvasRenderingContext2D,
  loopFrame: number,
  sprites: SpriteSet,
) => {
  const pattern = ctx.createPattern(sprites.grain, "repeat");
  if (!pattern) return;
  // One tile, slid to a new seeded origin each frame — 300 distinct
  // positions, indexed by frame % 300, so the grain loops with everything
  // else instead of freezing or drifting.
  const offsetX = rand(`rain-grain-offset-x-${loopFrame}`) * GRAIN_TILE_PX;
  const offsetY = rand(`rain-grain-offset-y-${loopFrame}`) * GRAIN_TILE_PX;
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.globalAlpha = GRAIN_ALPHA;
  ctx.fillStyle = pattern;
  ctx.fillRect(-offsetX, -offsetY, WIDTH, HEIGHT);
  ctx.restore();
  ctx.globalAlpha = 1;
};
