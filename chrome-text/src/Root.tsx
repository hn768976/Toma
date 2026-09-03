import { Composition } from "remotion";
import { ChromeText } from "./ChromeText";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";

/**
 * 4K colourways of the same piece. They share every component, every gradient
 * band position and every timing — only the word, its cap height and the
 * palette differ, and all three of those live in VARIANTS.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ChromeWelcome"
        component={ChromeText}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "welcome" as const }}
      />
    </>
  );
};
