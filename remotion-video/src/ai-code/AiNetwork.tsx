import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { BASE_HEIGHT, BASE_WIDTH } from "./constants";
import { ThreeStage } from "./ThreeStage";
import { PixiLayer } from "./PixiLayer";
import { createAiNetworkStage } from "./v3-ai-network";
import { createV3Optics } from "./v3-optics";

// V3 — "AI network". Dim code underneath, a drifting graph of "AI" nodes
// over it, oversized defocused lettering passing the lens.

export const aiNetworkSchema = z.object({
  resolutionScale: z.union([z.literal(1), z.literal(2)]),
});

export type AiNetworkProps = z.infer<typeof aiNetworkSchema>;

export const aiNetworkDefaults: AiNetworkProps = { resolutionScale: 1 };

export const AiNetwork: React.FC<AiNetworkProps> = ({ resolutionScale }) => {
  const width = BASE_WIDTH * resolutionScale;
  const height = BASE_HEIGHT * resolutionScale;

  const createStage = useCallback(createAiNetworkStage, []);
  const createScene = useCallback(createV3Optics, []);

  return (
    <AbsoluteFill style={{ backgroundColor: "#01050a" }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(130% 100% at 46% 42%, #071c2b 0%, #04121e 45%, #010609 100%)",
        }}
      />
      <ThreeStage
        label="v3-ai-network"
        width={width}
        height={height}
        scale={resolutionScale}
        createStage={createStage}
      />
      <PixiLayer
        label="v3-optics"
        width={width}
        height={height}
        scale={resolutionScale}
        createScene={createScene}
        style={{ mixBlendMode: "screen" }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(115% 85% at 50% 50%, rgba(0,0,0,0) 34%, rgba(1,5,10,0.6) 76%, rgba(0,2,5,0.9) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
