import { useLayoutEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { PULSE_AMOUNT, PULSE_PERIOD, SPACINGS_PER_LOOP } from "./config";
import { renderFrame } from "./draw";
import { PALETTES } from "./palettes";

export type GridCorridorProps = {
  palette: keyof typeof PALETTES;
};

export const GridCorridor: React.FC<GridCorridorProps> = ({ palette }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    // Loop phase. SPACINGS_PER_LOOP is an integer, so at `frame ===
    // durationInFrames` this lands back on exactly 0 and the frame is identical
    // to frame 0.
    const advanced = (frame / durationInFrames) * SPACINGS_PER_LOOP;
    const phase = advanced - Math.floor(advanced);

    // Whole-grid breathing. The period divides 450 exactly, so the pulse is
    // continuous across the loop point too.
    const pulse = 1 + PULSE_AMOUNT * Math.sin((2 * Math.PI * frame) / PULSE_PERIOD);

    renderFrame(ctx, {
      frame,
      width,
      height,
      phase,
      pulse,
      palette: PALETTES[palette],
    });
  }, [frame, width, height, durationInFrames, palette]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{ width, height, display: "block" }}
    />
  );
};
