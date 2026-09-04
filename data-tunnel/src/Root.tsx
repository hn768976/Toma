import { Composition } from "remotion";

import {
  COMP_HEIGHT,
  COMP_WIDTH,
  DURATION_IN_FRAMES,
  FPS,
} from "./constants";
import {
  DataTunnel,
  dataTunnelDefaultProps,
  dataTunnelSchema,
} from "./DataTunnel";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* V1 - deep blue, matching the reference. */}
      <Composition
        id="V1-DataTunnelBlue"
        component={DataTunnel}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={COMP_WIDTH}
        height={COMP_HEIGHT}
        schema={dataTunnelSchema}
        defaultProps={dataTunnelDefaultProps}
      />
      {/* V2 - neutral monochrome, same geometry, graded for any brief. */}
      <Composition
        id="V2-DataTunnelMono"
        component={DataTunnel}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={COMP_WIDTH}
        height={COMP_HEIGHT}
        schema={dataTunnelSchema}
        defaultProps={{ variant: "mono" }}
      />
    </>
  );
};
