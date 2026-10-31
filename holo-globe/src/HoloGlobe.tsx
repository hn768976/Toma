import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { ThreeStage } from "./three/ThreeStage";
import { GLOBE_V1, GLOBE_V2 } from "./globe/config";
import { createGlobeScene } from "./globe/GlobeScene";

export type HoloGlobeProps = { version: "v1" | "v2" };

/**
 * Holographic "binary earth": a planet built from tens of thousands of
 * flickering 0/1 glyphs, wrapped in particle orbit rings, a network mesh
 * and floating binary read-outs. v1 follows the reference camera; v2 uses
 * an alternative crane/orbit camera move.
 */
export const HoloGlobe: React.FC<HoloGlobeProps> = ({ version }) => {
  const create = useMemo(
    () => createGlobeScene(version === "v1" ? GLOBE_V1 : GLOBE_V2),
    [version],
  );
  return (
    <ThreeStage
      create={create}
      overlay={
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(ellipse 75% 75% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,2,6,0.55) 100%)",
          }}
        />
      }
    />
  );
};
