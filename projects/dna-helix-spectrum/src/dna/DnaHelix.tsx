import React, { useMemo } from "react";
import { useVideoConfig } from "remotion";
import { GLCanvas } from "../engine/GLCanvas";
import { createDnaRenderer } from "./createDnaRenderer";
import { orbitVariant, referenceVariant } from "./variants";

export const DnaHelix: React.FC<{ variant: "v1" | "v2" }> = ({ variant }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const create = useMemo(
    () => createDnaRenderer(variant === "v1" ? referenceVariant : orbitVariant, fps, durationInFrames),
    [variant, fps, durationInFrames],
  );
  return <GLCanvas create={create} />;
};
