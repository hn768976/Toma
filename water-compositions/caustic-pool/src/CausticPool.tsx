import React, { useMemo } from "react";
import { z } from "zod";
import { ShaderCanvas } from "./ShaderCanvas";
import { causticFrag } from "./shaders/caustic";

const rgb = z.tuple([z.number(), z.number(), z.number()]);

export const causticPoolSchema = z.object({
  /** 5-stop colour ramp from deepest shadow to brightest caustic. */
  palette: z.tuple([rgb, rgb, rgb, rgb, rgb]),
  /** Amplitude of the per-pixel dither that prevents 8-bit banding. */
  grain: z.number().min(0).max(0.05),
});

export type CausticPoolProps = z.infer<typeof causticPoolSchema>;

export const CausticPool: React.FC<CausticPoolProps> = ({ palette, grain }) => {
  const uniforms = useMemo(
    () => ({
      uC0: palette[0],
      uC1: palette[1],
      uC2: palette[2],
      uC3: palette[3],
      uC4: palette[4],
      uGrain: grain,
    }),
    [palette, grain],
  );
  return <ShaderCanvas fragmentShader={causticFrag} uniforms={uniforms} />;
};
