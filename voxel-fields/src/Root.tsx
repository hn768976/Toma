import React from "react";
import { Composition } from "remotion";
import { FPS, LOOP_FRAMES } from "./lib/fields";
import { PALETTES } from "./lib/palettes";
import { VoxelField } from "./VoxelField";

// One composition per palette row. Set VOXEL_FRAMES=601 (env) to render the
// loop check frame 600; normal renders are exactly 600 frames.
const frames = Number(process.env.REMOTION_VOXEL_FRAMES ?? LOOP_FRAMES);

export const RemotionRoot: React.FC = () => (
  <>
    {PALETTES.map((p) => (
      <Composition
        key={p.id}
        id={p.id}
        component={VoxelField}
        durationInFrames={frames}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ paletteId: p.id }}
      />
    ))}
  </>
);
