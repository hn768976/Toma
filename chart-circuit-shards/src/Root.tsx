import React from 'react';
import { Composition } from 'remotion';
import { LookFactory, ThreeStage } from './lib/ThreeStage';
import { AssetNeeds } from './lib/assets';
import { CIRCUIT_VERSIONS, CPU_VERSIONS, GROWTH_VERSIONS, PANELS_VERSIONS, SHARDS_VERSIONS } from './versions';
import { makePanelsFactory, PANELS_FRAMES } from './looks/panels/LaserPanels';
import { CPU_FRAMES, makeCpuFactory } from './looks/cpu/CPUBoard';
import { makeShardsFactory, SHARDS_FRAMES } from './looks/shards/NeonShards';
import { CIRCUIT_FRAMES, makeCircuitFactory } from './looks/circuit/CircuitFlythrough';
import { GROWTH_FRAMES, makeGrowthFactory } from './looks/growth/GrowthChart';

const FPS = 30;
const W = 3840;
const H = 2160;

type Entry = { id: string; frames: number; factory: LookFactory; needs: AssetNeeds; loop: boolean };

const entries: Entry[] = [
  ...GROWTH_VERSIONS.map((v) => ({
    id: v.id,
    frames: GROWTH_FRAMES,
    factory: makeGrowthFactory(v),
    needs: { hdri: true, land: true },
    loop: false,
  })),
  ...CIRCUIT_VERSIONS.map((v) => ({
    id: v.id,
    frames: CIRCUIT_FRAMES,
    factory: makeCircuitFactory(v),
    needs: {},
    loop: true,
  })),
  ...SHARDS_VERSIONS.map((v) => ({
    id: v.id,
    frames: SHARDS_FRAMES,
    factory: makeShardsFactory(v),
    needs: {},
    loop: true,
  })),
  ...CPU_VERSIONS.map((v) => ({
    id: v.id,
    frames: CPU_FRAMES,
    factory: makeCpuFactory(v),
    needs: { hdri: true },
    loop: true,
  })),
  ...PANELS_VERSIONS.map((v) => ({
    id: v.id,
    frames: PANELS_FRAMES,
    factory: makePanelsFactory(v),
    needs: { hdri: true },
    loop: true,
  })),
];

export const compId = (fileId: string) => fileId.replace(/_/g, '-');

const Stage: React.FC<{ id: string }> = ({ id }) => {
  const e = entries.find((x) => x.id === id)!;
  return <ThreeStage factory={e.factory} needs={e.needs} />;
};

export const RemotionRoot: React.FC = () => (
  <>
    {entries.map((e) => (
      <Composition
        key={e.id}
        id={compId(e.id)}
        component={Stage}
        defaultProps={{ id: e.id }}
        durationInFrames={e.frames}
        fps={FPS}
        width={W}
        height={H}
        // `loopCheck` (used only by the verify scripts) adds one frame so frame
        // N can be compared with frame 0.
        calculateMetadata={({ props }) => ({
          durationInFrames: e.frames + ((props as { loopCheck?: boolean }).loopCheck ? 1 : 0),
        })}
      />
    ))}
  </>
);
