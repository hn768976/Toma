import React from "react";
import { Composition } from "remotion";
import "./lib/fonts";
import { AttackGlitch } from "./attack/AttackGlitch";
import { DataRain } from "./rain/DataRain";
import { calculateWordMetadata, COMP_HEIGHT, COMP_WIDTH, WordProps } from "./lib/layout";
import { compositionId, StyleName, WORDS } from "./words";

const COMPONENTS: Record<StyleName, React.FC<WordProps>> = {
  AttackGlitch,
  DataRain,
};

// One composition per data row. 3840x2160, 30fps, 300 frames, not a loop.
export const RemotionRoot: React.FC = () => (
  <>
    {WORDS.map((row) => (
      <Composition
        key={compositionId(row)}
        id={compositionId(row)}
        component={COMPONENTS[row.style]}
        durationInFrames={300}
        fps={30}
        width={COMP_WIDTH}
        height={COMP_HEIGHT}
        defaultProps={{ word: row.word, seed: row.seed, layout: null } as WordProps}
        calculateMetadata={calculateWordMetadata(row.style)}
      />
    ))}
  </>
);
