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
  WovenTexture,
  wovenTextureSchema,
  wovenTextureDefaultProps,
} from "./weave/WovenTexture";
import {
  FPS as WEAVE_FPS,
  DURATION_IN_FRAMES as WEAVE_DURATION_IN_FRAMES,
  HD_WIDTH,
  HD_HEIGHT,
  UHD_WIDTH,
  UHD_HEIGHT,
} from "./weave/constants";

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
      {/*
        Woven-texture films. Each reference clip gets one variant, registered at
        both the 1080p delivery size and the 4K archival size. The shader is
        resolution-independent, so the two differ only in the pixel grid the
        same cloth is sampled on -- no reframing, no retuning.
      */}
      <Composition
        id="WovenTexture-01-CanvasWhite-1080p"
        component={WovenTexture}
        durationInFrames={WEAVE_DURATION_IN_FRAMES}
        fps={WEAVE_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
        schema={wovenTextureSchema}
        defaultProps={wovenTextureDefaultProps("01-canvas-white")}
      />
      <Composition
        id="WovenTexture-01-CanvasWhite-4K"
        component={WovenTexture}
        durationInFrames={WEAVE_DURATION_IN_FRAMES}
        fps={WEAVE_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        schema={wovenTextureSchema}
        defaultProps={wovenTextureDefaultProps("01-canvas-white")}
      />
      <Composition
        id="WovenTexture-02-WeaveGrey-1080p"
        component={WovenTexture}
        durationInFrames={WEAVE_DURATION_IN_FRAMES}
        fps={WEAVE_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
        schema={wovenTextureSchema}
        defaultProps={wovenTextureDefaultProps("02-weave-grey")}
      />
      <Composition
        id="WovenTexture-02-WeaveGrey-4K"
        component={WovenTexture}
        durationInFrames={WEAVE_DURATION_IN_FRAMES}
        fps={WEAVE_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        schema={wovenTextureSchema}
        defaultProps={wovenTextureDefaultProps("02-weave-grey")}
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
    </>
  );
};
