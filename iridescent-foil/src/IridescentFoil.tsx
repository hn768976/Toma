import React, { useMemo } from "react";
import { z } from "zod";
import { ShaderCanvas } from "./gl/ShaderCanvas";
import { FOIL_FRAG } from "./gl/foilShader";

const rgb = z.tuple([z.number(), z.number(), z.number()]);

export const foilSchema = z.object({
  base: rgb,
  highlight: rgb,
  rim: rgb,
  accent: rgb,
  glow: rgb,
  core: rgb,
});

export type FoilProps = z.infer<typeof foilSchema>;

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** Version 1 — matches the reference: magenta / cyan / green on deep violet. */
export const REFERENCE_PALETTE: FoilProps = {
  base: hex("#16041f"),
  highlight: hex("#ff2bd6"),
  rim: hex("#22e3ff"),
  accent: hex("#3dff9a"),
  glow: hex("#c21fa8"),
  core: hex("#fff2ff"),
};

/** Version 2 — alternative palette: molten gold / amber on deep sapphire. */
export const GOLD_SAPPHIRE_PALETTE: FoilProps = {
  base: hex("#020a22"),
  highlight: hex("#ffb21e"),
  rim: hex("#2f7dff"),
  accent: hex("#ffe58a"),
  glow: hex("#d9690f"),
  core: hex("#fff8e6"),
};

export const IridescentFoil: React.FC<FoilProps> = (props) => {
  const uniforms = useMemo(
    () => ({
      uBase: props.base,
      uKey: props.highlight,
      uRim: props.rim,
      uAccent: props.accent,
      uGlow: props.glow,
      uCore: props.core,
    }),
    [props.base, props.highlight, props.rim, props.accent, props.glow, props.core],
  );
  return <ShaderCanvas fragmentShader={FOIL_FRAG} uniforms={uniforms} />;
};
