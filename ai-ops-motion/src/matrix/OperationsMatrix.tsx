import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Scaled } from "../shared/Scaled";
import { alpha, DESIGN_HEIGHT, DESIGN_WIDTH, MATRIX } from "../shared/theme";
import { ActiveOperations } from "./ActiveOperations";
import { EventStream } from "./EventStream";
import { ExecutionGraph } from "./ExecutionGraph";
import { HeaderBar } from "./HeaderBar";
import { ModelTelemetry } from "./ModelTelemetry";
import { PerformanceEnvelope } from "./PerformanceEnvelope";
import { RegionalLoadMap } from "./RegionalLoadMap";
import { SystemVitals } from "./SystemVitals";

const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  // Slow breathing on the central glow keeps the dark field from reading flat.
  const breathe = 0.82 + 0.18 * Math.sin((frame / 30) * Math.PI * 0.22);

  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(68% 82% at 50% 46%, ${alpha(MATRIX.bgGlowInner, 0.95 * breathe)} 0%, rgba(4,9,18,0.9) 52%, ${MATRIX.bg} 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(${MATRIX.grid} 1px, transparent 1px), linear-gradient(90deg, ${MATRIX.grid} 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          opacity: 0.5,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(105% 105% at 50% 50%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.72) 100%)",
        }}
      />
    </>
  );
};

export const OperationsMatrix: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: MATRIX.bg }}>
      <Scaled background={MATRIX.bg}>
        <div
          style={{
            position: "absolute",
            width: DESIGN_WIDTH,
            height: DESIGN_HEIGHT,
            opacity: fadeIn,
          }}
        >
          <Backdrop />
          <HeaderBar />
          <ActiveOperations />
          <ExecutionGraph />
          <RegionalLoadMap />
          <SystemVitals />
          <ModelTelemetry />
          <EventStream />
          <PerformanceEnvelope />
        </div>
      </Scaled>
    </AbsoluteFill>
  );
};
