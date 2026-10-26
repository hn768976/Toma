import type { CoralBlobsProps } from "./CoralBlobs";

export const FPS = 30;
// Reference clip: 10.000 s at 30 fps.
export const DURATION_IN_FRAMES = 300;
export const WIDTH_4K = 3840;
export const HEIGHT_4K = 2160;

const sharedField = { seed: 7, frequency: 0.4, sheetWidth: 0.2, maskThreshold: 0.45 } as const;

const sharedMotion: CoralBlobsProps["motion"] = {
  warpAmplitude: 0.42,
  warpSpeed: 0.55,
  flowSpeed: 0.35,
  drift: [-0.72, 0.16, 0],
  yawStart: -0.08,
  yawEnd: 0.08,
  pitchStart: 0.03,
  pitchEnd: -0.03,
  dollyStart: 0,
  dollyEnd: 0,
};

// Version 1: matches the reference -- dusty-pink / coral spheres on a soft
// light-grey studio backdrop.
export const coralV1: CoralBlobsProps = {
  field: { ...sharedField },
  motion: sharedMotion,
  look: {
    palette: [
      [164, 92, 86],
      [196, 122, 114],
      [222, 158, 150],
      [238, 192, 186],
      [246, 214, 209],
    ],
    backgroundCenter: [224, 223, 224],
    backgroundEdge: [190, 190, 191],
    fogColor: [218, 216, 217],
    focusDistance: 7.6,
    cocStrength: 320,
  },
};

// Version 2: same field, motion and lighting with a cool glacier palette --
// aqua / deep-teal spheres on a pale blue-grey backdrop.
export const coralV2: CoralBlobsProps = {
  field: { ...sharedField },
  motion: sharedMotion,
  look: {
    palette: [
      [30, 98, 110],
      [52, 140, 148],
      [96, 186, 188],
      [160, 222, 220],
      [208, 240, 238],
    ],
    backgroundCenter: [222, 230, 234],
    backgroundEdge: [178, 192, 200],
    fogColor: [212, 223, 228],
    focusDistance: 7.6,
    cocStrength: 320,
  },
};
