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
  BASE_WIDTH,
  BASE_HEIGHT,
  DURATION_IN_FRAMES as RING_DURATION_IN_FRAMES,
  FPS as RING_FPS,
} from "./particle-ring/constants";
import {
  CyberAlert,
  cyberAlertSchema,
  cyberAlertDefaults,
} from "./cyber-alert/CyberAlert";
import {
  BASE_WIDTH as ALERT_WIDTH,
  BASE_HEIGHT as ALERT_HEIGHT,
  DURATION_IN_FRAMES as ALERT_DURATION_IN_FRAMES,
  FPS as ALERT_FPS,
} from "./cyber-alert/constants";

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
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        schema={particleRingHaloSchema}
        defaultProps={particleRingHaloDefaults}
      />
      <Composition
        id="ParticleRingHalo4K"
        component={ParticleRingHalo}
        durationInFrames={RING_DURATION_IN_FRAMES}
        fps={RING_FPS}
        width={BASE_WIDTH * 2}
        height={BASE_HEIGHT * 2}
        schema={particleRingHaloSchema}
        defaultProps={{ ...particleRingHaloDefaults, resolutionScale: 2 }}
      />

      {/*
        Cyber-alert LED wall. The 1080p and 4K entries share one component
        and one set of dot-unit constants, so the 4K master is the same
        picture sampled finer rather than a separately tuned video.
      */}
      <Composition
        id="CyberAttack-1080p"
        component={CyberAlert}
        durationInFrames={ALERT_DURATION_IN_FRAMES}
        fps={ALERT_FPS}
        width={ALERT_WIDTH}
        height={ALERT_HEIGHT}
        schema={cyberAlertSchema}
        defaultProps={{ ...cyberAlertDefaults, variant: "cyberAttack" as const }}
      />
      <Composition
        id="CyberAttack-4K"
        component={CyberAlert}
        durationInFrames={ALERT_DURATION_IN_FRAMES}
        fps={ALERT_FPS}
        width={ALERT_WIDTH * 2}
        height={ALERT_HEIGHT * 2}
        schema={cyberAlertSchema}
        defaultProps={{ ...cyberAlertDefaults, variant: "cyberAttack" as const }}
      />
      <Composition
        id="SecurityBreach-1080p"
        component={CyberAlert}
        durationInFrames={ALERT_DURATION_IN_FRAMES}
        fps={ALERT_FPS}
        width={ALERT_WIDTH}
        height={ALERT_HEIGHT}
        schema={cyberAlertSchema}
        defaultProps={{
          ...cyberAlertDefaults,
          variant: "securityBreach" as const,
        }}
      />
      <Composition
        id="SecurityBreach-4K"
        component={CyberAlert}
        durationInFrames={ALERT_DURATION_IN_FRAMES}
        fps={ALERT_FPS}
        width={ALERT_WIDTH * 2}
        height={ALERT_HEIGHT * 2}
        schema={cyberAlertSchema}
        defaultProps={{
          ...cyberAlertDefaults,
          variant: "securityBreach" as const,
        }}
      />
    </>
  );
};
