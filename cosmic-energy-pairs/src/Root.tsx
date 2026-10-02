import React from "react";
import { Composition } from "remotion";
import { CELL, GALAXY, MAP, NEBULA, ORB } from "./colourways";
import { CellDivision, CELL_FRAMES } from "./compositions/CellDivision";
import { EnergyOrb, ORB_FRAMES } from "./compositions/EnergyOrb";
import { GalaxySpiral, GALAXY_FRAMES } from "./compositions/GalaxySpiral";
import { NebulaCore, NEBULA_FRAMES } from "./compositions/NebulaCore";
import { ParticleWorldMap, MAP_FRAMES } from "./compositions/ParticleWorldMap";

const FPS = 30;
const W = 3840;
const H = 2160;

/** `loopCheck: true` adds one frame to a loop so frame N can be compared to frame 0. */
type LoopProps = { loopCheck?: boolean };

const loopMeta =
  (frames: number) =>
  ({ props }: { props: LoopProps }) => ({ durationInFrames: frames + (props.loopCheck ? 1 : 0) });

export const RemotionRoot: React.FC = () => (
  <>
    {GALAXY.map((c) => (
      <Composition key={c.name} id={`GalaxySpiral-${c.name}`} component={GalaxySpiral} durationInFrames={GALAXY_FRAMES}
        calculateMetadata={loopMeta(GALAXY_FRAMES)} fps={FPS} width={W} height={H} defaultProps={{ colours: c, loopCheck: false }} />
    ))}
    {ORB.map((c) => (
      <Composition key={c.name} id={`EnergyOrb-${c.name}`} component={EnergyOrb} durationInFrames={ORB_FRAMES}
        calculateMetadata={loopMeta(ORB_FRAMES)} fps={FPS} width={W} height={H} defaultProps={{ colours: c, loopCheck: false }} />
    ))}
    {MAP.map((c) => (
      <Composition key={c.name} id={`ParticleWorldMap-${c.name}`} component={ParticleWorldMap} durationInFrames={MAP_FRAMES}
        fps={FPS} width={W} height={H} defaultProps={{ colours: c }} />
    ))}
    {CELL.map((c) => (
      <Composition key={c.name} id={`CellDivision-${c.name}`} component={CellDivision} durationInFrames={CELL_FRAMES}
        fps={FPS} width={W} height={H} defaultProps={{ colours: c }} />
    ))}
    {NEBULA.map((c) => (
      <Composition key={c.name} id={`NebulaCore-${c.name}`} component={NebulaCore} durationInFrames={NEBULA_FRAMES}
        calculateMetadata={loopMeta(NEBULA_FRAMES)} fps={FPS} width={W} height={H} defaultProps={{ colours: c, loopCheck: false }} />
    ))}
  </>
);
