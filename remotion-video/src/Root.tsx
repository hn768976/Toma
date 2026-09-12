import "./index.css";
import "./load-fonts";
import "./speedtest/fonts";
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
import { SpeedTestFlat } from "./speedtest/SpeedTestFlat";
import { SpeedTestNeon } from "./speedtest/SpeedTestNeon";
import { SpeedTestFlatWithMatte } from "./speedtest/SpeedTestFlatWithMatte";
import {
  FPS as SPEEDTEST_FPS,
  DURATION_IN_FRAMES as SPEEDTEST_DURATION,
} from "./speedtest/constants";

/** 10s of content; the matte pass doubles that, colour first then luma. */
const SPEEDTEST_MATTE_DURATION = SPEEDTEST_DURATION * 2;

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
        Speed test - two versions of the same board, each at 4K for mastering
        and 1080p for delivery. The SVG artwork is resolution independent, so
        the 1080p compositions are the same source, not a downscale.
      */}
      <Composition
        id="SpeedTest-Flat-4K"
        component={SpeedTestFlat}
        durationInFrames={SPEEDTEST_DURATION}
        fps={SPEEDTEST_FPS}
        width={3840}
        height={2160}
      />
      <Composition
        id="SpeedTest-Flat-1080p"
        component={SpeedTestFlat}
        durationInFrames={SPEEDTEST_DURATION}
        fps={SPEEDTEST_FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="SpeedTest-Flat-Matte-4K"
        component={SpeedTestFlatWithMatte}
        durationInFrames={SPEEDTEST_MATTE_DURATION}
        fps={SPEEDTEST_FPS}
        width={3840}
        height={2160}
      />
      <Composition
        id="SpeedTest-Flat-Matte-1080p"
        component={SpeedTestFlatWithMatte}
        durationInFrames={SPEEDTEST_MATTE_DURATION}
        fps={SPEEDTEST_FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="SpeedTest-Neon-4K"
        component={SpeedTestNeon}
        durationInFrames={SPEEDTEST_DURATION}
        fps={SPEEDTEST_FPS}
        width={3840}
        height={2160}
      />
      <Composition
        id="SpeedTest-Neon-1080p"
        component={SpeedTestNeon}
        durationInFrames={SPEEDTEST_DURATION}
        fps={SPEEDTEST_FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
