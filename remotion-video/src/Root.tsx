import "./index.css";
import "./load-fonts";
import { Composition } from "remotion";
import {
  BluetoothExplainer,
  bluetoothExplainerSchema,
  bluetoothExplainerDefaultProps,
} from "./BluetoothExplainer";
import { DURATION_IN_FRAMES, FPS, WIDTH, HEIGHT } from "./constants";
import {
  ParticleRingHalo,
  particleRingHaloSchema,
  particleRingHaloDefaults,
} from "./particle-ring/ParticleRingHalo";
import {
  DURATION_IN_FRAMES as RING_DURATION_IN_FRAMES,
  FPS as RING_FPS,
  WIDTH as RING_WIDTH,
  HEIGHT as RING_HEIGHT,
} from "./particle-ring/constants";
import {
  DataTunnel,
  dataTunnelSchema,
  dataTunnelDefaultProps,
  dataTunnelApproachDefaultProps,
} from "./data-tunnel/DataTunnel";
import {
  DURATION_IN_FRAMES as TUNNEL_DURATION_IN_FRAMES,
  FPS as TUNNEL_FPS,
  WIDTH as TUNNEL_WIDTH,
  HEIGHT as TUNNEL_HEIGHT,
} from "./data-tunnel/config";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BluetoothExplainer"
        component={BluetoothExplainer}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={bluetoothExplainerSchema}
        defaultProps={bluetoothExplainerDefaultProps}
      />
      <Composition
        id="ParticleRingHalo"
        component={ParticleRingHalo}
        durationInFrames={RING_DURATION_IN_FRAMES}
        fps={RING_FPS}
        width={RING_WIDTH}
        height={RING_HEIGHT}
        schema={particleRingHaloSchema}
        defaultProps={particleRingHaloDefaults}
      />
      <Composition
        id="DataTunnel"
        component={DataTunnel}
        durationInFrames={TUNNEL_DURATION_IN_FRAMES}
        fps={TUNNEL_FPS}
        width={TUNNEL_WIDTH}
        height={TUNNEL_HEIGHT}
        schema={dataTunnelSchema}
        defaultProps={dataTunnelDefaultProps}
      />
      <Composition
        id="DataTunnelApproach"
        component={DataTunnel}
        durationInFrames={TUNNEL_DURATION_IN_FRAMES}
        fps={TUNNEL_FPS}
        width={TUNNEL_WIDTH}
        height={TUNNEL_HEIGHT}
        schema={dataTunnelSchema}
        defaultProps={dataTunnelApproachDefaultProps}
      />
    </>
  );
};
