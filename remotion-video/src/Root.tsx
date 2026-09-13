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
  RansomNote,
  ransomNoteSchema,
  ransomNoteDefaults,
} from "./ransom/RansomNote";
import {
  DURATION_IN_FRAMES as RANSOM_DURATION,
  FPS as RANSOM_FPS,
  BASE_WIDTH as RANSOM_WIDTH,
  BASE_HEIGHT as RANSOM_HEIGHT,
} from "./ransom/constants";

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
      {/* Ransom-note title animation. Authored at 1920x1080; the 4K
          compositions render the identical layout at resolutionScale 2, so
          the deliverable and the master never drift apart. */}
      <Composition
        id="RansomMentalHealth-1080p"
        component={RansomNote}
        durationInFrames={RANSOM_DURATION}
        fps={RANSOM_FPS}
        width={RANSOM_WIDTH}
        height={RANSOM_HEIGHT}
        schema={ransomNoteSchema}
        defaultProps={{
          ...ransomNoteDefaults,
          word: "mentalHealth" as const,
          resolutionScale: 1,
        }}
      />
      <Composition
        id="RansomMentalHealth-4K"
        component={RansomNote}
        durationInFrames={RANSOM_DURATION}
        fps={RANSOM_FPS}
        width={RANSOM_WIDTH * 2}
        height={RANSOM_HEIGHT * 2}
        schema={ransomNoteSchema}
        defaultProps={{
          ...ransomNoteDefaults,
          word: "mentalHealth" as const,
          resolutionScale: 2,
        }}
      />
      <Composition
        id="RansomPsychology-1080p"
        component={RansomNote}
        durationInFrames={RANSOM_DURATION}
        fps={RANSOM_FPS}
        width={RANSOM_WIDTH}
        height={RANSOM_HEIGHT}
        schema={ransomNoteSchema}
        defaultProps={{
          ...ransomNoteDefaults,
          word: "psychology" as const,
          resolutionScale: 1,
        }}
      />
      <Composition
        id="RansomPsychology-4K"
        component={RansomNote}
        durationInFrames={RANSOM_DURATION}
        fps={RANSOM_FPS}
        width={RANSOM_WIDTH * 2}
        height={RANSOM_HEIGHT * 2}
        schema={ransomNoteSchema}
        defaultProps={{
          ...ransomNoteDefaults,
          word: "psychology" as const,
          resolutionScale: 2,
        }}
      />
    </>
  );
};
