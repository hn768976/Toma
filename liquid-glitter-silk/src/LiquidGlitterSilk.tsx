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

  // Accelerating camera: slow start, building rotation and push-in (like the reference).
  const accel = Easing.in(Easing.quad);
  const rotation = interpolate(progress, [0, 1], [0.25, 1.75], { easing: accel });
  const zoom = interpolate(progress, [0, 1], [4.2, 2.7], { easing: accel });
  const panX = interpolate(progress, [0, 1], [0.1, 0.7], { easing: accel });
  const panY = interpolate(progress, [0, 1], [0.0, -0.45], { easing: accel });
  // Brightness arc: dim open, high-key lime around 4-5 s, settling back down.
  const exposure = interpolate(progress, [0, 0.25, 0.5, 0.62, 0.85, 1], [0.68, 0.95, 1.4, 1.38, 1.08, 0.98], {
    easing: Easing.inOut(Easing.sin),
  });
  const sheetBias = interpolate(progress, [0, 0.5, 0.62, 1], [-0.06, 0.12, 0.1, -0.08], {
    easing: Easing.inOut(Easing.sin),
  });
  const flowTime = t * 1.5;

  const colors = PALETTES[palette];
  const uniforms = useMemo(
    () => ({
      uTime: flowTime,
      uProgress: progress,
      // the pale aqua sheet needs a little less exposure than acid lime
      uExposure: exposure * (palette === "aquaGold" ? 0.86 : 1),
      uSheetBias: sheetBias,
      uCam: [rotation, zoom, 0] as const,
      uCamOffset: [panX, panY] as const,
      ...colors,
    }),
    [flowTime, progress, exposure, palette, sheetBias, rotation, zoom, panX, panY, colors],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ShaderCanvas width={width} height={height} uniforms={uniforms} />
    </AbsoluteFill>
  );
};
