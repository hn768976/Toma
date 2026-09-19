import React, { useMemo } from "react";
import { z } from "zod";
import { zColor } from "@remotion/zod-types";
import { PixiPlate } from "../shared/PixiPlate";
import { rgb } from "../shared/color";
import { GOLDEN_RAYS_FRAG } from "./shader";

export const goldenRaysSchema = z.object({
  foliageDark: zColor(),
  foliageLit: zColor(),
  sunCore: zColor(),
  gold: zColor(),
  sunPosX: z.number().min(-0.5).max(1.5),
  sunPosY: z.number().min(-0.5).max(1.5),
  sunSize: z.number().min(0.02).max(1),
  rayStrength: z.number().min(0).max(3),
  rayDetail: z.number().min(1).max(24),
  bokehGain: z.number().min(0).max(3),
  haze: z.number().min(0).max(1),
  shimmer: z.number().min(0).max(1),
  shimmerRate: z.number().min(0.02).max(3),
  exposure: z.number().min(0.2).max(3),
  grainAmount: z.number().min(0).max(0.2),
  seed: z.number(),
});

export type GoldenRaysProps = z.infer<typeof goldenRaysSchema>;

// Sampled off the reference: olive greens under a blown #fffde5 core,
// everything veiled by warm glare.
export const goldenRaysDefaults: GoldenRaysProps = {
  foliageDark: "#222e0e",
  foliageLit: "#94903c",
  sunCore: "#fffdea",
  gold: "#f0c579",
  sunPosX: 0.78,
  sunPosY: 0.18,
  sunSize: 0.17,
  rayStrength: 0.78,
  rayDetail: 4.4,
  bokehGain: 0.92,
  haze: 0.19,
  shimmer: 0.95,
  shimmerRate: 0.15,
  exposure: 1.34,
  grainAmount: 0.022,
  seed: 6.0,
};

export const GoldenRays: React.FC<GoldenRaysProps> = (p) => {
  const uniforms = useMemo(
    () => ({
      uFoliageDark: rgb(p.foliageDark),
      uFoliageLit: rgb(p.foliageLit),
      uSunCore: rgb(p.sunCore),
      uGold: rgb(p.gold),
      uSunPos: [p.sunPosX, p.sunPosY],
      uSunSize: p.sunSize,
      uRayStrength: p.rayStrength,
      uRayDetail: p.rayDetail,
      uBokehGain: p.bokehGain,
      uHaze: p.haze,
    }),
    [p.foliageDark, p.foliageLit, p.sunCore, p.gold, p.sunPosX, p.sunPosY,
     p.sunSize, p.rayStrength, p.rayDetail, p.bokehGain, p.haze],
  );

  return (
    <PixiPlate
      name="golden-rays"
      fragment={GOLDEN_RAYS_FRAG}
      uniforms={uniforms}
      shimmer={p.shimmer}
      shimmerRate={p.shimmerRate}
      exposure={p.exposure}
      grainAmount={p.grainAmount}
      seed={p.seed}
    />
  );
};
