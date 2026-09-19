import React, { useMemo } from "react";
import { z } from "zod";
import { zColor } from "@remotion/zod-types";
import { PixiPlate } from "../shared/PixiPlate";
import { rgb } from "../shared/color";
import { BOKEH_CURTAIN_FRAG } from "./shader";

export const bokehCurtainSchema = z.object({
  backTop: zColor(),
  backBottom: zColor(),
  warm: zColor(),
  cool: zColor(),
  warmBias: z.number().min(0).max(1),
  sway: z.number().min(0).max(0.5),
  twinkle: z.number().min(0).max(1),
  density: z.number().min(0.05).max(1),
  shimmer: z.number().min(0).max(1),
  hotspot: z.number().min(0).max(2),
  spill: z.number().min(0).max(1),
  exposure: z.number().min(0.2).max(3),
  grainAmount: z.number().min(0).max(0.2),
  seed: z.number(),
});

export type BokehCurtainProps = z.infer<typeof bokehCurtainSchema>;

// Sampled off the reference: teal field, amber foreground lights, steel
// blue-white background lights.
export const bokehCurtainDefaults: BokehCurtainProps = {
  backTop: "#27506d",
  backBottom: "#376d86",
  warm: "#f7ad60",
  cool: "#c3d9e6",
  warmBias: 0.58,
  sway: 0.028,
  twinkle: 0.95,
  density: 0.97,
  hotspot: 0.45,
  shimmer: 0.60,
  spill: 0.30,
  exposure: 0.94,
  grainAmount: 0.022,
  seed: 4.0,
};

export const BokehCurtain: React.FC<BokehCurtainProps> = ({
  backTop,
  backBottom,
  warm,
  cool,
  warmBias,
  sway,
  twinkle,
  density,
  hotspot,
  shimmer,
  spill,
  exposure,
  grainAmount,
  seed,
}) => {
  const uniforms = useMemo(
    () => ({
      uBackTop: rgb(backTop),
      uBackBottom: rgb(backBottom),
      uWarm: rgb(warm),
      uCool: rgb(cool),
      uWarmBias: warmBias,
      uSway: sway,
      uTwinkle: twinkle,
      uDensity: density,
      uHotspot: hotspot,
      uSpill: spill,
    }),
    [backTop, backBottom, warm, cool, warmBias, sway, twinkle, density, hotspot, spill],
  );

  return (
    <PixiPlate
      name="bokeh-curtain"
      fragment={BOKEH_CURTAIN_FRAG}
      uniforms={uniforms}
      shimmer={shimmer}
      exposure={exposure}
      grainAmount={grainAmount}
      seed={seed}
    />
  );
};
