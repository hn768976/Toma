import "./index.css";
import { Composition } from "remotion";
import { WarpTunnel, warpTunnelSchema, WarpTunnelProps } from "./WarpTunnel";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";

const palette = {
  deep: [0.08, 0.05, 0.55],
  violet: [0.34, 0.16, 1.0],
  lavender: [0.74, 0.64, 1.0],
  cyan: [0.3, 0.85, 1.0],
  blue: [0.14, 0.34, 0.95],
  pink: [0.95, 0.35, 0.9],
} satisfies Partial<WarpTunnelProps>;

// Version 1 — matches the reference: straight-ahead flight, near-static
// vanishing point.
const v1Props: WarpTunnelProps = {
  camera: "reference",
  ...palette,
  renderScale: 1,
};

// Version 2 — alternative camera movement: banking figure-eight orbit with
// roll and a speed surge. Same palette and tunnel.
const v2Props: WarpTunnelProps = {
  camera: "banking-orbit",
  ...palette,
  renderScale: 1,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="WarpTunnel-V1-Reference"
        component={WarpTunnel}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={warpTunnelSchema}
        defaultProps={v1Props}
      />
      <Composition
        id="WarpTunnel-V2-BankingOrbit"
        component={WarpTunnel}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={warpTunnelSchema}
        defaultProps={v2Props}
      />
    </>
  );
};
