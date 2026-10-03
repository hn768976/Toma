import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { FPS, HEIGHT, LOOP_FRAMES, WIDTH } from "./lib/constants";
import { DarkTerraces } from "./looks/DarkTerraces";
import { GoldMarket } from "./looks/GoldMarket";
import { GoldRingFrame } from "./looks/GoldRingFrame";
import { PrismLeaks } from "./looks/PrismLeaks";
import { WireframeGears } from "./looks/WireframeGears";
import { VERSIONS, VersionRow } from "./versions";

type Props = { row: VersionRow; loopCheck: boolean };

const Look: React.FC<Props> = ({ row }) => {
  switch (row.look) {
    case "goldMarket":
      return <GoldMarket row={row} />;
    case "prism":
      return <PrismLeaks row={row} />;
    case "gears":
      return <WireframeGears row={row} />;
    case "ring":
      return <GoldRingFrame row={row} />;
    case "terraces":
      return <DarkTerraces row={row} />;
  }
};

// `--props='{"loopCheck":true}'` makes any composition 601 frames long so
// frame 600 can be rendered and compared with frame 0.
const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => ({
  durationInFrames: props.loopCheck ? LOOP_FRAMES + 1 : LOOP_FRAMES,
});

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((row) => (
      <Composition
        key={row.id}
        id={row.id}
        component={Look}
        durationInFrames={LOOP_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ row, loopCheck: false }}
        calculateMetadata={calculateMetadata}
      />
    ))}
  </>
);
