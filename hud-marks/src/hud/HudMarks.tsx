import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import { GlitchPass } from "./GlitchPass";
import { FRAME_H, FRAME_W } from "./grid";
import { MarkField } from "./MarkField";
import { buildGrainTiles } from "./texture";
import { VARIANTS } from "./variants";
import type { VariantName } from "./types";

/**
 * One canvas, three versions. Every pixel is a pure function of the frame
 * number: no rAF, no CSS animation, no component state, no wall clock.
 *
 * Pass order is fixed by React's commit order — children flush before parents,
 * siblings in render order — so it is always background and marks, then the
 * glitch slices, then grain last.
 */
export const HudMarks: React.FC<{ variant: VariantName }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const config = VARIANTS[variant];

  const grain = useMemo(
    () => buildGrainTiles(config.grain.tile, config.grain.frames),
    [config.grain.tile, config.grain.frames],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const tile = grain[frame % grain.length];
    const pattern = ctx.createPattern(tile, "repeat");
    if (!pattern) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = config.grain.alpha;
    // Nudge the tile each frame so its repeat never sits still.
    const ox = Math.floor(random(`grainX:${frame}`) * config.grain.tile);
    const oy = Math.floor(random(`grainY:${frame}`) * config.grain.tile);
    ctx.translate(-ox, -oy);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, FRAME_W + config.grain.tile, FRAME_H + config.grain.tile);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: config.palette.bg }}>
      <canvas
        ref={canvasRef}
        width={FRAME_W}
        height={FRAME_H}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <MarkField
        variant={config}
        canvasRef={canvasRef}
        frame={frame}
        fps={fps}
        durationInFrames={durationInFrames}
      />
      <GlitchPass
        variant={config}
        seed={variant}
        canvasRef={canvasRef}
        frame={frame}
        durationInFrames={durationInFrames}
      />
    </AbsoluteFill>
  );
};
