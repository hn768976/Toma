import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { BASE_HEIGHT, BASE_WIDTH } from "./constants";
import { ThreeStage } from "./ThreeStage";
import { PixiLayer } from "./PixiLayer";
import { createCodeCityStage } from "./v1-code-city";
import { createV1Optics } from "./v1-optics";

// V1 — "Code city". A fly-through of translucent code panels, wireframe
// lattice, chromatic glass slabs and drifting "AI" chips.

export const codeCitySchema = z.object({
  /** 1 renders 1920x1080, 2 renders 3840x2160. Everything that is sized
   * in pixels — textures, blur radii, grain — scales with it, so the two
   * outputs are the same picture at two resolutions. */
  resolutionScale: z.union([z.literal(1), z.literal(2)]),
});

export type CodeCityProps = z.infer<typeof codeCitySchema>;

export const codeCityDefaults: CodeCityProps = { resolutionScale: 1 };

export const CodeCity: React.FC<CodeCityProps> = ({ resolutionScale }) => {
  const width = BASE_WIDTH * resolutionScale;
  const height = BASE_HEIGHT * resolutionScale;

  const createStage = useCallback(createCodeCityStage, []);
  const createScene = useCallback(createV1Optics, []);

  return (
    <AbsoluteFill style={{ backgroundColor: "#03070d" }}>
      {/* Base grade: the deep navy-teal the references sit in. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 90% at 50% 45%, #0d2438 0%, #071729 42%, #03080f 100%)",
        }}
      />
      <ThreeStage
        label="v1-code-city"
        width={width}
        height={height}
        scale={resolutionScale}
        createStage={createStage}
      />
      <PixiLayer
        label="v1-optics"
        width={width}
        height={height}
        scale={resolutionScale}
        createScene={createScene}
        style={{ mixBlendMode: "screen" }}
      />
      {/* Vignette and a cool highlight roll-off, kept in CSS so it
          composites with normal alpha over everything additive. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(118% 88% at 50% 48%, rgba(0,0,0,0) 38%, rgba(2,6,12,0.55) 78%, rgba(1,3,7,0.86) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
