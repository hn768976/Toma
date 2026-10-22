import "./index.css";
import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./nebula/constants";
import { HelixNebula, helixNebulaSchema } from "./nebula/HelixNebula";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version A: matches the reference clip. */}
      <Composition
        id="HelixNebula4K"
        component={HelixNebula}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={helixNebulaSchema}
        defaultProps={{ palette: "reference" as const }}
      />
      {/* Version B: same camera move, warm "ember" colour palette. */}
      <Composition
        id="HelixNebulaEmber4K"
        component={HelixNebula}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={helixNebulaSchema}
        defaultProps={{ palette: "ember" as const }}
      />
    </>
  );
};
