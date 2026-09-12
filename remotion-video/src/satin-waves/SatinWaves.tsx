import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { createSatinRenderer, type SatinRenderer } from "./gl";
import { THEMES, type ThemeName } from "./palette";

export const satinWavesSchema = z.object({
  theme: z.enum(["light", "dark"]),
  /**
   * Depth of the folds. 1 is the tuned default; the prop is here so the look
   * can be dialled in the Studio without touching the palette.
   */
  depthScale: z.number().min(0.2).max(2.5),
});

export type SatinWavesProps = z.infer<typeof satinWavesSchema>;

export const satinWavesDefaults: SatinWavesProps = {
  theme: "light",
  depthScale: 1,
};

export const SatinWaves: React.FC<SatinWavesProps> = ({
  theme,
  depthScale,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SatinRenderer | null>(null);

  // useLayoutEffect, not useEffect: this has to paint before Remotion
  // screenshots the frame, otherwise every frame lags one behind.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!rendererRef.current) {
      rendererRef.current = createSatinRenderer(canvas);
    }
    const base = THEMES[theme as ThemeName];
    rendererRef.current.draw({
      // frame / durationInFrames, so frame 0 and frame `durationInFrames`
      // are the same image and the loop is seamless.
      t: frame / durationInFrames,
      frame,
      theme: { ...base, bump: base.bump * depthScale },
    });
  }, [frame, durationInFrames, theme, depthScale, width, height]);

  return (
    <AbsoluteFill style={{ backgroundColor: THEMES[theme as ThemeName].mid }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
