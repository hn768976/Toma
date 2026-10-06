import React from "react";
import { Composition } from "remotion";
import { Stage, LookFactory } from "./lib/Stage";
import { makeTopoLook } from "./looks/topo/TopoLook";
import { makeHeadlineLook } from "./looks/headline/HeadlineLook";
import { makeTickerLook } from "./looks/ticker/TickerLook";
import { makeRibbonLook } from "./looks/ribbon/RibbonLook";
import { HEADLINE_VERSIONS, RIBBON_VERSIONS, TICKER_VERSIONS, TOPO_VERSIONS } from "./versions";

const W = 3840, H = 2160, FPS = 30;

type Entry = { id: string; frames: number; factory: LookFactory };

const ENTRIES: Entry[] = [
  ...TOPO_VERSIONS.map((v) => ({ id: v.id, frames: 600, factory: makeTopoLook(v) })),
  ...HEADLINE_VERSIONS.map((v) => ({ id: v.id, frames: 450, factory: makeHeadlineLook(v) })),
  ...TICKER_VERSIONS.map((v) => ({ id: v.id, frames: 600, factory: makeTickerLook(v) })),
  ...RIBBON_VERSIONS.map((v) => ({ id: v.id, frames: 600, factory: makeRibbonLook(v) })),
];

// Stable component per composition (factory identity never changes).
const components = new Map<string, React.FC<{ loopCheck: boolean }>>(
  ENTRIES.map((e) => [e.id, () => <Stage factory={e.factory} />]),
);

export const RemotionRoot: React.FC = () => (
  <>
    {ENTRIES.map((e) => (
      <Composition
        key={e.id}
        id={e.id}
        component={components.get(e.id)!}
        durationInFrames={e.frames}
        defaultProps={{ loopCheck: false }}
        // loopCheck: true renders one extra frame (frame 600 must equal frame 0)
        calculateMetadata={({ props }) => ({ durationInFrames: props.loopCheck ? e.frames + 1 : e.frames })}
        fps={FPS}
        width={W}
        height={H}
      />
    ))}
  </>
);
