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
  SystemAlert,
  systemAlertSchema,
  systemAlertDefaults,
} from "./system-alert/SystemAlert";
import {
  DURATION_IN_FRAMES as ALERT_FRAMES,
  FPS as ALERT_FPS,
  HD_WIDTH,
  HD_HEIGHT,
  UHD_WIDTH,
  UHD_HEIGHT,
} from "./system-alert/constants";

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
        Cyber-alert spot, four compositions from one component.

        The layout is written entirely in fractions of the frame, so the 4K
        compositions are the *same* design measured against a bigger canvas
        rather than an upscale — render either one and the framing, type size
        and mosaic cell size are identical, only sharper.
      */}
      <Composition
        id="SystemHacked-1080p"
        component={SystemAlert}
        durationInFrames={ALERT_FRAMES}
        fps={ALERT_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
        schema={systemAlertSchema}
        defaultProps={systemAlertDefaults}
      />
      <Composition
        id="SystemHacked-4K"
        component={SystemAlert}
        durationInFrames={ALERT_FRAMES}
        fps={ALERT_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        schema={systemAlertSchema}
        defaultProps={systemAlertDefaults}
      />
      <Composition
        id="PhishingAttack-1080p"
        component={SystemAlert}
        durationInFrames={ALERT_FRAMES}
        fps={ALERT_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
        schema={systemAlertSchema}
        defaultProps={{ ...systemAlertDefaults, headline: "PHISHING ATTACK" }}
      />
      <Composition
        id="PhishingAttack-4K"
        component={SystemAlert}
        durationInFrames={ALERT_FRAMES}
        fps={ALERT_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        schema={systemAlertSchema}
        defaultProps={{ ...systemAlertDefaults, headline: "PHISHING ATTACK" }}
      />
    </>
  );
};
