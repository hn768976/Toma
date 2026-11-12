import React, { useMemo } from "react";
import { useVideoConfig } from "remotion";
import { GLCanvas } from "../engine/GLCanvas";
import { createFiberRenderer } from "./createFiberRenderer";
import { auroraVariant, referenceVariant } from "./variants";

export const FiberStreams: React.FC<{ variant: "v1" | "v2" }> = ({ variant }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const create = useMemo(
    () => createFiberRenderer(variant === "v1" ? referenceVariant : auroraVariant, fps, durationInFrames),
    [variant, fps, durationInFrames],
  );
  return <GLCanvas create={create} />;
};
