import React from "react";
import { Composition } from "remotion";
import { dataPanels } from "./looks/dataPanels";
import { dataTower } from "./looks/dataTower";
import { elementGrid } from "./looks/elementGrid";
import { tableAssemble } from "./looks/tableAssemble";
import { tableFlyover } from "./looks/tableFlyover";
import type { LookFactory } from "./lib/Stage";
import { Stage } from "./lib/Stage";
import { VERSIONS, type Version } from "./versions";

const FPS = 30;
const WIDTH = 3840;
const HEIGHT = 2160;

const factoryFor = (v: Version): { factory: LookFactory; needLand: boolean } => {
  switch (v.look) {
    case "flyover":
      return { factory: tableFlyover(v.params, v.frames), needLand: false };
    case "panels":
      return { factory: dataPanels(v.params, v.frames), needLand: true };
    case "grid":
      return { factory: elementGrid(v.params, v.frames), needLand: false };
    case "tower":
      return { factory: dataTower(v.params, v.frames), needLand: false };
    case "assemble":
      return { factory: tableAssemble(v.params, v.frames), needLand: false };
  }
};

// Factories are created once per row (module level) so they keep a stable
// identity across frames.
const ENTRIES = new Map(VERSIONS.map((v) => [v.id, { v, ...factoryFor(v) }]));

type Props = { id: string; loopCheck: boolean };

const VersionComp: React.FC<Props> = ({ id }) => {
  const e = ENTRIES.get(id)!;
  return <Stage factory={e.factory} needLand={e.needLand} background={e.v.background} grainPeriod={e.v.frames} />;
};

export const RemotionRoot: React.FC = () => (
  <>
    {[...ENTRIES.values()].map(({ v }) => (
      <Composition
        key={v.id}
        id={v.id}
        component={VersionComp}
        durationInFrames={v.frames}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ id: v.id, loopCheck: false }}
        // loopCheck: one extra frame, so frame N can be compared with frame 0.
        calculateMetadata={({ props }) => ({ durationInFrames: v.frames + (props.loopCheck ? 1 : 0) })}
      />
    ))}
  </>
);
