import { mulberry32 } from "../particle-ring/random";
import {
  CAMERA_DRIFT_X,
  CAMERA_DRIFT_Y,
  DURATION_IN_FRAMES,
  FAR_BLUR_PX,
  FIELD_DEPTH,
  FIELD_HALF_HEIGHT,
  FIELD_HALF_WIDTH,
  FLICKER_PERIODS,
  FOCAL_LENGTH,
  FOCUS_Z,
  FONT_SIZES,
  GLITCH_CHANCE,
  GLITCH_LENGTH,
  GLITCH_SLOT,
  LABEL_COUNT,
  NEAR_BLUR_PX,
  NEAR_Z,
} from "./constants";
import { LABELS } from "./labels";

export type Label = {
  text: string;
  x: number; // world units (at scale 1)
  y: number;
  z0: number; // base depth within [0, FIELD_DEPTH)
  fontSize: number; // px at 1:1
  bold: boolean;
  italic: boolean;
  colorIndex: number;
  rotation: number; // radians
  flickerPeriod: number;
  flickerPhase: number;
  flickerDepth: number; // 0..1, how much the flicker modulates alpha
  glitchSeed: number;
};

const pickWeighted = (rand: () => number) => {
  const total = FONT_SIZES.reduce((acc, f) => acc + f.weight, 0);
  let r = rand() * total;
  for (const f of FONT_SIZES) {
    r -= f.weight;
    if (r <= 0) return f.size;
  }
  return FONT_SIZES[0].size;
};

// All label "identity" is derived from its index through a seeded PRNG,
// never Math.random(): Remotion renders frames in parallel and out of
// order, so a label must look identical no matter which worker draws it.
export const generateLabels = (paletteSize: number): Label[] => {
  const labels: Label[] = [];
  for (let i = 0; i < LABEL_COUNT; i++) {
    const rand = mulberry32(i * 7919 + 17);
    const fontSize = pickWeighted(rand);
    const isHeadline = fontSize >= 42;
    labels.push({
      text: LABELS[Math.floor(rand() * LABELS.length)],
      x: (rand() * 2 - 1) * FIELD_HALF_WIDTH,
      y: (rand() * 2 - 1) * FIELD_HALF_HEIGHT,
      z0: rand() * FIELD_DEPTH,
      fontSize,
      // Headlines lean bold; everything else is a mix, like mixed log output.
      bold: isHeadline ? rand() < 0.8 : rand() < 0.35,
      italic: rand() < 0.4,
      colorIndex: Math.floor(rand() * paletteSize),
      rotation: -0.03 + (rand() * 2 - 1) * 0.012,
      flickerPeriod: FLICKER_PERIODS[Math.floor(rand() * FLICKER_PERIODS.length)],
      flickerPhase: rand() * Math.PI * 2,
      flickerDepth: 0.05 + rand() * 0.18,
      glitchSeed: Math.floor(rand() * 100000),
    });
  }
  return labels;
};

export type Camera = { x: number; y: number; z: number };

export const cameraAt = (frame: number): Camera => {
  const t = frame / DURATION_IN_FRAMES;
  const phase = t * Math.PI * 2;
  return {
    x: CAMERA_DRIFT_X * Math.sin(phase + Math.PI / 2),
    y: CAMERA_DRIFT_Y * Math.sin(phase),
    // One full tunnel length per loop.
    z: t * FIELD_DEPTH,
  };
};

export type Projected = {
  label: Label;
  z: number; // distance in front of the camera
  depthT: number; // 0 = nearest, 1 = farthest
  screenX: number; // px at 1x, relative to frame origin
  screenY: number;
  scale: number;
  blur: number; // px at 1x
  alpha: number; // depth fade + flicker, 0..1
  glitch: { offset: number; bandStart: number; bandHeight: number } | null;
};

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const projectLabel = (
  label: Label,
  camera: Camera,
  frame: number,
  frameWidth: number,
  frameHeight: number,
  farDim: number,
  depthOfField: number,
): Projected => {
  // Wrap the label's depth into the moving window in front of the camera.
  const wrapped =
    (((label.z0 - camera.z) % FIELD_DEPTH) + FIELD_DEPTH) % FIELD_DEPTH;
  const z = NEAR_Z + wrapped;
  const depthT = wrapped / FIELD_DEPTH;
  const scale = FOCAL_LENGTH / z;

  const screenX = frameWidth / 2 + (label.x - camera.x) * scale;
  const screenY = frameHeight / 2 + (label.y - camera.y) * scale;

  // Blur ramps away from the focus plane, steeper on the near side.
  const blur =
    depthOfField *
    (z < FOCUS_Z
      ? NEAR_BLUR_PX * Math.pow((FOCUS_Z - z) / (FOCUS_Z - NEAR_Z), 1.5)
      : FAR_BLUR_PX *
        Math.pow((z - FOCUS_Z) / (NEAR_Z + FIELD_DEPTH - FOCUS_Z), 1.2));

  // Fade in at the back, fade out just before wrapping, dim with distance.
  const nearFade = smoothstep(0, 0.07, depthT);
  const farFade = 1 - smoothstep(0.86, 1, depthT);
  const distanceDim = 1 - (1 - farDim) * Math.pow(depthT, 0.9);
  const flicker =
    1 -
    label.flickerDepth *
      (0.5 +
        0.5 *
          Math.sin(
            (frame * Math.PI * 2) / label.flickerPeriod + label.flickerPhase,
          ));
  const alpha = nearFade * farFade * distanceDim * flicker;

  // Glitch: decide per GLITCH_SLOT window whether this label glitches and
  // in which frames of that window, purely from (label, window index).
  const slot = Math.floor(frame / GLITCH_SLOT);
  const slotRand = mulberry32(label.glitchSeed * 131 + slot * 7 + 3);
  let glitch: Projected["glitch"] = null;
  if (slotRand() < GLITCH_CHANCE) {
    const start = Math.floor(slotRand() * (GLITCH_SLOT - GLITCH_LENGTH));
    const local = frame - slot * GLITCH_SLOT;
    if (local >= start && local < start + GLITCH_LENGTH) {
      glitch = {
        offset: (slotRand() < 0.5 ? -1 : 1) * (6 + slotRand() * 14),
        bandStart: -0.5 + slotRand() * 0.6, // in em, relative to text middle
        bandHeight: 0.25 + slotRand() * 0.35,
      };
    }
  }

  return { label, z, depthT, screenX, screenY, scale, blur, alpha, glitch };
};
