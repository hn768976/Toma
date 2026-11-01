import { Composition, Folder } from "remotion";
import { StripedTunnel, stripedTunnelSchema } from "./tunnel/StripedTunnel";

// 4K UHD compositions. Final 1080p deliverables are rendered with --scale=0.5
// (see README), which downsamples the full 4K frame.
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
// Reference clip: 270 frames (9.009 s @ 29.97 fps) -> 270 frames @ 30 fps.
const DURATION = 270;
const LOOP = 45; // the reference pattern repeats every 45 frames (1.5 s)

export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="Striped-Twist-Tunnel">
      <Composition
        id="StripedTunnel-V1-4K"
        component={StripedTunnel}
        schema={stripedTunnelSchema}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "monochrome" as const, loopFrames: LOOP }}
      />
      <Composition
        id="StripedTunnel-V2-4K"
        component={StripedTunnel}
        schema={stripedTunnelSchema}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "saffron-indigo" as const, loopFrames: LOOP }}
      />
    </Folder>
  );
};
