import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Scaled } from "../shared/Scaled";
import { alpha, DESIGN_HEIGHT, DESIGN_WIDTH, PIPE } from "../shared/theme";
import { PipelineRow } from "./PipelineRow";
import { StageLoad } from "./StageLoad";
import { ThroughputPanel } from "./ThroughputPanel";
import { TimelineBar } from "./TimelineBar";
import { TitleBlock } from "./TitleBlock";

const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const breathe = 0.85 + 0.15 * Math.sin((frame / 30) * Math.PI * 0.26);
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(78% 90% at 50% 42%, ${alpha(PIPE.bgGlow, breathe)} 0%, ${PIPE.bg} 68%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(90deg, ${alpha("#6f8fc0", 0.05)} 1px, transparent 1px)`,
          backgroundSize: "96px 100%",
          opacity: 0.6,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(110% 110% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </>
  );
};

export const ProcessingPipeline: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: PIPE.bg }}>
      <Scaled background={PIPE.bg}>
        <div
          style={{
            position: "absolute",
            width: DESIGN_WIDTH,
            height: DESIGN_HEIGHT,
            opacity: fadeIn,
          }}
        >
          <Backdrop />
          <TitleBlock />
          <ThroughputPanel />
          <PipelineRow />
          <StageLoad />
          <TimelineBar />
        </div>
      </Scaled>
    </AbsoluteFill>
  );
};
