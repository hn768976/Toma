import React, { useMemo } from "react";
import { z } from "zod";
import { zColor } from "@remotion/zod-types";
import { PixiPlate } from "../shared/PixiPlate";
import { rgb } from "../shared/color";
import { DEEP_BLUE_DUST_FRAG } from "./shader";

export const deepBlueDustSchema = z.object({
  deep: zColor(),
  nebula: zColor(),
  discCool: zColor(),
  discTeal: zColor(),
  dustColor: zColor(),
  lightCentreX: z.number().min(-0.5).max(1.5),
  lightCentreY: z.number().min(-0.5).max(1.5),
  nebulaGain: z.number().min(0).max(4),
  discGain: z.number().min(0).max(4),
  hollow: z.number().min(0).max(1),
  dustGain: z.number().min(0).max(3),
  dustTwinkle: z.number().min(0).max(3),
  vignetteAmount: z.number().min(0).max(1),
  shimmer: z.number().min(0).max(1),
  shimmerRate: z.number().min(0.02).max(3),
  blur: z.number().min(0).max(30),
  exposure: z.number().min(0.2).max(3),
  grainAmount: z.number().min(0).max(0.2),
  seed: z.number(),
});

export type DeepBlueDustProps = z.infer<typeof deepBlueDustSchema>;

// Sampled off the reference: #00091a in the dark corner rising to a
// #4b7da4 mass held up and to the right.
export const deepBlueDustDefaults: DeepBlueDustProps = {
  deep: "#01060f",
  nebula: "#2a6296",
  discCool: "#5f9fd4",
  discTeal: "#5fc9c0",
  dustColor: "#d8ecff",
  lightCentreX: 0.74,
  lightCentreY: 0.30,
  nebulaGain: 0.92,
  discGain: 0.78,
  hollow: 0.42,
  dustGain: 1.0,
  dustTwinkle: 1.7,
  vignetteAmount: 0.78,
  shimmer: 1.0,
  shimmerRate: 0.15,
  blur: 6.0,
  exposure: 1.24,
  grainAmount: 0.018,
  seed: 2.0,
};

export const DeepBlueDust: React.FC<DeepBlueDustProps> = (p) => {
  const uniforms = useMemo(
    () => ({
      uDeep: rgb(p.deep),
      uNebula: rgb(p.nebula),
      uDiscCool: rgb(p.discCool),
      uDiscTeal: rgb(p.discTeal),
      uDustColor: rgb(p.dustColor),
      uLightCentre: [p.lightCentreX, p.lightCentreY],
      uNebulaGain: p.nebulaGain,
      uDiscGain: p.discGain,
      uHollow: p.hollow,
      uDustGain: p.dustGain,
      uDustTwinkle: p.dustTwinkle,
      uVignetteAmount: p.vignetteAmount,
    }),
    [p.deep, p.nebula, p.discCool, p.discTeal, p.dustColor, p.lightCentreX,
     p.lightCentreY, p.nebulaGain, p.discGain, p.hollow, p.dustGain,
     p.dustTwinkle, p.vignetteAmount],
  );

  return (
    <PixiPlate
      name="deep-blue-dust"
      fragment={DEEP_BLUE_DUST_FRAG}
      uniforms={uniforms}
      shimmer={p.shimmer}
      shimmerRate={p.shimmerRate}
      blur={p.blur}
      exposure={p.exposure}
      grainAmount={p.grainAmount}
      seed={p.seed}
    />
  );
};
