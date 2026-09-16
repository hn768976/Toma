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
import { TileField } from "./tile-field/TileField";
import { THEMES, type ThemeId } from "./tile-field/themes";
import {
  DURATION_IN_FRAMES as TILE_DURATION_IN_FRAMES,
  FPS as TILE_FPS,
  WIDTH_1080,
  HEIGHT_1080,
  WIDTH_4K,
  HEIGHT_4K,
} from "./tile-field/config";

/**
 * Three colour versions of the tile-field loop, each registered at the 1080p
 * delivery size and at the 4K master size. Both sizes are the same composition
 * -- the scene is fully procedural, so it resolution-scales with no changes.
 */
const TILE_FIELD_IDS = Object.keys(THEMES) as ThemeId[];

const capitalise = (value: string) => value[0].toUpperCase() + value.slice(1);

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
      {TILE_FIELD_IDS.map((themeId) => (
        <React.Fragment key={themeId}>
          <Composition
            id={`TileField${capitalise(themeId)}1080p`}
            component={TileField}
            durationInFrames={TILE_DURATION_IN_FRAMES}
            fps={TILE_FPS}
            width={WIDTH_1080}
            height={HEIGHT_1080}
            defaultProps={{ themeId }}
          />
          <Composition
            id={`TileField${capitalise(themeId)}4K`}
            component={TileField}
            durationInFrames={TILE_DURATION_IN_FRAMES}
            fps={TILE_FPS}
            width={WIDTH_4K}
            height={HEIGHT_4K}
            defaultProps={{ themeId }}
          />
        </React.Fragment>
      ))}
    </>
  );
};
