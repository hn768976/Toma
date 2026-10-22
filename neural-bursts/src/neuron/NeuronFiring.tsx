import React, { useMemo } from "react";
import { z } from "zod";
import { GLStage } from "../lib/GLStage";
import { createNeuronStage, orbitCamera, referenceCamera } from "./NeuronScene";

export const neuronFiringSchema = z.object({
  variant: z.enum(["v1-reference", "v2-orbit"]),
});

export const NeuronFiring: React.FC<z.infer<typeof neuronFiringSchema>> = ({
  variant,
}) => {
  const factory = useMemo(
    () =>
      createNeuronStage(
        variant === "v2-orbit" ? orbitCamera : referenceCamera,
        2024,
      ),
    [variant],
  );
  return <GLStage factory={factory} />;
};
