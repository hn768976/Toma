import { Composition } from "remotion";
import { TubeBloom } from "./tube-bloom/TubeBloom";
import { SCENES, type SceneId } from "./tube-bloom/scenes";

// All compositions are authored at 4K UHD; final 1080p deliverables are
// rendered from these with `--scale=0.5` (see README).
const W = 3840;
const H = 2160;
const FPS = 30;
// Both references are exactly 305 frames at 30 fps (10.1667 s).
const DURATION = 305;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {(Object.keys(SCENES) as SceneId[]).map((id) => (
        <Composition
          key={id}
          id={id}
          component={TubeBloom}
          durationInFrames={DURATION}
          fps={FPS}
          width={W}
          height={H}
          defaultProps={{ scene: id }}
        />
      ))}
    </>
  );
};
