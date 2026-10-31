import { Composition } from "remotion";
import { Fireworks, fireworksSchema } from "./fireworks/Fireworks";

// Reference clip: 300 frames (10.01 s @ 29.97 fps). At exactly 30 fps the
// frame count is kept identical (300 frames = 10.000 s).
const FPS = 30;
const DURATION_IN_FRAMES = 300;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1 — matches the reference (warm orange / gold / red / pink). */}
      <Composition
        id="Fireworks-V1-4K"
        component={Fireworks}
        schema={fireworksSchema}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ palette: "classic" as const }}
      />
      {/* Version 2 — same show, alternative "arctic" colour palette. */}
      <Composition
        id="Fireworks-V2-4K"
        component={Fireworks}
        schema={fireworksSchema}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ palette: "arctic" as const }}
      />
    </>
  );
};
