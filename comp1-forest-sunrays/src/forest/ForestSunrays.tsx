import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { GlCanvas } from "../gl/GlCanvas";
import { fbm1 } from "../gl/random";
import { buildDiscs, discUniforms } from "./discs";
import { GOLDEN_HOUR_PALETTE, REFERENCE_PALETTE } from "./palettes";
import { LIGHT_CURVE } from "./lightCurve";
import { FOREST_FRAG } from "./shader";

export type ForestProps = {
  variant: "reference" | "golden-hour";
};

const DEG = Math.PI / 180;

export const ForestSunrays: React.FC<ForestProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const palette = variant === "golden-hour" ? GOLDEN_HOUR_PALETTE : REFERENCE_PALETTE;
  const discs = useMemo(() => buildDiscs(1337), []);

  const uniforms = useMemo(() => {
    const { pos, col } = discUniforms(discs, palette, time);
    // Sunlight "breathing" as leaves pass in front of the sun.
    const sunPow = 1 + 0.06 * fbm1(time * 0.5, 3) + 0.04 * fbm1(time * 1.6, 9);
    const exposure = LIGHT_CURVE[Math.min(frame, LIGHT_CURVE.length - 1)];
    const sway = fbm1(time * 0.18, 31);
    const rayFlick = (s: number) => 0.85 + 0.15 * fbm1(time * 0.9, s);
    return {
      uTime: time,
      uFrame: frame,
      uExposure: exposure,
      uDiscCount: discs.length,
      uDisc: pos,
      uDiscCol: col,
      uSun: [0.95 + 0.01 * fbm1(time * 0.2, 41), -0.03],
      uSunPow: sunPow,
      uRayA: [0.778, 0.0, (-24.8 + 0.7 * sway) * DEG, 0.95 * rayFlick(51)],
      uRayB: [1.088, 0.0, (14.3 + 0.5 * sway) * DEG, 0.55 * rayFlick(52)],
      uRayC: [0.95, 0.0, (2.5 + 0.4 * sway) * DEG, 0.14 * rayFlick(53)],
      uRayW: [0.036, 0.034],
      uBgTop: palette.bgTop,
      uBgLow: palette.bgLow,
      uBgSide: palette.bgSide,
      uHaze: palette.haze,
      uFoliage: palette.foliage,
      uFoliage2: palette.foliage2,
      uRayCol: palette.rayCol,
      uSunCol: palette.sunCol,
      uLift: palette.lift,
      uSat: palette.saturation,
    };
  }, [discs, palette, time, frame]);

  return <GlCanvas fragment={FOREST_FRAG} uniforms={uniforms} />;
};
