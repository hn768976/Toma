import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import { ShaderCanvas } from "./gl/ShaderCanvas";
import { PALETTES, type PaletteName } from "./palettes";

export type LiquidGlitterSilkProps = {
  palette: PaletteName;
};

/**
 * Iridescent glitter "liquid silk": a WebGL2 fragment shader rendered at the
 * composition's native resolution (3840x2160). The camera slowly rotates and
 * pushes in while the folds flow, matching the reference's drift.
 */
export const LiquidGlitterSilk: React.FC<LiquidGlitterSilkProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const t = frame / fps;
  const progress = frame / (durationInFrames - 1);

  const ease = Easing.inOut(Easing.sin);
  const rotation = interpolate(progress, [0, 1], [-0.25, 0.72], { easing: ease });
  const zoom = interpolate(progress, [0, 1], [4.0, 3.4], { easing: ease });
  const panX = interpolate(progress, [0, 1], [0.1, 0.55], { easing: ease });
  const panY = interpolate(progress, [0, 1], [0.0, -0.35], { easing: ease });

  const colors = PALETTES[palette];
  const uniforms = useMemo(
    () => ({
      uTime: t,
      uProgress: progress,
      uCam: [rotation, zoom, 0] as const,
      uCamOffset: [panX, panY] as const,
      ...colors,
    }),
    [t, progress, rotation, zoom, panX, panY, colors],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ShaderCanvas width={width} height={height} uniforms={uniforms} />
    </AbsoluteFill>
  );
};
