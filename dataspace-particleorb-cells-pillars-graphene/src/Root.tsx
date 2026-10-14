import { Composition, getInputProps } from "remotion";
import { VERSIONS, Version } from "./versions";
import { DataGridSpace } from "./looks/DataGridSpace";
import { ParticleOrb } from "./looks/ParticleOrb";
import { CellCluster } from "./looks/CellCluster";
import { PillarField } from "./looks/PillarField";
import { GrapheneLattice } from "./looks/GrapheneLattice";

const LookSwitch: React.FC<{ version: Version }> = ({ version }) => {
  switch (version.look) {
    case "datagrid": return <DataGridSpace palette={version.palette} />;
    case "orb": return <ParticleOrb palette={version.palette} />;
    case "cells": return <CellCluster palette={version.palette} />;
    case "pillars": return <PillarField palette={version.palette} />;
    case "graphene": return <GrapheneLattice palette={version.palette} />;
  }
};

// `--props='{"loopCheck":true}'` makes every composition 601 frames so frame
// 600 can be rendered and compared with frame 0.
const loopCheck = Boolean((getInputProps() as { loopCheck?: boolean }).loopCheck);

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={LookSwitch}
        defaultProps={{ version: v }}
        durationInFrames={loopCheck ? 601 : 600}
        fps={30}
        width={3840}
        height={2160}
      />
    ))}
  </>
);
