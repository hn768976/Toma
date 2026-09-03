import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import {
  GRAIN_OPACITY,
  REST_CORE_X,
  REST_CORE_Y,
  REST_RING_ALPHA,
  SOFT_WIDTH,
} from "./constants";
import { drawFlareSharp, drawFlareSoft, flareColors } from "./flare";
import { drawHaze, hazeColors, hazeOffscreenSize } from "./haze";
import { buildGrainTiles, drawGrain } from "./grain";
import { GOLD, paletteSchema } from "./palettes";
import {
  coreBrightness,
  coreRadiusFactor,
  corePosition,
  ghostDrive,
  restingRing,
  ringDrive,
  streakDrive,
} from "./timeline";

export const lightBurstSchema = z.object({
  palette: paletteSchema,
  /**
   * Film grain opacity. Kept exposed because it is the dial you reach for if
   * the encoded output bands — raise it (or the bitrate) rather than trying to
   * smooth the gradients further.
   */
  grainOpacity: z.number().min(0).max(0.2),
});

export type LightBurstProps = z.infer<typeof lightBurstSchema>;

export const lightBurstDefaults: LightBurstProps = {
  palette: GOLD,
  grainOpacity: GRAIN_OPACITY,
};

const createCanvas = (width: number, height: number) => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

/**
 * Anamorphic light burst — a warm core blooming out of a blue haze, sweeping
 * across frame with iris rings and a ghost train, then fading back to the
 * drifting bokeh it started on.
 *
 * Deliberately 2D. There is no parallax anywhere in this shot: it is a pure
 * screen-space optical composite, and a 3D camera would add cost and nothing
 * else. The one structural idea worth knowing is that every flare element is
 * positioned from the core and the frame centre, never animated on its own
 * track — that coupling is what makes it read as a lens rather than a stack
 * of PNGs sliding around.
 *
 * Three canvases, in order:
 *  - soft    fixed 1920-wide backing, stretched. Haze, warm falloff, ghosts,
 *            streak, ring glow. All of it is out of focus, so the upscale
 *            costs nothing visually and saves most of the 4K frame budget.
 *  - sharp   full composition resolution. Iris rings and the hot centre only.
 *  - grain   fixed 1920-wide backing. Dither, over everything.
 */
export const LightBurst: React.FC<LightBurstProps> = ({
  palette,
  grainOpacity,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const softWidth = SOFT_WIDTH;
  const softHeight = Math.round((SOFT_WIDTH * height) / width);

  const softRef = useRef<HTMLCanvasElement>(null);
  const sharpRef = useRef<HTMLCanvasElement>(null);
  const grainRef = useRef<HTMLCanvasElement>(null);

  const hazeCanvas = useMemo(() => {
    const size = hazeOffscreenSize(softWidth, softHeight);
    return createCanvas(size.width, size.height);
  }, [softWidth, softHeight]);

  const grainTiles = useMemo(() => buildGrainTiles(createCanvas), []);
  const haze = useMemo(() => hazeColors(palette), [palette]);
  const flare = useMemo(() => flareColors(palette), [palette]);

  useLayoutEffect(() => {
    const softCtx = softRef.current?.getContext("2d");
    const sharpCtx = sharpRef.current?.getContext("2d");
    const grainCtx = grainRef.current?.getContext("2d");
    if (!softCtx || !sharpCtx || !grainCtx || !hazeCanvas) return;

    const brightness = coreBrightness(frame);
    const radiusFactor = coreRadiusFactor(brightness);
    const travelling = ringDrive(frame);
    const resting = restingRing(frame);
    const core = corePosition(frame);

    // Haze first — everything else composites additively on top of it.
    drawHaze(
      softCtx,
      hazeCanvas,
      softWidth,
      softHeight,
      frame,
      haze,
      brightness,
    );

    sharpCtx.setTransform(1, 0, 0, 1, 0, 0);
    sharpCtx.clearRect(0, 0, width, height);

    // The travelling flare, riding the core path.
    if (travelling > 0.002 || brightness > 0.002) {
      drawFlareSoft(
        softCtx,
        softWidth,
        softHeight,
        core.x * softWidth,
        core.y * softHeight,
        brightness,
        radiusFactor,
        travelling,
        ghostDrive(brightness),
        streakDrive(brightness),
        flare,
      );
      drawFlareSharp(
        sharpCtx,
        width,
        height,
        core.x * width,
        core.y * height,
        brightness,
        radiusFactor,
        travelling,
        flare,
      );
    }

    // The resting iris ring, parked at the core's ignition point. This is the
    // hinge the loop turns on: it holds the frame-0 state at both ends of the
    // clip and hands over to (and back from) the travelling ring, so frame 270
    // lands exactly on frame 0.
    if (resting > 0.002) {
      drawFlareSoft(
        softCtx,
        softWidth,
        softHeight,
        REST_CORE_X * softWidth,
        REST_CORE_Y * softHeight,
        0,
        0,
        resting * REST_RING_ALPHA,
        0,
        0,
        flare,
      );
      drawFlareSharp(
        sharpCtx,
        width,
        height,
        REST_CORE_X * width,
        REST_CORE_Y * height,
        0,
        0,
        resting * REST_RING_ALPHA,
        flare,
      );
    }

    drawGrain(
      grainCtx,
      softWidth,
      softHeight,
      frame,
      grainTiles,
      grainOpacity,
    );
  }, [
    frame,
    width,
    height,
    softWidth,
    softHeight,
    hazeCanvas,
    grainTiles,
    grainOpacity,
    haze,
    flare,
  ]);

  const fill: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  };

  return (
    <AbsoluteFill style={{ backgroundColor: palette.base }}>
      <canvas ref={softRef} width={softWidth} height={softHeight} style={fill} />
      <canvas
        ref={sharpRef}
        width={width}
        height={height}
        style={{ ...fill, mixBlendMode: "plus-lighter" }}
      />
      {/*
        Plain alpha blend, not "overlay": overlay scales with backdrop
        luminance and would all but vanish in the dark blue haze, which is
        exactly where the banding is worst.
      */}
      <canvas
        ref={grainRef}
        width={softWidth}
        height={softHeight}
        style={fill}
      />
    </AbsoluteFill>
  );
};

// The frame the peak sits on — used for the still export.
export const PEAK_FRAME = 60;
