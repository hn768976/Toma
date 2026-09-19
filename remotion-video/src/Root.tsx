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
  GlitchAlert,
  glitchAlertSchema,
  glitchAlertDefaults,
} from "./glitch-alert/GlitchAlert";
import {
  BASE_WIDTH as ALERT_WIDTH,
  BASE_HEIGHT as ALERT_HEIGHT,
  DURATION_IN_FRAMES as ALERT_DURATION_IN_FRAMES,
  FPS as ALERT_FPS,
} from "./glitch-alert/constants";

// The cyber-alert piece ships in two headlines x two resolutions. All
// four share one component: geometry is authored at 1920x1080 and scaled
// by width/1920, so the 4K compositions are the same picture at 2x, not a
// separately tuned variant.
const ALERT_VARIANTS = [
  { id: "PhishingAttack", headline: "PHISHING ATTACK" },
  { id: "SystemHacked", headline: "SYSTEM HACKED" },
];

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
      {ALERT_VARIANTS.flatMap(({ id, headline }) => [
        <Composition
          key={`${id}-1080p`}
          id={`${id}1080p`}
          component={GlitchAlert}
          durationInFrames={ALERT_DURATION_IN_FRAMES}
          fps={ALERT_FPS}
          width={ALERT_WIDTH}
          height={ALERT_HEIGHT}
          schema={glitchAlertSchema}
          defaultProps={{ ...glitchAlertDefaults, headline }}
        />,
        <Composition
          key={`${id}-4K`}
          id={`${id}4K`}
          component={GlitchAlert}
          durationInFrames={ALERT_DURATION_IN_FRAMES}
          fps={ALERT_FPS}
          width={ALERT_WIDTH * 2}
          height={ALERT_HEIGHT * 2}
          schema={glitchAlertSchema}
          defaultProps={{ ...glitchAlertDefaults, headline }}
        />,
      ])}
    </>
  );
};
