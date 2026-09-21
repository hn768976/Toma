// Composition registration for the ten looks.
//
// Compositions are defined at 3840x2160 and rendered to 1080p previews with
// --scale=0.5; the same ids render at 4K with --scale=1.

import React from "react";
import { Composition } from "remotion";
import { VirusScene } from "./VirusScene";
import { LOOKS } from "./data/looks";

export const VIRUS_FPS = 30;
import { LOOP_FRAMES } from "./loop";

// Composition length. The loop-closure check sets this to 601 temporarily.
export const VIRUS_DURATION = LOOP_FRAMES;
export const VIRUS_WIDTH = 3840;
export const VIRUS_HEIGHT = 2160;

export const VirusCompositions: React.FC = () => (
  <>
    {LOOKS.map((look) => (
      <Composition
        key={look.id}
        id={`VirusField-${look.id}`}
        component={VirusScene}
        durationInFrames={VIRUS_DURATION}
        fps={VIRUS_FPS}
        width={VIRUS_WIDTH}
        height={VIRUS_HEIGHT}
        defaultProps={{ look }}
      />
    ))}
  </>
);
