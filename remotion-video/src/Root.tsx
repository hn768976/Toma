import React from "react";
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
  BlueprintFlyover,
  blueprintFlyoverSchema,
  blueprintFlyoverDefaults,
} from "./blueprint/BlueprintFlyover";
import {
  FPS as BP_FPS,
  DURATION_IN_FRAMES as BP_DURATION,
  HD_WIDTH,
  HD_HEIGHT,
  UHD_WIDTH,
  UHD_HEIGHT,
  type ThemeName,
} from "./blueprint/constants";
import {
  BASE_WIDTH,
  BASE_HEIGHT,
  DURATION_IN_FRAMES as RING_DURATION_IN_FRAMES,
  FPS as RING_FPS,
} from "./particle-ring/constants";

/**
 * The three blueprint cuts. "Reference" matches the supplied clip, "Light" is
 * the printed-paper inversion, "Lite" is the stripped-back plate.
 */
const BLUEPRINT_VARIANTS: { id: string; theme: ThemeName; seed: number }[] = [
  { id: "BlueprintFlyover-Reference", theme: "neon", seed: 20641 },
  { id: "BlueprintFlyover-Light", theme: "paper", seed: 20641 },
  { id: "BlueprintFlyover-Lite", theme: "lite", seed: 3307 },
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

      {BLUEPRINT_VARIANTS.map(({ id, theme, seed }) => (
        <React.Fragment key={id}>
          {/* Mastering comp. Everything is graded and framed here first. */}
          <Composition
            id={`${id}-4K`}
            component={BlueprintFlyover}
            durationInFrames={BP_DURATION}
            fps={BP_FPS}
            width={UHD_WIDTH}
            height={UHD_HEIGHT}
            schema={blueprintFlyoverSchema}
            defaultProps={{ ...blueprintFlyoverDefaults, theme, seed }}
          />
          {/* Delivery comp. Identical drawing, rendered at 1080p. */}
          <Composition
            id={`${id}-1080p`}
            component={BlueprintFlyover}
            durationInFrames={BP_DURATION}
            fps={BP_FPS}
            width={HD_WIDTH}
            height={HD_HEIGHT}
            schema={blueprintFlyoverSchema}
            defaultProps={{ ...blueprintFlyoverDefaults, theme, seed }}
          />
        </React.Fragment>
      ))}
    </>
  );
};
