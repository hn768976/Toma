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
import { FlowRibbon, flowRibbonSchema } from "./flow-ribbon";
import {
  BASE_WIDTH as RIBBON_WIDTH,
  BASE_HEIGHT as RIBBON_HEIGHT,
  DURATION_IN_FRAMES as RIBBON_FRAMES,
  FPS as RIBBON_FPS,
} from "./flow-ribbon/constants";

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
        Flowing-ribbon piece, four compositions: two colour variants at two
        resolutions. The scene is authored in world units and framed by a
        perspective camera, so the 4K compositions are the same image as the
        1080p ones at a higher sample count - nothing is re-tuned per size.
      */}
      <Composition
        id="FlowRibbon-Reference-1080p"
        component={FlowRibbon}
        durationInFrames={RIBBON_FRAMES}
        fps={RIBBON_FPS}
        width={RIBBON_WIDTH}
        height={RIBBON_HEIGHT}
        schema={flowRibbonSchema}
        defaultProps={{ variant: "reference" as const, mirrored: false }}
      />
      <Composition
        id="FlowRibbon-Reference-4K"
        component={FlowRibbon}
        durationInFrames={RIBBON_FRAMES}
        fps={RIBBON_FPS}
        width={RIBBON_WIDTH * 2}
        height={RIBBON_HEIGHT * 2}
        schema={flowRibbonSchema}
        defaultProps={{ variant: "reference" as const, mirrored: false }}
      />
      <Composition
        id="FlowRibbon-Cyan-Mirrored-1080p"
        component={FlowRibbon}
        durationInFrames={RIBBON_FRAMES}
        fps={RIBBON_FPS}
        width={RIBBON_WIDTH}
        height={RIBBON_HEIGHT}
        schema={flowRibbonSchema}
        defaultProps={{ variant: "cyan" as const, mirrored: true }}
      />
      <Composition
        id="FlowRibbon-Cyan-Mirrored-4K"
        component={FlowRibbon}
        durationInFrames={RIBBON_FRAMES}
        fps={RIBBON_FPS}
        width={RIBBON_WIDTH * 2}
        height={RIBBON_HEIGHT * 2}
        schema={flowRibbonSchema}
        defaultProps={{ variant: "cyan" as const, mirrored: true }}
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
