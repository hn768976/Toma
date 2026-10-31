import React, { useMemo } from "react";
import { z } from "zod";
import { ShaderCanvas } from "./ShaderCanvas";
import { rippleFrag } from "./shaders/ripple";

export const rippleSurfaceSchema = z.object({
  /** 0 = top-down orthographic, 1 = low-angle perspective dolly. */
  cameraMode: z.union([z.literal(0), z.literal(1)]),
  /** Amplitude of the per-pixel dither that prevents 8-bit banding. */
  grain: z.number().min(0).max(0.05),
});

export type RippleSurfaceProps = z.infer<typeof rippleSurfaceSchema>;

export const RippleSurface: React.FC<RippleSurfaceProps> = ({
  cameraMode,
  grain,
}) => {
  const uniforms = useMemo(
    () => ({ uCamMode: cameraMode, uGrain: grain }),
    [cameraMode, grain],
  );
  return <ShaderCanvas fragmentShader={rippleFrag} uniforms={uniforms} />;
};
