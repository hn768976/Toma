import type { PaletteName } from "./palettes";

/**
 * A single ripple source: a sphere in 3D plus the surface point the rings
 * radiate from. Positions are stored as fractions of the frame so the
 * composition renders identically at any output size.
 *
 * Direction convention (used for both `origin` and `light`):
 *   tilt    degrees away from the view axis. 0 = dead centre of the visible
 *           disc, 90 = exactly on the limb, >90 = round the back.
 *   azimuth degrees around the view axis, measured on screen.
 *           0 = right, 90 = up, 180 = left, 270 = down.
 * The unit vector is (sinT·cosA, sinT·sinA, cosT) with +z toward the viewer
 * and +y up, so a direction is easy to read straight off the numbers.
 */
export type SphereSpec = {
  /** Sphere centre. x is a fraction of frame width, y of frame height. */
  centre: { x: number; y: number };
  /** Sphere radius as a fraction of frame width. */
  radius: number;
  /** Where on the surface the ripples start. */
  origin: { tilt: number; azimuth: number };
  /** Geodesic angle (degrees) between consecutive rings. Constant per sphere. */
  ringSpacing: number;
  /** How many rings to emit. */
  ringCount: number;
  /** Geodesic angle (degrees) of the innermost ring. */
  firstRing: number;
  /** Notional light used for the along-ring brightness gradient. */
  light: { tilt: number; azimuth: number };
  /** Overall brightness multiplier for this sphere. */
  intensity: number;
  /** Core / glow stroke widths in px, authored against a 3840px-wide frame. */
  coreWidth: number;
  glowWidth: number;
};

/**
 * The sharp band. `x`/`y` place a point the band passes through (frame
 * fractions), `angle` is the band's own direction in degrees measured in
 * screen space: 0 is a horizontal band, positive tilts it down to the right.
 * Blur ramps up with perpendicular distance from it.
 */
export type FocusSpec = {
  x: number;
  y: number;
  angle: number;
  /** Half-thickness of the fully sharp core, as a fraction of frame height. */
  halfWidth: number;
  /** Distance beyond the sharp core over which blur reaches maximum. */
  falloff: number;
  /** Peak blur in px, authored against a 3840px-wide frame. */
  maxBlur: number;
};

export type BackgroundSpec = {
  /** Centre of the broad wash, in frame fractions — put it near the sphere. */
  x: number;
  y: number;
  /** Wash radius as a fraction of frame width. */
  spread: number;
  /** Wash strength 0..1. */
  strength: number;
  /** Large-scale mottling strength 0..1. */
  mottle: number;
};

export type CompositionSpec = {
  id: string;
  /** One entry per ripple source. r12 is the only two-sphere composition. */
  spheres: SphereSpec[];
  focus: FocusSpec;
  background: BackgroundSpec;
  /** Film-grain strength 0..1. */
  grain: number;
};

export type SphereRippleProps = {
  composition: string;
  palette: PaletteName;
};
