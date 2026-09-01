import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import "./fonts";
import { DataColumn, DataRules } from "./components/DataColumn";
import { DocumentIcon } from "./components/DocumentIcon";
import { Finish } from "./components/Finish";
import { FrameBrackets } from "./components/FrameBrackets";
import { RatingRow } from "./components/RatingRow";
import { WorldBackdrop } from "./components/WorldBackdrop";
import { VerdictIcon } from "./components/VerdictIcon";
import { COLUMN_COUNT, DOC_COUNT, TIMING } from "./layout";
import { randRange } from "./util";
import { VARIANTS } from "./variants";

export const docApprovalSchema = z.object({
  variant: z.enum(["approved", "rejected"]),
});

export type DocApprovalProps = z.infer<typeof docApprovalSchema>;

/**
 * The rejected variant's cross lands as a stamp, and the impact knocks the
 * whole image sideways for three frames. Seeded, so the shake is identical on
 * every render.
 */
const stampShake = (frame: number, stamps: boolean): { x: number; y: number } => {
  if (!stamps) return { x: 0, y: 0 };
  const since = frame - TIMING.stampAt;
  if (since < 0 || since >= TIMING.shakeFrames) return { x: 0, y: 0 };
  const decay = 1 - since / TIMING.shakeFrames;
  const amplitude = TIMING.shakeAmplitude * decay;
  return {
    x: randRange(`shake-x-${frame}`, -amplitude, amplitude),
    y: randRange(`shake-y-${frame}`, -amplitude, amplitude),
  };
};

export const DocApproval: React.FC<DocApprovalProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const spec = VARIANTS[variant];
  const shake = stampShake(frame, spec.verdict.entrance === "stamp");

  return (
    <AbsoluteFill style={{ backgroundColor: spec.palette.backgroundDeep }}>
      <AbsoluteFill
        style={{ transform: `translate(${shake.x}px, ${shake.y}px)` }}
      >
        <WorldBackdrop palette={spec.palette} />
        {Array.from({ length: COLUMN_COUNT }, (_, i) => (
          <DataColumn key={i} index={i} palette={spec.palette} />
        ))}
        <DataRules palette={spec.palette} />
        <FrameBrackets variant={spec} />
        {Array.from({ length: DOC_COUNT }, (_, i) => (
          <DocumentIcon key={i} index={i} variant={spec} />
        ))}
        <VerdictIcon variant={spec} />
        <RatingRow variant={spec} />
      </AbsoluteFill>
      <Finish />
    </AbsoluteFill>
  );
};
