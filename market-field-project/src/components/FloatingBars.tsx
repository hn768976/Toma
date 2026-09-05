import { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { BARS, SEED } from "../config";
import type { Palette } from "../palettes";
import { lerp, mod, mulberry32 } from "../random";

type Bar = {
  x0: number; // 0..1 of width
  y0: number; // 0..1 of the wrap range
  depth: number; // 0 = near and sharp, 1 = far and bokeh
  bodyWidth: number;
  bodyHeight: number;
  wickOffset: number;
  blur: number; // quantised, in composition px
  blurLevel: number;
  cyclesY: number; // whole traversals of the wrap range per loop
  swayAmp: number;
  swayCycles: number; // whole number
  swayPhase: number;
  flickerCycles: number; // whole number
  flickerPhase: number;
  flickerDepth: number;
  alpha: number;
  colorIndex: number;
};

/** Wicks read as dimmer than the body they hang off. */
const WICK_ALPHA = 0.55;

const pickColor = (r: number, weights: readonly number[]) => {
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (r < acc) return i;
  }
  return weights.length - 1;
};

const buildBars = (width: number, height: number, palette: Palette): Bar[] => {
  const rand = mulberry32(SEED ^ 0x0ba25);
  const maxBlur = width * BARS.maxBlur;

  return Array.from({ length: BARS.count }, () => {
    // Skewed toward the far end: a few sharp candles, mostly soft bokeh.
    const depth = Math.pow(rand(), 0.6);
    const rawBlur = maxBlur * Math.pow(depth, 1.6);
    const blurLevel = Math.round((rawBlur / maxBlur) * (BARS.blurLevels - 1));

    return {
      x0: rand(),
      y0: rand(),
      depth,
      bodyWidth: width * lerp(BARS.bodyWidthNear, BARS.bodyWidthFar, depth),
      bodyHeight: height * lerp(BARS.bodyHeightNear, BARS.bodyHeightFar, depth),
      wickOffset: (rand() - 0.5) * 0.5,
      blur: (blurLevel / (BARS.blurLevels - 1)) * maxBlur,
      blurLevel,
      // Near bars travel further per loop, so the field reads as depth.
      cyclesY: depth < 0.42 ? 3 : depth < 0.72 ? 2 : 1,
      swayAmp: width * BARS.swayMax * (0.25 + 0.75 * rand()) * (1 - depth * 0.4),
      swayCycles: rand() < 0.6 ? 1 : 2,
      swayPhase: rand(),
      flickerCycles: 1 + Math.floor(rand() * 3),
      flickerPhase: rand(),
      flickerDepth: 0.2 + 0.35 * rand(),
      // Blur spreads a bar's energy, so the far ones are pushed brighter
      // to keep the bokeh reading as light rather than as smudge.
      alpha: lerp(0.9, 1, depth) * (0.62 + 0.38 * rand()),
      colorIndex: pickColor(rand(), palette.barWeights),
    };
  }).sort((a, b) => a.colorIndex - b.colorIndex);
};

/**
 * Bokeh candlesticks: atmosphere, not data. They drift up and sideways at
 * rates set by their blur, and every motion term completes a whole number of
 * cycles over the composition so the field returns to its start at frame 600.
 */
export const FloatingBars: React.FC<{ palette: Palette }> = ({ palette }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const bars = useMemo(
    () => buildBars(width, height, palette),
    [width, height, palette],
  );

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Chrome clips a canvas `filter: blur()` to the bounding box of the
    // geometry being drawn, which leaves a hard rectangular edge across the
    // soft falloff. Blurring a padded offscreen bitmap instead keeps the
    // spread inside the source bounds, so the bokeh stays round.
    const scratch = scratchRef.current ?? document.createElement("canvas");
    scratchRef.current = scratch;
    const sctx = scratch.getContext("2d");
    if (!sctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";

    const t = mod(frame, durationInFrames) / durationInFrames;
    const range = height * BARS.travelRange;
    const yShift = (height * (BARS.travelRange - 1)) / 2;

    let currentColor = -1;

    for (const bar of bars) {
      if (bar.colorIndex !== currentColor) {
        currentColor = bar.colorIndex;
        ctx.fillStyle = palette.bars[bar.colorIndex];
      }

      const y = mod(bar.y0 * range - bar.cyclesY * range * t, range) - yShift;
      const x =
        bar.x0 * width +
        bar.swayAmp *
          Math.sin(Math.PI * 2 * (bar.swayCycles * t + bar.swayPhase));

      const flicker =
        1 -
        bar.flickerDepth +
        bar.flickerDepth *
          (0.5 +
            0.5 *
              Math.sin(
                Math.PI * 2 * (bar.flickerCycles * t + bar.flickerPhase),
              ));

      const wickHeight = bar.bodyHeight * BARS.wickExtra;
      const wickWidth = Math.max(bar.bodyWidth * BARS.wickWidth, 1);
      const wickTop = -wickHeight / 2 + bar.wickOffset * bar.bodyHeight;
      const bodyAlpha = bar.alpha * flicker;

      if (bar.blur < 0.5) {
        ctx.globalAlpha = bodyAlpha * WICK_ALPHA;
        ctx.fillRect(x - wickWidth / 2, y + wickTop, wickWidth, wickHeight);
        ctx.globalAlpha = bodyAlpha;
        ctx.fillRect(
          x - bar.bodyWidth / 2,
          y - bar.bodyHeight / 2,
          bar.bodyWidth,
          bar.bodyHeight,
        );
        continue;
      }

      const pad = Math.ceil(bar.blur * 3);
      const sw = Math.ceil(bar.bodyWidth) + pad * 2;
      const sh = Math.ceil(wickHeight + Math.abs(wickTop) * 2) + pad * 2;
      // Assigning the size also clears the scratch canvas.
      scratch.width = sw;
      scratch.height = sh;
      sctx.globalCompositeOperation = "lighter";
      sctx.fillStyle = palette.bars[bar.colorIndex];
      sctx.globalAlpha = bodyAlpha * WICK_ALPHA;
      sctx.fillRect(
        sw / 2 - wickWidth / 2,
        sh / 2 + wickTop,
        wickWidth,
        wickHeight,
      );
      sctx.globalAlpha = bodyAlpha;
      sctx.fillRect(
        sw / 2 - bar.bodyWidth / 2,
        sh / 2 - bar.bodyHeight / 2,
        bar.bodyWidth,
        bar.bodyHeight,
      );

      ctx.filter = `blur(${bar.blur.toFixed(2)}px)`;
      ctx.globalAlpha = 1;
      ctx.drawImage(scratch, x - sw / 2, y - sh / 2);
      ctx.filter = "none";
    }

    ctx.globalAlpha = 1;
  }, [bars, frame, width, height, durationInFrames, palette]);

  return (
    <AbsoluteFill>
      <canvas
        ref={ref}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
