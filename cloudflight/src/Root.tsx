import React from "react";
import { Composition, getInputProps } from "remotion";
import { ROWS, Row } from "./data";
import { RainbowRings } from "./rings/RainbowRings";
import { RippleRings } from "./ripple/RippleRings";
import { CloudScene } from "./clouds/CloudScene";
import { SunLeaves } from "./leaves/SunLeaves";
import { DataGrid } from "./grid/DataGrid";

const Scene: React.FC<{ row: Row }> = ({ row }) => {
  switch (row.kind) {
    case "rainbowRings":
      return <RainbowRings row={row} />;
    case "clouds":
      return <CloudScene row={row} debug={debug} debugCam={debugCam} />;
    case "sunLeaves":
      return <SunLeaves row={row} />;
    case "dataGrid":
      return <DataGrid row={row} />;
    case "rippleRings":
      return <RippleRings row={row} />;
    default:
      return null;
  }
};

// `--props='{"loopCheck":true}'` makes every loop one frame longer (601) so
// frame 600 can be compared with frame 0.
const { loopCheck, debug, debugCam } = getInputProps() as {
  loopCheck?: boolean;
  debug?: boolean | number;
  debugCam?: [number, number, number, number, number];
};

export const RemotionRoot: React.FC = () => (
  <>
    {ROWS.map((row) => (
      <Composition
        key={row.id}
        // Remotion ids allow no "_", so CloudFlight_Day -> CloudFlight-Day.
        id={row.id.replace(/_/g, "-")}
        component={Scene}
        defaultProps={{ row }}
        durationInFrames={row.durationInFrames + (loopCheck && row.loop ? 1 : 0)}
        fps={30}
        width={3840}
        height={2160}
      />
    ))}
  </>
);
