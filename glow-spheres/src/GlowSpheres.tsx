import { useMemo } from "react";
import { z } from "zod";
import { ThreeStage } from "./lib/ThreeStage";
import { CYAN_PALETTE, REFERENCE_PALETTE } from "./spheres/palette";
import { createSphereStage } from "./spheres/scene";

export const glowSpheresSchema = z.object({
  palette: z.enum(["ultraviolet", "electric-cyan"]),
  seed: z.number(),
  /** WebGL backing-store scale relative to the 4K composition (1 = native 4K). */
  pixelRatio: z.number().min(0.25).max(2),
});
export type GlowSpheresProps = z.infer<typeof glowSpheresSchema>;

export const GlowSpheres: React.FC<GlowSpheresProps> = ({ palette, seed, pixelRatio }) => {
  const pal = palette === "electric-cyan" ? CYAN_PALETTE : REFERENCE_PALETTE;
  const factory = useMemo(() => createSphereStage({ palette: pal, seed }), [pal, seed]);
  return <ThreeStage factory={factory} pixelRatio={pixelRatio} background={pal.background} />;
};
