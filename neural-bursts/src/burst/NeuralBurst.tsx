import React, { useMemo } from "react";
import { z } from "zod";
import { GLStage } from "../lib/GLStage";
import { createBurstStage } from "./BurstScene";
import { BLUE, SOLAR } from "./palettes";

export const neuralBurstSchema = z.object({
  variant: z.enum(["v1-reference", "v2-solar"]),
});

export const NeuralBurst: React.FC<z.infer<typeof neuralBurstSchema>> = ({
  variant,
}) => {
  const factory = useMemo(
    () => createBurstStage(variant === "v2-solar" ? SOLAR : BLUE, 1337),
    [variant],
  );
  return <GLStage factory={factory} />;
};
