import React, { useMemo } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import { z } from "zod";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "../common/constants";
import { DesignSpace } from "../common/DesignSpace";
import { easeInOut, easeOut, ramp } from "../common/math";
import { ShaderCanvas } from "../common/ShaderCanvas";
import { useFonts } from "../common/useFonts";
import { cameraUniforms, project } from "./camera";
import { CloseHud } from "./CloseHud";
import { SATELLITE_PALETTE } from "./palette";
import { CLOSE_BOUNDS, VIEW_FRAG, WIDE_BOUNDS } from "./terrain.frag";
import { cameraAt, diveScale, T, WIDE_TARGET } from "./timeline";
import { WideHud } from "./WideHud";

export const satelliteSchema = z.object({
  /**
   * "reference" follows the reference near-top-down satellite pass.
   * "orbit" re-shoots the same sequence with an oblique, orbiting camera.
   */
  variant: z.enum(["reference", "orbit"]),
});

export type SatelliteProps = z.infer<typeof satelliteSchema>;

/** Lens radius (fraction of frame height) at rest in the regional shot. */
const LENS_R = 0.37;

export const SatelliteTargeting: React.FC<SatelliteProps> = ({ variant }) => {
  useFonts();
  const frame = useCurrentFrame();
  const pal = SATELLITE_PALETTE;
  const cam = cameraAt(frame, variant);

  // Lens follows the locked target and scales with the dive, then lets go.
  const tgt = project(cam, WIDE_TARGET.x, WIDE_TARGET.y, DESIGN_WIDTH, DESIGN_HEIGHT);
  const scale = diveScale(frame, variant);
  const lensReveal = ramp(frame, T.lensStart, T.lensFull, easeOut);
  const lensFade = 1 - ramp(frame, T.zoomStart + 14, T.zoomEnd - 4, easeInOut);
  const lensAlpha = frame < T.lensStart ? 0 : lensFade;
  const lensR = LENS_R * (frame > T.zoomStart ? scale : 1) * (0.96 + 0.04 * lensReveal);

  // Exposure pop as the scan engages and a soft flash at the end of the dive.
  const flash =
    0.12 * Math.exp(-Math.pow((frame - T.lensStart - 4) / 6, 2));

  const uniforms = useMemo(
    () => ({
      ...cameraUniforms(cam),
      uTime: frame / 30,
      uShadow: pal.shadow,
      uMid: pal.mid,
      uLight: pal.light,
      uGridColor: pal.grid,
      // Fade the ground grid out and back in around the period switch.
      uGridAlpha:
        (frame < (T.zoomStart + T.zoomEnd) / 2 ? 0.16 : 0.1) *
        Math.min(1, Math.abs(frame - (T.zoomStart + T.zoomEnd) / 2) / 10),
      uGridPeriod: frame < (T.zoomStart + T.zoomEnd) / 2 ? 8 : 1.6,
      uLensC: tgt ? [tgt.x / DESIGN_WIDTH, tgt.y / DESIGN_HEIGHT] : [0.5, 0.5],
      uLensR: lensR,
      uLensReveal: lensReveal,
      uLensAlpha: lensAlpha,
      uSweep: ((frame - T.lensFull) / 30) * 1.9,
      uLensTint: pal.lensTint,
      uHaze: pal.haze,
      uWideB: [...WIDE_BOUNDS],
      uCloseB: [...CLOSE_BOUNDS],
      uExposure: 1.05 + flash,
      uVignette: 0.7,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frame, variant],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0f12" }}>
      <ShaderCanvas
        fragment={VIEW_FRAG}
        uniforms={uniforms}
        textures={{
          uWide: staticFile("terrain/terrain-wide.jpg"),
          uClose: staticFile("terrain/terrain-close.jpg"),
        }}
      />
      <DesignSpace>
        <WideHud
          frame={frame}
          cam={cam}
          variant={variant}
          lensR={lensR * DESIGN_HEIGHT}
          lensAlpha={lensAlpha}
          palette={pal}
        />
        <CloseHud frame={frame} cam={cam} variant={variant} palette={pal} />
      </DesignSpace>
    </AbsoluteFill>
  );
};
