import React from "react";
import { Composition } from "remotion";
import { LoopCanvas, type LookFactory } from "./engine/LoopCanvas";
import { FPS, HEIGHT, LOOP, WIDTH } from "./engine/loop";
import { FontGate } from "./engine/FontGate";
import { BADGE_FONT, createAIBrainChip } from "./looks/aiBrainChip";
import { createCircuitHorizon } from "./looks/circuitHorizon";
import { createIsoCloudChip } from "./looks/isoCloudChip";
import { createNeonPodium } from "./looks/neonPodium";
import { createTriangleRelief } from "./looks/triangleRelief";
import { VERSIONS, type LookId } from "./versions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FACTORIES: Partial<Record<LookId, LookFactory<any>>> = {
  triangleRelief: createTriangleRelief,
  neonPodium: createNeonPodium,
  circuitHorizon: createCircuitHorizon,
  aiBrainChip: createAIBrainChip,
  isoCloudChip: createIsoCloudChip,
};

type Props = { look: LookId; params: Record<string, string | number>; loopCheck?: boolean };

const Version: React.FC<Props> = ({ look, params }) => {
  const factory = FACTORIES[look];
  if (!factory) return null;
  const canvas = <LoopCanvas factory={factory} params={params} />;
  // The badge's "AI" is drawn with Inter Bold: wait for the font before building the scene.
  return look === "aiBrainChip" ? (
    <FontGate family={BADGE_FONT} file="fonts/Inter-Bold.woff2">
      {canvas}
    </FontGate>
  ) : (
    canvas
  );
};

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={Version}
        durationInFrames={LOOP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ look: v.look, params: v.params, loopCheck: false } as Props}
        // --props='{"loopCheck":true}' makes it 601 frames, so frame 600 can be
        // compared against frame 0 (the seamless-loop check).
        calculateMetadata={({ props }) => ({ durationInFrames: props.loopCheck ? LOOP + 1 : LOOP })}
      />
    ))}
  </>
);
