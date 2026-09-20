import "./index.css";
import "./load-fonts";
import React from "react";
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
import { CyberEye, cyberEyeDefaults, cyberEyeSchema } from "./cyber-eye/CyberEye";
import { PALETTES, PALETTE_IDS } from "./cyber-eye/palettes";
import {
  DURATION_IN_FRAMES as EYE_DURATION_IN_FRAMES,
  FPS as EYE_FPS,
  HEIGHT_4K,
  HEIGHT_HD,
  WIDTH_4K,
  WIDTH_HD,
} from "./cyber-eye/constants";

// Composition id fragment per colourway, e.g. "Eye-Navy-4K".
const EYE_NAMES: Record<(typeof PALETTE_IDS)[number], string> = {
  "blue-light": "Blue",
  crimson: "Crimson",
  navy: "Navy",
  green: "Green",
};

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
      {/* Cyber Eye: one 4K master and one 1080p delivery composition per colourway. */}
      {PALETTE_IDS.map((id) => (
        <React.Fragment key={id}>
          <Composition
            id={`Eye-${EYE_NAMES[id]}-4K`}
            component={CyberEye}
            durationInFrames={EYE_DURATION_IN_FRAMES}
            fps={EYE_FPS}
            width={WIDTH_4K}
            height={HEIGHT_4K}
            schema={cyberEyeSchema}
            defaultProps={{ ...cyberEyeDefaults, palette: PALETTES[id].id }}
          />
          <Composition
            id={`Eye-${EYE_NAMES[id]}-1080p`}
            component={CyberEye}
            durationInFrames={EYE_DURATION_IN_FRAMES}
            fps={EYE_FPS}
            width={WIDTH_HD}
            height={HEIGHT_HD}
            schema={cyberEyeSchema}
            defaultProps={{ ...cyberEyeDefaults, palette: PALETTES[id].id }}
          />
        </React.Fragment>
      ))}
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
