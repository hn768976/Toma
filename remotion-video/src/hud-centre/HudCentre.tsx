import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import { FRAME_H, FRAME_W } from "./layout";
import { PALETTE } from "./palette";
import { loopFrame } from "./timing";
import { VARIANTS, type CentreType } from "./variants";
import { Dashboard } from "./components/Dashboard";
import { CentreStage } from "./components/CentreStage";
import { IdLabel } from "./components/IdLabel";
import { Overlay } from "./components/Overlay";
import "./fonts";

export const hudCentreSchema = z.object({
  variant: z.enum(["wifi", "crypto", "radar"]),
});

export type HudCentreProps = z.infer<typeof hudCentreSchema>;

/**
 * 4K HUD dashboard, 450 frames @ 30fps, seamless.
 *
 * Composition order, bottom to top:
 *   <Dashboard>    the entire surrounding instrument panel — takes no variant
 *   <CentreStage>  the segment ring and the centre element — takes the accent
 *   <IdLabel>      the one string that changes
 *   <Overlay>      scanlines, vignette, grain
 *
 * Everything downstream receives an already-wrapped frame, so frame 450 is
 * frame 0 by construction rather than by luck.
 */
export const HudCentre: React.FC<HudCentreProps> = ({ variant }) => {
  const frame = loopFrame(useCurrentFrame());
  const v = VARIANTS[variant as CentreType];

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.bgDeep, width: FRAME_W, height: FRAME_H }}>
      <Dashboard frame={frame} />
      <CentreStage type={v.centre} accent={v.accent} frame={frame} />
      <IdLabel id={v.id} />
      <Overlay frame={frame} />
    </AbsoluteFill>
  );
};
