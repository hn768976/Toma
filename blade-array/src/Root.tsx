import { Composition } from "remotion";
import { BladeArray } from "./BladeArray";
import { ALL_COMPOSITIONS } from "./compositions";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {ALL_COMPOSITIONS.map((cfg) => (
        <Composition
          key={cfg.id}
          id={cfg.id}
          component={BladeArray}
          durationInFrames={DURATION_IN_FRAMES}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ cfg }}
        />
      ))}
    </>
  );
};
