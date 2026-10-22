import "./index.css";
import { Composition, Easing, interpolate } from "remotion";
import { CameraRig, FilamentScene } from "./filaments/FilamentScene";
import { ELECTRIC_BLUE } from "./filaments/palettes";

// 4K masters. The reference clip is 320 frames (10.667 s) at 30 fps.
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
const DURATION = 320;

// Version A: low, locked-off camera skimming the filament disc, as in the
// reference. The animation loops seamlessly.
const referenceCamera: CameraRig = () => ({
  position: [0, 1.6, -7.5],
  target: [0, 0.1, 0],
  fovDeg: 38,
});

// Version B: same field, but the camera cranes up and orbits ~65 degrees,
// moving from the low grazing view to a high three-quarter view that reveals
// the full radial structure.
const craneOrbitCamera: CameraRig = (frame, duration) => {
  const t = interpolate(frame, [0, duration - 1], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
  });
  const azimuth = interpolate(t, [0, 1], [-0.45, 0.7]);
  const distance = interpolate(t, [0, 1], [7.6, 6.2]);
  const height = interpolate(t, [0, 1], [1.4, 5.2]);
  return {
    position: [Math.sin(azimuth) * distance, height, -Math.cos(azimuth) * distance],
    target: [0, interpolate(t, [0, 1], [0.1, -0.6]), 0],
    fovDeg: interpolate(t, [0, 1], [38, 42]),
    roll: interpolate(t, [0, 0.5, 1], [0.03, 0, -0.04]),
  };
};

const ReferenceVersion: React.FC = () => (
  <FilamentScene palette={ELECTRIC_BLUE} camera={referenceCamera} />
);

const CraneOrbitVersion: React.FC = () => (
  <FilamentScene palette={ELECTRIC_BLUE} camera={craneOrbitCamera} />
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="FilamentsReference"
        component={ReferenceVersion}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="FilamentsCraneOrbit"
        component={CraneOrbitVersion}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
