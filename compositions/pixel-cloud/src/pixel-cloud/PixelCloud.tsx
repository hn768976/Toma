import React, { useMemo } from "react";
import { z } from "zod";
import { ThreeStage } from "../three/ThreeStage";
import { createPixelCloudStage } from "./scene";

export const pixelCloudSchema = z.object({
  camera: z.enum(["locked", "orbit"]),
});

export const PixelCloud: React.FC<z.infer<typeof pixelCloudSchema>> = ({
  camera,
}) => {
  const factory = useMemo(() => createPixelCloudStage(camera), [camera]);
  return <ThreeStage factory={factory} />;
};
