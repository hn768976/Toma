import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import {
  BASE_HEIGHT,
  BASE_MASTER_SIZE,
  CHALK_THEME,
  COPY_COUNT,
  DURATION_IN_FRAMES,
  GOLD_THEME,
  OUTER_RADIUS_FRACTION,
  ZodiacTheme,
  blurForDepth,
  depthOf,
  opacityForDepth,
  radiusForDepth,
  rotationForDepth,
} from "./constants";
import { createNoiseTile } from "./chalk";
import { buildWheelMips, pickMip } from "./wheel";
import { drawStars, generateStars } from "./starfield";
import { fontReady } from "../load-fonts";

export const zodiacTunnelSchema = z.object({
  theme: z.enum(["chalk", "gold"]),
});

export type ZodiacTunnelProps = z.infer<typeof zodiacTunnelSchema>;

export const zodiacTunnelDefaults: ZodiacTunnelProps = { theme: "chalk" };

const THEMES: Record<ZodiacTunnelProps["theme"], ZodiacTheme> = {
  chalk: CHALK_THEME,
  gold: GOLD_THEME,
};

// The wheel is expensive to draw (jittered strokes, a grain mask, a mip
// chain) and identical for every frame, so it is built once per browser
// tab and shared. Remotion reuses a tab across many frames, so this pays
// for itself immediately; it is keyed because a tab may serve both
// compositions.
const wheelCache = new Map<string, HTMLCanvasElement[]>();
const grainCache = new Map<number, HTMLCanvasElement>();

const getGrainTile = (size: number) => {
  const cached = grainCache.get(size);
  if (cached) return cached;
  // Squared noise: mostly nothing, with occasional bright motes -- chalk
  // dust sitting on the board, not an even video-noise wash.
  const tile = createNoiseTile(size, 0x71b3, -0.35, 1.5);
  grainCache.set(size, tile);
  return tile;
};

// Nested zodiac wheels receding into an endless zoom.
//
// Construction (see constants.ts for the depth maths): one wheel bitmap
// is stamped at COPY_COUNT scales, each exactly half the last, and a
// single zoom factor runs 1x -> 2x across the 450 frames. By the final
// frame every stamp has landed precisely where its larger neighbour
// started, so frame 450 is frame 0 again. Rotation does the same trick
// at 360/12 degrees per loop. Nothing here reads state or time directly:
// scale, spin, opacity, blur and mip level are all pure functions of
// useCurrentFrame(), because Remotion renders frames out of order.
export const ZodiacTunnel: React.FC<ZodiacTunnelProps> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const palette = THEMES[theme];
  // 1 at 1080p, 2 at 4K. Every size below is expressed against the frame
  // height so the two compositions stay visually identical.
  const resolutionScale = height / BASE_HEIGHT;
  const masterSize = Math.round(BASE_MASTER_SIZE * resolutionScale);
  const cacheKey = `${palette.id}@${masterSize}`;

  const stars = useMemo(() => generateStars(), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mips, setMips] = useState<HTMLCanvasElement[] | null>(
    () => wheelCache.get(cacheKey) ?? null,
  );
  const [handle] = useState(() => delayRender(`Building zodiac wheel`));
  const released = useRef(false);

  useEffect(() => {
    if (wheelCache.has(cacheKey)) {
      setMips(wheelCache.get(cacheKey) ?? null);
      return;
    }
    let cancelled = false;
    // The sign names are rasterised into the wheel bitmap, so the font
    // has to be resolved before the wheel is built -- not merely before
    // the frame is captured.
    fontReady.then(() => {
      if (cancelled) return;
      const built = buildWheelMips(masterSize, palette);
      wheelCache.set(cacheKey, built);
      setMips(built);
    });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, masterSize, palette]);

  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !mips) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, width, height);

    drawStars(ctx, stars, frame, width, height, resolutionScale, palette.starColor);

    // Loop position. Depth of copy i is i - t, so at t = 1 the whole set
    // has slid inward by exactly one step and the frame repeats.
    const t = (frame % DURATION_IN_FRAMES) / DURATION_IN_FRAMES;
    const outerRadius = (height / 2) * OUTER_RADIUS_FRACTION;
    const centerX = width / 2;
    const centerY = height / 2;

    // Deepest first: the wide copies' dividers and chords then lay over
    // the small ones, the way the reference's long straight lines cut
    // across the wheels near the centre.
    for (let i = COPY_COUNT - 1; i >= 0; i--) {
      const depth = depthOf(i, t);
      const alpha = opacityForDepth(depth);
      if (alpha <= 0.002) continue;

      const radius = radiusForDepth(depth, outerRadius);
      // Master bitmap holds its wheel at 0.48 of its own edge length.
      const destSize = radius / 0.48;
      const blur = blurForDepth(depth, resolutionScale);

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((rotationForDepth(depth) * Math.PI) / 180);
      ctx.globalAlpha = alpha;
      if (blur > 0.05) ctx.filter = `blur(${blur.toFixed(2)}px)`;
      ctx.drawImage(
        pickMip(mips, destSize),
        -destSize / 2,
        -destSize / 2,
        destSize,
        destSize,
      );
      ctx.restore();
    }

    // Dust over everything, at the same weight as the grain baked into
    // the strokes so the board and the drawing read as one surface.
    const grain = getGrainTile(512);
    const pattern = ctx.createPattern(grain, "repeat");
    if (pattern) {
      ctx.globalAlpha = palette.grainOpacity;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    }

    if (!released.current) {
      released.current = true;
      continueRender(handle);
    }
  }, [
    frame,
    mips,
    stars,
    width,
    height,
    resolutionScale,
    palette,
    handle,
  ]);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at center, transparent 38%, ${palette.vignetteColor} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
