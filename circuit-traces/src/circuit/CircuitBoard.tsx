import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { drawFrame } from "./draw";
import { buildBoard } from "./geometry";
import { Palette, V1_NEON, V2_AMBER } from "./palette";
import { buildPulses } from "./pulses";
import { clamp } from "./rng";

/**
 * The board network and the pulse schedule are built once at module scope from
 * a fixed seed. They never depend on the frame, so every thread in a
 * distributed render produces byte-identical geometry.
 */
const BOARD = buildBoard(0x0c1b7a3);

export type Variant = "neon" | "amber";

const PALETTES: Record<Variant, Palette> = {
  neon: V1_NEON,
  amber: V2_AMBER,
};

const PULSES = {
  neon: buildPulses(BOARD, 0x51a1a1, 132, V1_NEON.whitePulses),
  amber: buildPulses(BOARD, 0x51a1a1, 132, V2_AMBER.whitePulses),
};

export const CircuitBoard: React.FC<{ variant: Variant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);

  // Backing-store scale. Under `--scale=0.5` the browser reports a device pixel
  // ratio of 0.5, so the preview renders at 1920 wide while the composition
  // stays defined at 3840. Every size in the project is a fraction of the frame
  // width, so the two are the same picture.
  const dpr = useMemo(
    () =>
      clamp(
        typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
        0.25,
        2,
      ),
    [],
  );
  const S = Math.round(width * dpr);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    drawFrame({
      ctx,
      board: BOARD,
      palette: PALETTES[variant],
      pulses: PULSES[variant],
      S,
      frame,
      durationInFrames,
    });
  }, [frame, S, variant, durationInFrames]);

  return (
    <canvas
      ref={ref}
      width={S}
      height={Math.round(height * dpr)}
      style={{
        width,
        height,
        display: "block",
        backgroundColor: PALETTES[variant].bg,
      }}
    />
  );
};
