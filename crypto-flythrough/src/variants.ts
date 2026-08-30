/**
 * The single source of truth for everything that differs between the two
 * versions of the flythrough. No colour value and no layout decision that
 * changes between variants is allowed to live anywhere else in the project.
 */

export type StreamAxis = "horizontal" | "vertical";
export type CameraMode = "forward" | "static";
export type VariantName = "teal" | "blue";

export type Palette = {
  /** Scene clear colour. */
  background: string;
  /** Dominant text colour. */
  codeMain: string;
  /** Brighter fragments, nearest the camera. */
  codeWhite: string;
  /** Distant text. */
  codeDim: string;
  /** Comment lines — the brightest part of every block. */
  comment: string;
  /** Rare small floating marks. */
  accent: string;
  /** Coin body. Absent in variants with no coins. */
  coinBody?: string;
  /** Coin rim / face mark. Absent in variants with no coins. */
  coinRim?: string;
};

export type VariantConfig = {
  palette: Palette;
  /** Which world axis the fragments travel along. */
  streamAxis: StreamAxis;
  /**
   * Signed flow direction along that axis.
   *
   * Each axis has a canonical positive travel vector:
   *   horizontal -> (-1, 0, 0)   (right to left)
   *   vertical   -> ( 0, 1, 0)   (upward)
   * `flowDirection` multiplies it, so `horizontal` + `1` streams right-to-left
   * and `vertical` + `-1` falls straight down.
   */
  flowDirection: 1 | -1;
  /** Number of tumbling coins. May be zero. */
  coinCount: number;
  /** Number of code fragment planes. */
  planeCount: number;
  /** How the camera behaves over the 270 frame loop. */
  cameraMode: CameraMode;
  /** Base world width for a code plane, before the per-plane multiplier. */
  planeBase: number;
  /** Multiplier range for the per-plane size. Wider range = more hierarchy. */
  planeScale: { min: number; max: number };
  /**
   * Shutter length in frames used to build the motion blur streaks.
   * Streak length = per-frame travel * shutterFrames.
   */
  shutterFrames: number;
  /** Depth of field focus plane, in world units in front of the camera. */
  focusWorldDistance: number;
  /** Depth of field focus band half-width, in world units. */
  focusWorldRange: number;
  bokehScale: number;
  bloomIntensity: number;
  bloomThreshold: number;
  /** Static pitch of the camera, in radians. Positive looks upward. */
  cameraPitch: number;
  /**
   * Forward travel of the camera through the field, in world units per frame.
   * Expressed as the field approaching the lens (see CAMERA-NOTES.md).
   * Zero for a camera that holds position.
   */
  dollyRate: number;
};

export const DURATION_IN_FRAMES = 270;
export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FOV = 60;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 300;

export const VARIANTS: Record<VariantName, VariantConfig> = {
  teal: {
    palette: {
      background: "#030F0C",
      codeMain: "#4FD4C4",
      codeWhite: "#E8FFFA",
      codeDim: "#145248",
      comment: "#6FE89F",
      accent: "#F5C43F",
      coinBody: "#3FC4B8",
      coinRim: "#A8FFF0",
    },
    streamAxis: "horizontal",
    flowDirection: 1,
    coinCount: 16,
    planeCount: 90,
    cameraMode: "forward",
    planeBase: 1.5,
    planeScale: { min: 0.8, max: 1.5 },
    shutterFrames: 6,
    focusWorldDistance: 56,
    focusWorldRange: 26,
    bokehScale: 3.6,
    bloomIntensity: 1.1,
    bloomThreshold: 0.16,
    cameraPitch: 0.02,
    dollyRate: 0.16,
  },
  blue: {
    palette: {
      background: "#02061A",
      codeMain: "#4F9FFF",
      codeWhite: "#E8F2FF",
      codeDim: "#143A6B",
      comment: "#5FD4F5",
      accent: "#9B7FE8",
    },
    streamAxis: "vertical",
    flowDirection: -1,
    coinCount: 0,
    planeCount: 140,
    cameraMode: "static",
    // 140 planes over a much wider size range covers far more of the frame
    // than 90 planes do, so the base comes down to keep the density
    // comparable.
    planeBase: 1.0,
    // Roughly 3x the size span of the teal variant: 0.28..2.38 (2.10 wide)
    // against 0.80..1.50 (0.70 wide).
    planeScale: { min: 0.28, max: 2.38 },
    shutterFrames: 6,
    focusWorldDistance: 56,
    focusWorldRange: 26,
    bokehScale: 3.6,
    bloomIntensity: 1.2,
    bloomThreshold: 0.15,
    cameraPitch: 0.075,
    dollyRate: 0,
  },
};
