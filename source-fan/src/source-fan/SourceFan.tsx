import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { CodeBackdrop } from "./CodeBackdrop";
import { DotField } from "./DotField";
import { Finish } from "./Finish";
import { SourceNode } from "./SourceNode";
import { StrandFan } from "./StrandFan";
import { makeFlow } from "./layout";
import { VARIANTS, type VariantName } from "./variants";

export type SourceFanProps = {
  readonly variant: VariantName;
};

/**
 * A fan of fine strands sweeping out of a stack of source nodes and fading
 * into a field of data. Every layer is a canvas that redraws once per React
 * render from the frame number alone, so the render is deterministic.
 */
export const SourceFan: React.FC<SourceFanProps> = ({ variant }) => {
  const config = VARIANTS[variant];
  const flow = useMemo(() => makeFlow(config), [config]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: config.palette.backgroundDeep,
        overflow: "hidden",
        isolation: "isolate",
      }}
    >
      <CodeBackdrop config={config} flow={flow} />
      <StrandFan config={config} flow={flow} />
      <DotField config={config} flow={flow} />
      {config.sources.map((source, index) => (
        <SourceNode
          key={source.label}
          config={config}
          flow={flow}
          index={index}
        />
      ))}
      <Finish config={config} />
    </AbsoluteFill>
  );
};
