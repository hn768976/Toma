import { useMemo } from "react";
import { z } from "zod";
import { ThreeStage } from "./lib/ThreeStage";
import { REFERENCE_PALETTE } from "./toggle/palette";
import { createToggleStage } from "./toggle/scene";

export const toggleFieldSchema = z.object({
  camera: z.enum(["top-down", "orbit"]),
  seed: z.number(),
  /** WebGL backing-store scale relative to the 4K composition (1 = native 4K). */
  pixelRatio: z.number().min(0.25).max(2),
});
export type ToggleFieldProps = z.infer<typeof toggleFieldSchema>;

export const ToggleField: React.FC<ToggleFieldProps> = ({ camera, seed, pixelRatio }) => {
  const factory = useMemo(
    () => createToggleStage({ palette: REFERENCE_PALETTE, camera, seed }),
    [camera, seed],
  );
  return (
    <ThreeStage
      factory={factory}
      pixelRatio={pixelRatio}
      background={REFERENCE_PALETTE.background}
    />
  );
};
