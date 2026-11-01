import { Composition } from "remotion";
import { FireRing, fireRingSchema } from "./FireRing";

// 4K compositions, 30 fps. 277 frames = the reference's exact frame count
// (reference: 277 frames @ 29.97 fps, 9.243 s -> 9.233 s @ 30 fps).
const common = {
  component: FireRing,
  fps: 30,
  durationInFrames: 277,
  width: 3840,
  height: 2160,
  schema: fireRingSchema,
} as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="FireRing-V1-Reference"
        {...common}
        defaultProps={{ palette: "inferno" as const }}
      />
      <Composition
        id="FireRing-V2-Plasma"
        {...common}
        defaultProps={{ palette: "plasma" as const }}
      />
    </>
  );
};
