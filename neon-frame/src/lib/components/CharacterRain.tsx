/**
 * <CharacterRain> — falling columns of monospace glyphs with depth.
 *
 * Every column carries a z that drives its size, speed, opacity and blur: near
 * columns are large, fast and soft; far ones small, slow and sharp. Blur is not
 * applied per column — columns are bucketed by depth into three offscreen
 * buffers (see threeBufferDOF) and each buffer is blurred exactly once.
 *
 * Within a column the leading characters are brightest and fade toward the
 * trailing end, so each column reads as a falling streak rather than a line of
 * text, and individual characters reroll as they fall. Column spacing is
 * deliberately irregular: evenly spaced columns read as a printed grid, while
 * clusters and gaps read as rain.
 *
 * Glyphs are blitted from atlases (see glyphAtlas), never laid out per frame.
 *
 * Deterministic and palette-agnostic: colours, sizes, density, glyph set and
 * seed are all props, all randomness comes from Remotion's random() with
 * stable seeds, and every column completes a whole number of traversals per
 * loop — so frame 0 and frame `loopLength` are identical.
 *
 * @example
 *   <CharacterRain
 *     width={3840} height={2160} loopLength={360}
 *     columns={140} minGlyphSize={20} maxGlyphSize={56}
 *     colors={{bright: "#A8D8F5", mid: "#4F9FD4", dim: "#1E4A7A"}}
 *     seedKey="my-piece" fontStack={MONO_STACK} fontGeneration="mono"
 *   />
 */
import React, { useMemo } from "react";
import { random, useCurrentFrame } from "remotion";
import { clamp, frac, lerp, offscreen, useCanvas2D } from "../canvas";
import { rand01, randPick, randRange } from "../random";
import { DEFAULT_GLYPHS, blitGlyph, glyphAtlas } from "../glyph-atlas";
import { bloomPass, type BloomOptions } from "../bloom-pass";
import { blitSprite, lightSprite } from "../sprites";
import {
  DEFAULT_DEPTH_BUCKETS,
  createThreeBufferDOF,
  type DepthBucket,
} from "../three-buffer-dof";

/** Number of quantised glyph sizes; one atlas is built per bracket per colour. */
const SIZE_BRACKETS = 8;
/** Reroll cadences, all divisors of 360 so glyph identity closes over the loop. */
const REROLL_PERIODS = [2, 3, 4, 5, 6, 8] as const;

export type RainColors = {
  /** Leading edge of a streak. */
  bright: string;
  /** Body of a streak. */
  mid: string;
  /** Trailing end of a streak. */
  dim: string;
};

export type CharacterRainProps = {
  width: number;
  height: number;
  loopLength: number;
  columns: number;
  minGlyphSize: number;
  maxGlyphSize: number;
  colors: RainColors;
  /** Stable seed prefix — the same key always produces the same rain. */
  seedKey: string;
  /** CSS font-family stack for the glyph atlases. */
  fontStack: string;
  /** Cache-busting token; change it when the font face changes. */
  fontGeneration: string;
  glyphs?: string;
  buckets?: DepthBucket[];
  bloom?: BloomOptions;
  bloomScale?: number;
  /** Colour of the leading-edge glow. Defaults to `colors.bright`. */
  headBloomColor?: string;
  style?: React.CSSProperties;
};

type Column = {
  x: number;
  glyphSize: number;
  step: number;
  /** Whole traversals completed per loop. */
  cycles: number;
  phase: number;
  alpha: number;
  count: number;
  streakPixels: number;
  rerollEvery: number;
  bucket: number;
  /** Stable numeric seed base for this column's glyph rerolls. */
  glyphSeed: number;
};

const buildColumns = (
  props: Pick<
    CharacterRainProps,
    "columns" | "minGlyphSize" | "maxGlyphSize" | "seedKey" | "width" | "height"
  >,
): Column[] => {
  const { columns, minGlyphSize, maxGlyphSize, seedKey, width, height } = props;

  // Irregular spacing: walk a random gap sequence, then normalise it so the
  // columns still span the full width (plus a little bleed at each edge).
  const gaps: number[] = [];
  let total = 0;
  for (let i = 0; i < columns; i++) {
    const gap = randRange(`${seedKey}-gap-${i}`, 0.22, 1.95);
    gaps.push(gap);
    total += gap;
  }
  const margin = width * 0.04;
  const unit = (width + margin * 2) / total;
  const bracketStep = (maxGlyphSize - minGlyphSize) / (SIZE_BRACKETS - 1);

  const result: Column[] = [];
  let cursor = -margin;
  for (let i = 0; i < columns; i++) {
    cursor += gaps[i] * unit;
    // Bias towards far columns: more small sharp ones than big soft ones.
    const z = Math.pow(rand01(`${seedKey}-z-${i}`), 1.45);
    const raw = lerp(minGlyphSize, maxGlyphSize, z);
    const glyphSize = Math.round(
      minGlyphSize + Math.round((raw - minGlyphSize) / bracketStep) * bracketStep,
    );
    const step = glyphSize * 1.15;
    const streakPixels = lerp(0.3, 0.58, z) * height;
    result.push({
      x: cursor,
      glyphSize,
      step,
      // Integer cycles per loop: near columns fall faster.
      cycles: clamp(
        1 + Math.round(z * 3) + Math.floor(rand01(`${seedKey}-c-${i}`) * 2),
        1,
        6,
      ),
      phase: rand01(`${seedKey}-ph-${i}`),
      alpha: lerp(0.24, 0.72, z) * randRange(`${seedKey}-a-${i}`, 0.65, 1),
      count: clamp(Math.ceil(streakPixels / step), 8, 34),
      streakPixels,
      rerollEvery: randPick(`${seedKey}-rr-${i}`, REROLL_PERIODS),
      bucket: z < 0.34 ? 0 : z < 0.68 ? 1 : 2,
      glyphSeed: Math.floor(rand01(`${seedKey}-gs-${i}`) * 1_000_000),
    });
  }
  return result;
};

export const CharacterRain: React.FC<CharacterRainProps> = ({
  width,
  height,
  loopLength,
  columns,
  minGlyphSize,
  maxGlyphSize,
  colors,
  seedKey,
  fontStack,
  fontGeneration,
  glyphs = DEFAULT_GLYPHS,
  buckets = DEFAULT_DEPTH_BUCKETS,
  bloom = {
    wideRadius: 26,
    tightRadius: 8,
    wideStrength: 0.22,
    tightStrength: 0.18,
  },
  bloomScale = 1 / 6,
  headBloomColor,
  style,
}) => {
  const frame = useCurrentFrame();
  const f = ((frame % loopLength) + loopLength) % loopLength;

  const columnData = useMemo(
    () =>
      buildColumns({
        columns,
        minGlyphSize,
        maxGlyphSize,
        seedKey,
        width,
        height,
      }),
    [columns, minGlyphSize, maxGlyphSize, seedKey, width, height],
  );

  const dof = useMemo(
    () => createThreeBufferDOF(width, height, buckets),
    [width, height, buckets],
  );

  const bloomBuffer = useMemo(
    () =>
      offscreen(Math.round(width * bloomScale), Math.round(height * bloomScale)),
    [width, height, bloomScale],
  );

  const ref = useCanvas2D((ctx, canvasWidth, canvasHeight) => {
    const headSprite = lightSprite(headBloomColor ?? colors.bright, 0.1, 2.2);

    dof.clear();
    bloomBuffer.ctx.setTransform(1, 0, 0, 1, 0, 0);
    bloomBuffer.ctx.globalAlpha = 1;
    bloomBuffer.ctx.globalCompositeOperation = "source-over";
    bloomBuffer.ctx.clearRect(
      0,
      0,
      bloomBuffer.canvas.width,
      bloomBuffer.canvas.height,
    );
    bloomBuffer.ctx.globalCompositeOperation = "lighter";

    for (const column of columnData) {
      const bctx = dof.contexts[column.bucket];
      const s = dof.scales[column.bucket];

      const atlasFor = (color: string) =>
        glyphAtlas({
          fontSize: column.glyphSize,
          color,
          fontStack,
          generation: fontGeneration,
          glyphs,
        });
      const bright = atlasFor(colors.bright);
      const mid = atlasFor(colors.mid);
      const dim = atlasFor(colors.dim);

      const travel = height + column.streakPixels;
      const t = frac((f * column.cycles) / loopLength + column.phase);
      const head = -column.streakPixels + t * travel;
      const rerollTick = Math.floor(f / column.rerollEvery);

      for (let i = 0; i < column.count; i++) {
        const y = head - i * column.step;
        if (y < -column.step || y > height + column.step) {
          continue;
        }
        const fade = column.count === 1 ? 0 : i / (column.count - 1);

        // The glyph is pinned to a screen row, so as the streak travels each
        // slot picks up a new character — plus an explicit reroll on a
        // cadence that divides the loop.
        const cell = Math.round(y / column.step);
        const glyphIndex = Math.floor(
          random(column.glyphSeed * 7919 + cell * 613 + rerollTick * 104_729) *
            glyphs.length,
        );

        let atlas = dim;
        let alpha: number;
        if (fade < 0.06) {
          atlas = bright;
          alpha = 1;
        } else if (fade < 0.34) {
          atlas = mid;
          alpha = 0.92 - fade * 0.6;
        } else {
          alpha = Math.pow(1 - fade, 1.3) * 0.85;
        }

        bctx.globalAlpha = clamp(alpha * column.alpha, 0, 1);
        blitGlyph(bctx, atlas, glyphIndex, column.x * s, y * s, s);

        // Only the leading edge feeds the bloom.
        if (i < 2) {
          const size = column.glyphSize * (i === 0 ? 2.8 : 1.8) * bloomScale;
          blitSprite(
            bloomBuffer.ctx,
            headSprite,
            column.x * bloomScale,
            y * bloomScale,
            size,
            size,
            (i === 0 ? 0.3 : 0.12) * column.alpha,
          );
        }
      }
      bctx.globalAlpha = 1;
    }

    // Far first, then mid, then near — one blur per bucket, not per column.
    dof.composite(ctx, canvasWidth, canvasHeight);

    bloomPass(ctx, bloomBuffer.canvas, canvasWidth, canvasHeight, bloom);
  });

  return <canvas ref={ref} width={width} height={height} style={style} />;
};
