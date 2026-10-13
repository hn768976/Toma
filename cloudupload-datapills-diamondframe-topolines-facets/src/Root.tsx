import React, { useMemo } from "react";
import { Composition } from "remotion";
import { FPS, HEIGHT, LOOP, WIDTH } from "./common/constants";
import { Stage } from "./common/Stage";
import type { WorldFactory } from "./common/world";
import { makeCloud } from "./looks/cloud";
import { makeDataPills } from "./looks/datapills";
import { makeDiamonds } from "./looks/diamonds";
import { makeFacets } from "./looks/facets";
import { makeTopo } from "./looks/topo";
import { VERSIONS, type Version } from "./versions";

const factoryFor = (v: Version): WorldFactory => {
  switch (v.look) {
    case "topo":
      return makeTopo(v.params);
    case "cloud":
      return makeCloud(v.params);
    case "datapills":
      return makeDataPills(v.params);
    case "diamonds":
      return makeDiamonds(v.params);
    case "facets":
      return makeFacets(v.params);
  }
};

type Props = { versionId: string; loopCheck: boolean };

const Look: React.FC<Props> = ({ versionId }) => {
  const v = VERSIONS.find((x) => x.id === versionId)!;
  const factory = useMemo(() => factoryFor(v), [v]);
  return <Stage factory={factory} background={v.background} />;
};

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={Look}
        width={WIDTH}
        height={HEIGHT}
        fps={FPS}
        durationInFrames={LOOP}
        defaultProps={{ versionId: v.id, loopCheck: false }}
        // loopCheck: true makes it 601 frames so frame 600 can be compared
        // with frame 0 (they must be identical).
        calculateMetadata={({ props }) => ({
          durationInFrames: props.loopCheck ? LOOP + 1 : LOOP,
        })}
      />
    ))}
  </>
);
