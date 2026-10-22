import { Composition } from "remotion";
import { NebulaClouds } from "./nebula/NebulaClouds";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./nebula/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1: colours matched to the reference footage. */}
      <Composition
        id="NebulaClouds4K"
        component={NebulaClouds}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "reference" as const }}
      />
      {/* Version 2: same motion, alternate teal/gold colour palette. */}
      <Composition
        id="NebulaCloudsAurora4K"
        component={NebulaClouds}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "aurora" as const }}
      />
    </>
  );
};
