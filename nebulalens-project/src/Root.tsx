import React from "react";
import { Composition } from "remotion";
import { FPS, HEIGHT, LOOP, WIDTH } from "./lib/constants";
import { BarChart } from "./looks/BarChart";
import { Champagne } from "./looks/Champagne";
import { DataMontage } from "./looks/datamontage/DataMontage";
import { FireCore } from "./looks/FireCore";
import { NebulaLens } from "./looks/NebulaLens";
import { compositionId, VERSIONS, type Version } from "./versions";

// --props='{"loopCheck":true}' adds one frame (601) so frame 600 can be
// rendered and compared with frame 0. See README "Verification".
type RootProps = { loopCheck: boolean };

const render = (v: Version): React.ReactElement | null => {
  switch (v.look) {
    case "nebula":
      return <NebulaLens {...v.palette} />;
    case "champagne":
      return <Champagne {...v.palette} />;
    case "datamontage":
      return <DataMontage {...v.palette} />;
    case "firecore":
      return <FireCore {...v.palette} />;
    case "barchart":
      return <BarChart {...v.palette} />;
  }
};

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        // Remotion ids allow [a-zA-Z0-9-] only: "NebulaLens_Pastel" → "NebulaLens-Pastel".
        id={compositionId(v)}
        component={() => render(v)}
        defaultProps={{ loopCheck: false } as RootProps}
        calculateMetadata={({ props }) => ({ durationInFrames: props.loopCheck ? LOOP + 1 : LOOP })}
        durationInFrames={LOOP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    ))}
  </>
);
