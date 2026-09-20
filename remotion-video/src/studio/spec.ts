// Scene specifications for the three white-studio podium backplates.
//
// Every number here was derived by measuring the reference clips: podium
// silhouette as a % of frame, wall/floor/prop luminance at fixed probes, and
// the temporal luminance swing per wall quadrant. Light intensities are plain
// LINEAR radiance values (not sRGB hex) because that is what the probe algebra
// produces; tints are linear RGB ratios normalised so the max channel is 1.
//
// `npm run studio:measure` re-probes a render with the same code that probed
// the references, so these values stay checkable rather than eyeballed.

export type PodiumKind = "disc" | "slab" | "cylinder";

/** Composition ids are derived from these, so they are a closed set. */
export type VariantId = "PodiumDisc" | "PodiumSlab" | "PodiumCylinder";

/** Linear RGB ratio, max channel normally 1. */
export type Tint = readonly [number, number, number];
export type Vec3 = readonly [number, number, number];
export type Vec2 = readonly [number, number];

export interface CameraSpec {
  /** Vertical field of view in degrees. All three are long lenses. */
  fovDeg: number;
  position: Vec3;
  target: Vec3;
}

export interface PodiumSpec {
  kind: PodiumKind;
  /** disc / cylinder */
  radius: number;
  height: number;
  /** Soft edge break. Real plaster props are never razor sharp. */
  fillet: number;
  /** slab only */
  width: number;
  depth: number;
  /** slab only, degrees about Y. tan(rot) = width/depth centres the near corner. */
  rotationDeg: number;
}

export interface LightSpec {
  /** Uniform room bounce - the dominant term in a white cyc. Linear. */
  ambient: number;
  ambientTint: Tint;
  /** Hemispheric offset added on top of `ambient`; 0 means a flat room. */
  hemi: number;
  /** Broad key. `wrap` widens the terminator the way a large softbox does. */
  key: number;
  keyTint: Tint;
  keyDir: Vec3;
  keyWrap: number;
  /** Frontal fill lifting the shadow side. */
  fill: number;
  fillTint: Tint;
  fillDir: Vec3;
  fillWrap: number;
  /** Ambient loss toward the top of the cyclorama, and over what world height. */
  wallFalloff: number;
  wallFalloffHeight: number;
  /** Shapes the falloff curve. 1 is linear; below 1 bites sooner and then
   *  flattens, which is what the warm backdrop's gradient actually does. */
  wallFalloffPower: number;
  /** Ambient loss toward the back of the set. */
  floorFalloff: number;
  floorFalloffDepth: number;
  /** Ambient loss across the set, toward -X. A flat wall shows no directional
   *  shading at all, so this is the only thing that can produce the sideways
   *  gradient the warm reference measures (156 top-left vs 168 top-right). */
  lateral: number;
  lateralWidth: number;
}

export interface ShadowSpec {
  /** Tight occlusion ring where the prop meets the floor. */
  contactStrength: number;
  contactRadius: number;
  /** Broad cast shadow, offset along the key direction. */
  castStrength: number;
  castRadius: number;
  castOffset: Vec2;
  /** Floor bounce climbing the prop's vertical faces. */
  bounceStrength: number;
  bounceHeight: number;
  /** Dark hairline at the prop's base. */
  baseLineStrength: number;
  baseLineHeight: number;
  /** Occlusion in the concave cove corner, where floor meets backdrop. Both
   *  surfaces lose bounce light there; without it the lower backdrop reads
   *  several levels too bright. */
  coveStrength: number;
  coveRadius: number;
}

export interface GoboSpec {
  enabled: boolean;
  /** Depth of the streaks, 0-1. */
  contrast: number;
  /** Broad window pool sitting under the streaks. */
  poolStrength: number;
  poolCentre: Vec2;
  poolRadius: number;
  /** Mean value of the pool term, subtracted so the gobo stays zero-mean. */
  poolMean: number;
  /** World units per band period. */
  period: number;
  /** Band tilt in the projection plane, degrees. */
  angleDeg: number;
  /** Direction the gobo light travels. */
  lightDir: Vec3;
  /** How far the pattern breathes over one loop, in periods. */
  breathe: number;
  /** How much of the gobo the prop receives. The prop is small and sits near
   *  the centre of the light pool, so it sees far less variation than the
   *  backdrop several units behind it. */
  podiumFactor: number;
  /** How much the floor receives. The window light rakes across it at a
   *  grazing angle, so the pattern washes out - the references' floors are
   *  visibly cleaner than their backdrops. */
  floorFactor: number;
}

export interface CycloramaSpec {
  /** Front edge of the floor, and where the cove fillet begins. */
  frontZ: number;
  curveStartZ: number;
  /** Cove radius. A tighter cove concentrates the wall/floor shading
   *  transition into a narrower, lower band on screen. */
  radius: number;
  wallHeight: number;
  halfWidth: number;
  arcSegments: number;
}

export interface StudioSpec {
  id: VariantId;
  label: string;
  /** Source clip this variant reproduces. */
  reference: string;
  durationInFrames: number;
  camera: CameraSpec;
  podium: PodiumSpec;
  /** Linear albedo of the matte plaster surfaces. */
  albedo: number;
  /** Cyclorama tint at floor level and high on the backdrop. A warm paper
   *  backdrop standing on a neutral floor is what reference A measures. */
  floorTint: Tint;
  wallTint: Tint;
  /** World height over which floorTint blends into wallTint. */
  tintBlendHeight: number;
  podiumTint: Tint;
  cyclorama: CycloramaSpec;
  light: LightSpec;
  shadow: ShadowSpec;
  gobo: GoboSpec;
  /** Sensor grain in sRGB 0-255 units, so renders don't read as sterile CG. */
  grain: number;
  vignette: number;
}

/** Default cove. Reference A is a different set and overrides it. */
export const CYCLORAMA: CycloramaSpec = {
  frontZ: 9,
  curveStartZ: -1.5,
  radius: 1.2,
  wallHeight: 14,
  halfWidth: 18,
  arcSegments: 64,
};

export const FPS = 30;

// 7.40s, 16.80s, 16.80s at 30fps -> exactly 222 / 504 / 504 frames.
export const DISC_FRAMES = 222;
export const SLAB_FRAMES = 504;
export const CYLINDER_FRAMES = 504;

export const NEUTRAL: Tint = [1, 1, 1];
