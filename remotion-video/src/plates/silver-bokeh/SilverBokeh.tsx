import React, { useMemo } from "react";
import { z } from "zod";
import { zColor } from "@remotion/zod-types";
import { PixiPlate } from "../shared/PixiPlate";
import { rgb } from "../shared/color";
import { SILVER_BOKEH_FRAG } from "./shader";

export const silverBokehSchema = z.object({
  fieldTop: zColor(),
  fieldBottom: zColor(),
  discTint: zColor(),
  shadeTint: zColor(),
  discGain: z.number().min(0).max(3),
  shade: z.number().min(0).max(1),
  hotspot: z.number().min(0).max(1),
  shimmer: z.number().min(0).max(1),
  hotspotX: z.number().min(-0.5).max(1.5),
  hotspotY: z.number().min(-0.5).max(1.5),
  exposure: z.number().min(0.2).max(3),
  grainAmount: z.number().min(0).max(0.2),
  seed: z.number(),
});

export type SilverBokehProps = z.infer<typeof silverBokehSchema>;

// Sampled off the reference: a #e2e3e5 field, barely cooler than neutral,
// with discs only a few percent brighter than what they sit on.
export const silverBokehDefaults: SilverBokehProps = {
  fieldTop: "#eceef0",
  fieldBottom: "#dcdee1",
  discTint: "#ffffff",
  shadeTint: "#9aa3ad",
  discGain: 0.30,
  shade: 0.11,
  hotspot: 0.10,
  shimmer: 1.0,
  hotspotX: 0.24,
  hotspotY: 0.22,
  exposure: 1.015,
  grainAmount: 0.014,
  seed: 8.0,
};

export const SilverBokeh: React.FC<SilverBokehProps> = (p) => {
  const uniforms = useMemo(
    () => ({
      uFieldTop: rgb(p.fieldTop),
      uFieldBottom: rgb(p.fieldBottom),
      uDiscTint: rgb(p.discTint),
      uShadeTint: rgb(p.shadeTint),
      uDiscGain: p.discGain,
      uShade: p.shade,
      uHotspot: p.hotspot,
      uHotspotPos: [p.hotspotX, p.hotspotY],
    }),
    [p.fieldTop, p.fieldBottom, p.discTint, p.shadeTint, p.discGain, p.shade,
     p.hotspot, p.hotspotX, p.hotspotY],
  );

  return (
    <PixiPlate
      name="silver-bokeh"
      fragment={SILVER_BOKEH_FRAG}
      uniforms={uniforms}
      shimmer={p.shimmer}
      exposure={p.exposure}
      grainAmount={p.grainAmount}
      seed={p.seed}
    />
  );
};
