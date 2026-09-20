import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { BASE_HEIGHT, BASE_WIDTH } from "./constants";
import { ThreeStage } from "./ThreeStage";
import { PixiLayer } from "./PixiLayer";
import { createCodeWallStage } from "./v2-code-wall";
import { createV2Optics } from "./v2-optics";

// V2 — "Code wall". A full-frame slab of code shot at an angle, with a
// blue glow across the top and a fan of thin rays.

export const codeWallSchema = z.object({
  resolutionScale: z.union([z.literal(1), z.literal(2)]),
});

export type CodeWallProps = z.infer<typeof codeWallSchema>;

export const codeWallDefaults: CodeWallProps = { resolutionScale: 1 };

export const CodeWall: React.FC<CodeWallProps> = ({ resolutionScale }) => {
  const width = BASE_WIDTH * resolutionScale;
  const height = BASE_HEIGHT * resolutionScale;

  const createStage = useCallback(createCodeWallStage, []);
  const createScene = useCallback(createV2Optics, []);

  return (
    <AbsoluteFill style={{ backgroundColor: "#040910" }}>
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, #123253 0%, #0a1c30 30%, #060e1a 68%, #040910 100%)",
        }}
      />
      <ThreeStage
        label="v2-code-wall"
        width={width}
        height={height}
        scale={resolutionScale}
        createStage={createStage}
      />
      <PixiLayer
        label="v2-optics"
        width={width}
        height={height}
        scale={resolutionScale}
        createScene={createScene}
        style={{ mixBlendMode: "screen" }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(125% 95% at 50% 40%, rgba(0,0,0,0) 42%, rgba(3,7,14,0.5) 80%, rgba(2,4,9,0.82) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
