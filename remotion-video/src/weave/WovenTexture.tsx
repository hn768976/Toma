import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { PixiWeave } from "./PixiWeave";
import { weaveVariantSchema, weaveVariants, type WeaveVariantName } from "./presets";

export const wovenTextureSchema = z.object({
  variant: weaveVariantSchema,
});

export type WovenTextureProps = z.infer<typeof wovenTextureSchema>;

export const WovenTexture: React.FC<WovenTextureProps> = ({ variant }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <PixiWeave variant={variant} />
    </AbsoluteFill>
  );
};

export const wovenTextureDefaultProps = (name: WeaveVariantName): WovenTextureProps => ({
  variant: weaveVariants[name],
});
