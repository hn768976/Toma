import { useMemo } from "react";
import { GlCanvas } from "./gl/GlCanvas";
import { createGlassRing, GlassRingVariant } from "./scenes/glassRing";

export const GlassCubeRing: React.FC<{ variant: GlassRingVariant }> = ({
  variant,
}) => {
  const create = useMemo(() => createGlassRing(variant), [variant]);
  return <GlCanvas create={create} />;
};
