// Variant configuration.
//
// A variant is a theme plus a depth response. The two shipped variants share
// the same palette entirely — what separates them is which way the camera is
// travelling and how depth is distributed along the corridor.

import type { ThemeName } from "./theme";

export type TunnelVariant = {
  theme: ThemeName;

  // THE signed depth direction. Every z calculation multiplies by it and the
  // motion-blur trail vector is derived from it, so flipping this value —
  // and nothing else — reverses the flow.
  //   +1  camera retreats: chips flow away, toward the vanishing point
  //   -1  camera advances: chips emerge from the vanishing point and rush
  //       outward past the lens
  cameraDirection: 1 | -1;

  // Shapes how depth is distributed along a chip's life:
  //
  //     z(u) = zNear * (Z_FAR / zNear) ^ (u ^ depthEase)
  //
  // 1 spreads chips evenly in log-radius. Below 1, chips linger near the
  // vanishing point and accelerate hard as they reach the camera — which
  // both packs the far end of the corridor and gives an approach its
  // ease-in on size and speed. Above 1 would do the reverse.
  depthEase: number;

  // Depth of the near plane. Lower brings the closest chips nearer the lens,
  // making them larger and pushing them past the frame edge.
  zNear: number;

  // Peak per-chip blur in destination pixels at 4K.
  blurCeiling: number;

  // Alpha weights of the near-band motion-blur taps, leading tap first.
  motionBlurTaps: number[];

  // How many frames of travel the tap fan spans.
  motionBlurSpan: number;

  // Extra dimming applied to chips at the vanishing point.
  farDim: number;

  // Vanishing point, as a fraction of frame width / height.
  vanishingPoint: { x: number; y: number };

  // Angular wedge the paths fan across, in radians, measured from the
  // vanishing point with +y pointing DOWN the screen.
  pathAngleStart: number;
  pathAngleEnd: number;

  // Where along u the narrow in-focus band sits. Because depthEase changes
  // how u maps to screen radius, a variant that eases has to move this to
  // keep the focus band at a comparable distance from the vanishing point —
  // otherwise the crisp part of the corridor collapses toward the far end.
  sharpCenterU: number;
};

export const VARIANTS = {
  // Both variants share the reference's geometry: an oblique plane whose
  // vanishing point sits hard against the upper-left edge, with the fan
  // opening right and down-right across roughly 115 degrees centred near 43
  // degrees below horizontal. Only the flow direction and the palette differ
  // between them, which is the whole point of the pair.

  // v1 — the camera retreats, so chips travel up and left along the rows,
  // into the vanishing point.
  violet: {
    theme: "violet",
    cameraDirection: 1,
    depthEase: 1,
    zNear: 1.35,
    blurCeiling: 30,
    motionBlurTaps: [1, 0.6, 0.3],
    motionBlurSpan: 1,
    farDim: 0.5,
    sharpCenterU: 0.42,
    vanishingPoint: { x: 0.09, y: 0.28 },
    // Just above horizontal-right, through down-right, to down-and-slightly
    // -left. The wedge has to clear the top-right corner at one end and reach
    // the bottom-left at the other, from a vanishing point this far into the
    // corner.
    pathAngleStart: -0.25,
    pathAngleEnd: 1.75,
  },

  // v2 — the camera advances, so chips emerge from that same upper-left
  // vanishing point and rush down and right, out past the lens.
  //
  // A reversed flow is not a receding flow played backwards. Chips now
  // *emerge* from the vanishing point rather than accumulating there, so the
  // far end has to be packed or the corridor looks like it is running out of
  // material — hence depthEase well below 1, which also buys the steeper
  // ease-in on size and speed as a chip closes on the lens. The near plane
  // moves closer and the blur ceiling rises, because these chips are passing
  // the lens rather than settling into it.
  azureApproach: {
    theme: "azure",
    cameraDirection: -1,
    depthEase: 0.56,
    zNear: 1.05,
    blurCeiling: 40,
    // Five taps, not three: approaching motion strobes far worse at 30fps,
    // because peak per-frame displacement lands exactly when the chip is
    // biggest and brightest.
    motionBlurTaps: [1, 0.78, 0.58, 0.4, 0.24],
    motionBlurSpan: 1.25,
    farDim: 0.6,
    sharpCenterU: 0.27,
    vanishingPoint: { x: 0.09, y: 0.28 },
    pathAngleStart: -0.25,
    pathAngleEnd: 1.75,
  },
} satisfies Record<string, TunnelVariant>;

export const VARIANT_NAMES = ["violet", "azureApproach"] as const;

export type VariantName = (typeof VARIANT_NAMES)[number];
