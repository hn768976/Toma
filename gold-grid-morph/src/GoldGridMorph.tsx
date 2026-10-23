import { useMemo } from "react";
import { GlCanvas } from "./gl/GlCanvas";
import { createGoldGrid, GoldGridVariant, Tweak } from "./scenes/goldGrid";

export const GoldGridMorph: React.FC<{
  variant: GoldGridVariant;
  tweak?: Tweak;
}> = ({ variant, tweak }) => {
  const key = JSON.stringify(tweak ?? {});
  const create = useMemo(
    () => createGoldGrid(variant, JSON.parse(key)),
    [variant, key],
  );
  return <GlCanvas create={create} />;
};
