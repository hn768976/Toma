import React, { useMemo } from "react";
import { z } from "zod";
import { ThreeStage } from "../three/ThreeStage";
import { PALETTES } from "./palettes";
import { createCodeStreamStage } from "./scene";

export const codeStreamSchema = z.object({
  variant: z.enum(["v1", "v2"]),
});

export const CodeStream: React.FC<z.infer<typeof codeStreamSchema>> = ({
  variant,
}) => {
  const factory = useMemo(
    () => createCodeStreamStage(PALETTES[variant]),
    [variant],
  );
  return <ThreeStage factory={factory} />;
};
