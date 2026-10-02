import React from "react";
import { Composition } from "remotion";
import { ACRONYMS, compositionId } from "./data/acronyms";
import { COMP_HEIGHT, COMP_WIDTH, DURATION_IN_FRAMES, FPS } from "./lib/world";
import { AcronymCubes } from "./scene/AcronymCubes";

// One template, one composition per data row. NOT loops: one-way reveals.
export const RemotionRoot: React.FC = () => (
  <>
    {ACRONYMS.map((row) => (
      <Composition
        key={row.id}
        id={compositionId(row)}
        component={AcronymCubes}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={COMP_WIDTH}
        height={COMP_HEIGHT}
        defaultProps={{ id: row.id }}
      />
    ))}
  </>
);

