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
  DataSphereHud,
  dataSphereHudSchema,
} from "./data-sphere/DataSphereHud";
import {
  DESIGN_WIDTH as SPHERE_WIDTH,
  DESIGN_HEIGHT as SPHERE_HEIGHT,
  DURATION_IN_FRAMES as SPHERE_DURATION_IN_FRAMES,
  FPS as SPHERE_FPS,
} from "./data-sphere/constants";

// Data-sphere HUD: two palettes x two resolutions. The 4K compositions
// are the masters; the 1080p ones render the identical frame at half size.
const dataSphereVariants = [
  { id: "DataSphereHUD-Mono", palette: "mono" },
  { id: "DataSphereHUD-Ember", palette: "ember" },
] as const;

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
      {dataSphereVariants.flatMap((v) => [
        <Composition
          key={`${v.id}-4K`}
          id={`${v.id}-4K`}
          component={DataSphereHud}
          durationInFrames={SPHERE_DURATION_IN_FRAMES}
          fps={SPHERE_FPS}
          width={SPHERE_WIDTH * 2}
          height={SPHERE_HEIGHT * 2}
          schema={dataSphereHudSchema}
          defaultProps={{ palette: v.palette }}
        />,
        <Composition
          key={`${v.id}-1080p`}
          id={`${v.id}-1080p`}
          component={DataSphereHud}
          durationInFrames={SPHERE_DURATION_IN_FRAMES}
          fps={SPHERE_FPS}
          width={SPHERE_WIDTH}
          height={SPHERE_HEIGHT}
          schema={dataSphereHudSchema}
          defaultProps={{ palette: v.palette }}
        />,
      ])}
    </>
  );
};
