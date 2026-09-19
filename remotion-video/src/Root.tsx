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
  BASE_WIDTH,
  BASE_HEIGHT,
  DURATION_IN_FRAMES as RING_DURATION_IN_FRAMES,
  FPS as RING_FPS,
} from "./particle-ring/constants";

import {
  PLATES,
  PLATE_FPS,
  UHD_WIDTH,
  UHD_HEIGHT,
  HD_WIDTH,
  HD_HEIGHT,
  plateSchema,
} from "./plates/plates";
import { makePlate } from "./plates/ShaderPlate";

// Built once at module scope: creating these during render would remount the
// WebGL context on every frame.
const PLATE_COMPONENTS = PLATES.map((plate) => ({
  ...plate,
  component: makePlate(plate.fragment),
}));

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

      {PLATE_COMPONENTS.map((plate) => (
        <React.Fragment key={plate.id}>
          {/* 4K master - the mastering composition shipped in the project. */}
          <Composition
            id={`${plate.id}4K`}
            component={plate.component}
            durationInFrames={plate.durationInFrames}
            fps={PLATE_FPS}
            width={UHD_WIDTH}
            height={UHD_HEIGHT}
            schema={plateSchema}
            defaultProps={plate.defaults}
          />
          {/* 1080p delivery sibling - identical shader, half the linear res. */}
          <Composition
            id={`${plate.id}1080`}
            component={plate.component}
            durationInFrames={plate.durationInFrames}
            fps={PLATE_FPS}
            width={HD_WIDTH}
            height={HD_HEIGHT}
            schema={plateSchema}
            defaultProps={plate.defaults}
          />
        </React.Fragment>
      ))}
    </>
  );
};
