import React from "react";
import { Composition } from "remotion";
import "./load-fonts";
import { WordCloud } from "./WordCloud";
import { DARK, LIGHT } from "./themes";

/**
 * Both versions are defined at 3840x2160 so they can be rendered at 4K
 * elsewhere; render with --scale=0.5 for a 1920x1080 preview.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-WordCloudDark"
        component={WordCloud}
        durationInFrames={300}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ theme: DARK }}
      />
      <Composition
        id="V2-WordCloudLight"
        component={WordCloud}
        durationInFrames={300}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ theme: LIGHT }}
      />
    </>
  );
};
