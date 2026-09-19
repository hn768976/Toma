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
  ContainerYard,
  containerYardDefaults,
  containerYardSchema,
} from "./yard/ContainerYard";
import {
  FPS as YARD_FPS,
  HD_HEIGHT,
  HD_WIDTH,
  UHD_HEIGHT,
  UHD_WIDTH,
  VERSIONS,
} from "./yard/constants";

/**
 * Every container-yard shot is registered twice: once at 1920x1080 and once at
 * 3840x2160. They share one component and one scene definition -- the camera
 * works in metres and the lens in degrees, so nothing in the shot is tied to
 * pixels and the 4K composition frames identically to the HD one. Only the
 * shadow map is raised, since its resolution is the one thing that would
 * otherwise soften at the larger size.
 */
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

      {VERSIONS.map((spec) => (
        <Composition
          key={spec.name}
          id={spec.name}
          component={ContainerYard}
          durationInFrames={spec.durationInFrames}
          fps={YARD_FPS}
          width={HD_WIDTH}
          height={HD_HEIGHT}
          schema={containerYardSchema}
          defaultProps={{
            ...containerYardDefaults,
            version: spec.id,
          }}
        />
      ))}

      {VERSIONS.map((spec) => (
        <Composition
          key={`${spec.name}4K`}
          id={`${spec.name}4K`}
          component={ContainerYard}
          durationInFrames={spec.durationInFrames}
          fps={YARD_FPS}
          width={UHD_WIDTH}
          height={UHD_HEIGHT}
          schema={containerYardSchema}
          defaultProps={{
            ...containerYardDefaults,
            version: spec.id,
            shadowMapSize: 4096,
          }}
        />
      ))}
    </>
  );
};
