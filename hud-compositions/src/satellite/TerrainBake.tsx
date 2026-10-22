import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { ShaderCanvas } from "../common/ShaderCanvas";
import { BAKE_FRAG, CLOSE_BOUNDS, WIDE_BOUNDS } from "./terrain.frag";

export const terrainBakeSchema = z.object({ region: z.enum(["wide", "close"]) });

/**
 * Still compositions that bake the procedural terrain into the textures in
 * public/terrain/. Re-run with `npm run bake` after editing the terrain.
 */
export const TerrainBake: React.FC<z.infer<typeof terrainBakeSchema>> = ({ region }) => {
  const b = region === "wide" ? WIDE_BOUNDS : CLOSE_BOUNDS;
  return (
    <AbsoluteFill style={{ background: "black" }}>
      <ShaderCanvas fragment={BAKE_FRAG} uniforms={{ uBounds: [...b] }} />
    </AbsoluteFill>
  );
};
