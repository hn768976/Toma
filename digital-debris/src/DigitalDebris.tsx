import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  GRAIN_TILE_SIZE,
  buildBackground,
  buildGrain,
  buildVignette,
} from "./lib/background";
import { BUCKETS, depthAlpha, depthOf, swayAmpX, swayAmpY } from "./lib/depth";
import { bucketOffsets, generateElements, type Debris } from "./lib/elements";
import { TEAL, VIOLET, type Palette } from "./lib/palette";
import { clamp01 } from "./lib/random";
import { getSprites } from "./lib/sprites";

export type Variant = "teal" | "violet";

const PALETTES: Record<Variant, Palette> = { teal: TEAL, violet: VIOLET };

/**
 * The element set is built once, at module level, from a seeded PRNG. Per frame
 * only positions and brightness change.
 */
const SETS: Record<Variant, { els: Debris[]; offsets: number[] }> = {
  teal: (() => {
    const els = generateElements(0x5eed01);
    return { els, offsets: bucketOffsets(els) };
  })(),
  violet: (() => {
    const els = generateElements(0x5eed02);
    return { els, offsets: bucketOffsets(els) };
  })(),
};

/** Per-bucket phase offsets, so the layers do not sway in lockstep. */
const BUCKET_PHASE = Array.from({ length: BUCKETS }, (_, b) => ({
  x: (b * 2.399963) % (Math.PI * 2),
  x2: (b * 1.107149 + 0.7) % (Math.PI * 2),
  y: (b * 4.123889 + 1.9) % (Math.PI * 2),
}));

const FLICKER_FADE = 2;

const flickerAt = (el: Debris, frame: number) => {
  const f = el.flicker;
  if (!f) return 1;
  const u = (frame + f.phase) % f.period;
  const onLength = f.period * f.duty;
  if (u >= onLength) return 0;
  return clamp01(Math.min(u, onLength - u) / FLICKER_FADE);
};

export type DebrisProps = {
  readonly variant: Variant;
};

export const DigitalDebris: React.FC<DebrisProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const palette = PALETTES[variant];
    const { els, offsets } = SETS[variant];
    const sprites = getSprites(variant, els, palette, height);
    const background = memoBackground(variant, palette, width, height);
    const vignette = memoVignette(width, height);
    const grain = memoGrain();

    // Every path closes on the loop point: the field is a sum of sines whose
    // periods all divide the 600-frame duration.
    const theta = (Math.PI * 2 * frame) / durationInFrames;

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(background, 0, 0);

    // Additive, so overlapping fragments build brightness.
    ctx.globalCompositeOperation = "lighter";

    for (let bucket = 0; bucket < BUCKETS; bucket++) {
      const d = depthOf(bucket);
      const phase = BUCKET_PHASE[bucket];
      const ampX = swayAmpX(d) * width;
      const ampY = swayAmpY(d) * width;
      // The second harmonic makes the sway asymmetric in time, so it reads as
      // drift rather than as a pendulum.
      const driftX =
        ampX * (Math.sin(theta + phase.x) + 0.28 * Math.sin(2 * theta + phase.x2));
      const driftY = ampY * Math.sin(theta + phase.y);
      const layerAlpha = depthAlpha(d);
      const wobbleScale = (0.4 + d) * width;

      for (let i = offsets[bucket]; i < offsets[bucket + 1]; i++) {
        const el = els[i];

        let alpha = layerAlpha * el.alphaJitter;
        if (el.pulse) alpha *= 1 + el.pulse.amt * Math.sin(el.pulse.k * theta + el.pulse.phase);
        if (el.flicker) {
          const f = flickerAt(el, frame);
          if (f <= 0) continue;
          alpha *= f;
        }
        if (alpha <= 0.004) continue;

        const [w0, w1] = el.wobble;
        const x =
          el.nx * width +
          driftX +
          wobbleScale * (w0.ax * Math.sin(w0.kx * theta + w0.px) + w1.ax * Math.sin(w1.kx * theta + w1.px));
        const y =
          el.ny * height +
          driftY +
          wobbleScale * (w0.ay * Math.sin(w0.ky * theta + w0.py) + w1.ay * Math.sin(w1.ky * theta + w1.py));

        const sprite = sprites[i];
        if (x + sprite.hw < 0 || x - sprite.hw > width) continue;
        if (y + sprite.hh < 0 || y - sprite.hh > height) continue;

        ctx.globalAlpha = alpha > 1 ? 1 : alpha;
        ctx.drawImage(sprite.canvas, x - sprite.hw, y - sprite.hh);
      }
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(vignette, 0, 0);

    const tile = grain[frame % grain.length];
    const pattern = ctx.createPattern(tile, "repeat");
    if (pattern) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.022;
      ctx.save();
      ctx.translate(-((frame * 37) % GRAIN_TILE_SIZE), -((frame * 53) % GRAIN_TILE_SIZE));
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width + GRAIN_TILE_SIZE, height + GRAIN_TILE_SIZE);
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }, [frame, width, height, durationInFrames, variant]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={ref} width={width} height={height} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};

/* Static layers are built once per size and reused across frames. */

const backgrounds = new Map<string, HTMLCanvasElement>();
const memoBackground = (variant: Variant, palette: Palette, w: number, h: number) => {
  const key = `${variant}@${w}x${h}`;
  let hit = backgrounds.get(key);
  if (!hit) {
    hit = buildBackground(palette, w, h, variant === "teal" ? 0xbaced1 : 0xbaced2);
    backgrounds.set(key, hit);
  }
  return hit;
};

const vignettes = new Map<string, HTMLCanvasElement>();
const memoVignette = (w: number, h: number) => {
  const key = `${w}x${h}`;
  let hit = vignettes.get(key);
  if (!hit) {
    hit = buildVignette(w, h);
    vignettes.set(key, hit);
  }
  return hit;
};

let grainTiles: HTMLCanvasElement[] | null = null;
const memoGrain = () => {
  if (!grainTiles) grainTiles = buildGrain(0x67a1cf);
  return grainTiles;
};
