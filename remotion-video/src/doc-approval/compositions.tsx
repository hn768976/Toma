import React from "react";
import { Composition } from "remotion";
import { DocApproval, docApprovalSchema } from "./DocApproval";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./layout";

/**
 * Both versions of the piece, registered from one place so the studio, the
 * loop verification script and the packaged standalone project all see
 * exactly the same compositions.
 */
export const DocApprovalCompositions: React.FC = () => (
  <>
    <Composition
      id="DocApproved"
      component={DocApproval}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      schema={docApprovalSchema}
      defaultProps={{ variant: "approved" as const }}
    />
    <Composition
      id="DocRejected"
      component={DocApproval}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      schema={docApprovalSchema}
      defaultProps={{ variant: "rejected" as const }}
    />
  </>
);
