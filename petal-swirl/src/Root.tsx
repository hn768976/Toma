import { Composition } from "remotion";
import { PetalSwirl, petalSwirlSchema } from "./PetalSwirl";

// 4K compositions, 30 fps. 270 frames = the reference's exact frame count
// (reference: 270 frames @ 29.97 fps, 9.009 s -> 9.000 s @ 30 fps).
const common = {
  component: PetalSwirl,
  fps: 30,
  durationInFrames: 270,
  width: 3840,
  height: 2160,
  schema: petalSwirlSchema,
} as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PetalSwirl-V1-Reference"
        {...common}
        defaultProps={{ palette: "pearl" as const }}
      />
      <Composition
        id="PetalSwirl-V2-Blush"
        {...common}
        defaultProps={{ palette: "blush" as const }}
      />
    </>
  );
};
