import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { PALETTES, PaletteName } from "./color";
import {
  BLOOM_BLUR_PX,
  BLOOM_DOWNSCALE,
  BLOOM_OPACITY,
  GLOW_X,
  GLOW_Y,
  WIDTH,
} from "./constants";
import { createRenderState, drawFrame } from "./draw";
import { GRAIN_TILE_COUNT, createGrainTiles } from "./grain";
import { toScreenX, toScreenY } from "./sheet";

export type HalftoneWaveProps = {
  palette: PaletteName;
};

export const HalftoneWave: React.FC<HalftoneWaveProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const mainRef = useRef<HTMLCanvasElement>(null);
  const bloomRef = useRef<HTMLCanvasElement>(null);

  const state = useMemo(() => createRenderState(PALETTES[palette]), [palette]);
  const grainTiles = useMemo(() => createGrainTiles(), []);

  // All geometry is authored at the 3840x2160 master size and scaled to
  // whatever the composition actually is, so the layout is identical at
  // 1080p and 4K.
  const k = width / WIDTH;
  const bloomWidth = Math.ceil(width / BLOOM_DOWNSCALE);
  const bloomHeight = Math.ceil(height / BLOOM_DOWNSCALE);

  // Where the sheet is densest — both the wide glow and the bloom mask sit here.
  const denseX = toScreenX(state.sheet, GLOW_X, GLOW_Y) * k;
  const denseY = toScreenY(state.sheet, GLOW_X, GLOW_Y) * k;

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const ctx = main.getContext("2d", { alpha: false });
    if (!ctx) return;

    drawFrame(ctx, state, width, height, frame / durationInFrames, k);

    // Bloom: a cheap downscaled copy of the dot layer. It is blurred and
    // masked in CSS, so only the densest region picks up any halation —
    // blooming the whole frame would fuse the dots and kill the halftone.
    const bloom = bloomRef.current;
    if (bloom) {
      const bctx = bloom.getContext("2d");
      if (bctx) {
        bctx.clearRect(0, 0, bloomWidth, bloomHeight);
        bctx.drawImage(main, 0, 0, bloomWidth, bloomHeight);
      }
    }
  }, [frame, width, height, durationInFrames, k, state, bloomWidth, bloomHeight]);

  const bloomMask = `radial-gradient(circle ${2200 * k}px at ${denseX}px ${denseY}px, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0) 72%)`;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <canvas
        ref={mainRef}
        width={width}
        height={height}
        style={{ width, height, display: "block" }}
      />
      <canvas
        ref={bloomRef}
        width={bloomWidth}
        height={bloomHeight}
        style={{
          position: "absolute",
          inset: 0,
          width,
          height,
          opacity: BLOOM_OPACITY,
          filter: `blur(${BLOOM_BLUR_PX * BLOOM_DOWNSCALE * k}px)`,
          mixBlendMode: "plus-lighter",
          WebkitMaskImage: bloomMask,
          maskImage: bloomMask,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${grainTiles[frame % GRAIN_TILE_COUNT]})`,
          backgroundRepeat: "repeat",
          mixBlendMode: "plus-lighter",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

export const halftoneWaveDefaults: HalftoneWaveProps = { palette: "magenta" };
