import React from "react";
import { Composition } from "remotion";
import { LiquidRipples } from "./looks/LiquidRipples";
import { PastelSilk } from "./looks/PastelSilk";
import { CodePanels } from "./looks/CodePanels";
import { TealHUD } from "./looks/TealHUD";
import { DataFountain } from "./looks/DataFountain";
import { VERSIONS, compositionId, type Version } from "./versions";

const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;

/** `--props='{"loopCheck":true}'` makes a loop 601 frames long so frames 0 and 600 can be compared. */
type RootProps = { loopCheck: boolean };

const Look: React.FC<{ v: Version }> = ({ v }) => {
  switch (v.look) {
    case "liquidRipples":
      return <LiquidRipples {...v.params} />;
    case "pastelSilk":
      return <PastelSilk {...v.params} />;
    case "codePanels":
      return <CodePanels {...v.params} />;
    case "tealHud":
      return <TealHUD {...v.params} />;
    case "dataFountain":
      return <DataFountain {...v.params} />;
  }
};

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={compositionId(v)}
        component={(_: RootProps) => <Look v={v} />}
        width={WIDTH}
        height={HEIGHT}
        fps={FPS}
        durationInFrames={v.frames}
        defaultProps={{ loopCheck: false }}
        calculateMetadata={({ props }) => ({
          durationInFrames: v.loop && props.loopCheck ? v.frames + 1 : v.frames,
        })}
      />
    ))}
  </>
);
