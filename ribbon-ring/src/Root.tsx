import "./index.css";
import { Composition } from "remotion";
import {
  FinDome,
  finDomeDefaults,
  finDomeSchema,
} from "./fin-dome/FinDome";
import { orbitVariantProps } from "./fin-dome/variants";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./fin-dome/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version A: matches the reference (locked-off camera). */}
      <Composition
        id="FinDome4K"
        component={FinDome}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={finDomeSchema}
        defaultProps={finDomeDefaults}
      />
      {/* Version B: same ring and palette, moving camera. */}
      <Composition
        id="FinDomeOrbit4K"
        component={FinDome}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={finDomeSchema}
        defaultProps={orbitVariantProps}
      />
    </>
  );
};
