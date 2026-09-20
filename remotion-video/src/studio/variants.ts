import {
  CYLINDER_FRAMES,
  DISC_FRAMES,
  NEUTRAL,
  SLAB_FRAMES,
  type CycloramaSpec,
  type GoboSpec,
  type LightSpec,
  type ShadowSpec,
  type StudioSpec,
} from "./spec";

// How these numbers were obtained: each reference was probed at four fixed
// points (floor, cyclorama, lit prop face, shadowed prop face). Those sRGB
// values were converted to linear, divided by albedo to get irradiance, and
// the ambient / key / fill terms solved from the resulting equations. For the
// cool rig the solution reproduces all four probes to within ~2 sRGB levels,
// and it put the hemispheric term at ~0 - the white room bounce really is
// near-uniform, and the floor/wall split is almost pure N-dot-L.

/** Solved from where each reference's wall/floor transition falls on screen.
 *  These are small tabletop sweeps, not room-sized cycloramas. */
const COOL_CYC: CycloramaSpec = {
  frontZ: 9,
  // Solved so the wall/floor junction lands at 74.5% of frame with the cove
  // spanning only ~14px, matching the reference's crisp step (flat backdrop to
  // 310px, floor by 330px). An earlier, much larger cove put the junction in
  // roughly the right place only by accident - its long shading ramp happened
  // to be steepest there while the true junction sat 29px lower, which read as
  // an infinite sweep rather than a floor meeting a wall.
  curveStartZ: -4.463,
  radius: 0.148,
  wallHeight: 14,
  halfWidth: 18,
  arcSegments: 64,
};

const WARM_CYC: CycloramaSpec = {
  frontZ: 9,
  curveStartZ: -1.32,
  radius: 0.22,
  wallHeight: 14,
  halfWidth: 18,
  arcSegments: 64,
};

const COOL_LIGHT: LightSpec = {
  // +0.027 over the raw probe fit. The references were probed *after* their
  // own H.264 decode, so matching them means matching after ours too - and
  // the limited-range 8-bit round trip costs ~3 levels. This puts the
  // delivered file on the references rather than on the PNG stills.
  ambient: 0.5763,
  ambientTint: NEUTRAL,
  hemi: 0,
  key: 0.3921,
  keyTint: NEUTRAL,
  keyDir: [0.8906, 0.4405, 0.1128],
  keyWrap: 0.55,
  fill: 0.022,
  fillTint: NEUTRAL,
  fillDir: [0, 0.2, 1],
  fillWrap: 0.6,
  wallFalloff: 0,
  wallFalloffHeight: 9,
  wallFalloffPower: 1,
  floorFalloff: 0.05,
  floorFalloffDepth: 11,
  lateral: 0.03,
  lateralWidth: 3.5,
};

// Soft leaf/curtain shadows. Measured off the references: bands running at
// ~29 degrees, ~2.6 world units apart, and - importantly - undulating in place
// rather than translating. Reference B and C share this animation exactly
// (their wall quadrant luminances agree to within 0.2 of a level at every
// timestamp), so both variants use one gobo.
const COOL_GOBO: GoboSpec = {
  enabled: true,
  contrast: 0.182,
  poolStrength: 0.22,
  // Located by taking the brightness-weighted centroid of the reference
  // backdrop's top decile (38.0%, 38.8% of frame) and mapping that point
  // through the projection into the gobo plane. poolMean is the pool term's
  // actual mean over the visible backdrop, which keeps the gobo zero-mean.
  poolCentre: [-2.483, 3.896],
  poolRadius: 3.4,
  poolMean: 0.5169,
  // 26.6 deg of band tilt on the wall and ~115px of perpendicular spacing,
  // both measured off the references. The in-plane rotation that produces
  // that tilt is not the tilt itself - it depends on how the gobo plane
  // projects onto the backdrop - so both were solved for, not guessed.
  // The pattern lives in world space, so moving the backdrop further away
  // makes a given world spacing subtend less on screen; the period is scaled
  // by the distance ratio to hold the measured ~115px. The tilt is unaffected:
  // x and y scale together, so the projected slope is distance-independent.
  period: 1.243,
  angleDeg: 78.94,
  lightDir: [0.46, -0.5, -0.73],
  breathe: 0.16,
  podiumFactor: 0.3,
  floorFactor: 0.22,
};

const COOL_SHADOW: ShadowSpec = {
  contactStrength: 0.3,
  contactRadius: 0.14,
  castStrength: 0.11,
  castRadius: 1.5,
  castOffset: [-0.55, -0.2],
  bounceStrength: 0.075,
  bounceHeight: 0.3,
  baseLineStrength: 0.22,
  baseLineHeight: 0.022,
  coveStrength: 0.05,
  coveRadius: 2.6,
};

/** ~80mm-equivalent, 3.9 degrees of elevation. Shared by slab and cylinder. */
const COOL_CAMERA = {
  fovDeg: 16.92,
  position: [0, 1.44, 12],
  target: [0, 1.2625, 0],
} as const;

export const DISC: StudioSpec = {
  id: "PodiumDisc",
  label: "V1 - thin disc, warm greige studio",
  reference: "istockphoto-1354114168 (7.40s)",
  durationInFrames: DISC_FRAMES,
  camera: {
    // Longer lens than the other two, tilted slightly up: the prop sits low in
    // frame and the backdrop carries the rest.
    fovDeg: 11.69,
    position: [0, 0.479, 12],
    target: [0, 0.876, 0],
  },
  podium: {
    kind: "disc",
    radius: 1.0,
    height: 0.1,
    fillet: 0.022,
    width: 0,
    depth: 0,
    rotationDeg: 0,
  },
  albedo: 0.85,
  // The reference measures (156,149,142) high on the backdrop but a dead
  // neutral (208,208,208) underfoot - a warm paper sweep on a white floor.
  floorTint: NEUTRAL,
  // Normalised to unit luminance (0.2126R + 0.7152G + 0.0722B = 1) so it
  // shifts hue without darkening, which the neutral probe fit assumed.
  wallTint: [1.0904, 0.9846, 0.8865],
  tintBlendHeight: 2.6,
  podiumTint: NEUTRAL,
  cyclorama: WARM_CYC,
  light: {
    ambient: 0.2177,
    ambientTint: NEUTRAL,
    hemi: 0,
    // +0.042 over the raw probe fit, for the same encode round-trip reason as
    // the cool rig. It goes on the key rather than the ambient because this
    // backdrop's ambient is attenuated to ~0.07 high up, where the deficit
    // shows just as strongly - only the key reaches there.
    key: 0.6168,
    keyTint: NEUTRAL,
    keyDir: [0.1805, 0.8848, 0.4295],
    keyWrap: 0.6,
    fill: 0,
    fillTint: NEUTRAL,
    fillDir: [0, 0.2, 1],
    fillWrap: 0.6,
    wallFalloff: 0.8445,
    wallFalloffHeight: 2.12,
    wallFalloffPower: 0.55,
    floorFalloff: 0,
    floorFalloffDepth: 11,
    lateral: 0.36,
    lateralWidth: 2.46,
  },
  shadow: {
    contactStrength: 0.34,
    contactRadius: 0.1,
    castStrength: 0.07,
    castRadius: 1.1,
    castOffset: [-0.35, -0.12],
    bounceStrength: 0.13,
    bounceHeight: 0.14,
    baseLineStrength: 0.3,
    baseLineHeight: 0.012,
    coveStrength: 0,
    coveRadius: 2.2,
  },
  gobo: { ...COOL_GOBO, enabled: false },
  grain: 1.4,
  vignette: 0.05,
};

export const SLAB: StudioSpec = {
  id: "PodiumSlab",
  label: "V2 - rectangular slab, cool white studio",
  reference: "istockphoto-1596392432 (16.80s)",
  durationInFrames: SLAB_FRAMES,
  camera: COOL_CAMERA,
  podium: {
    kind: "slab",
    radius: 0,
    height: 0.62,
    fillet: 0.018,
    width: 1.885,
    depth: 1.885,
    rotationDeg: 45,
  },
  albedo: 0.85,
  floorTint: NEUTRAL,
  wallTint: NEUTRAL,
  tintBlendHeight: 2.6,
  podiumTint: NEUTRAL,
  cyclorama: COOL_CYC,
  light: COOL_LIGHT,
  shadow: COOL_SHADOW,
  gobo: COOL_GOBO,
  grain: 1.4,
  vignette: 0.04,
};

export const CYLINDER: StudioSpec = {
  id: "PodiumCylinder",
  label: "V3 - cylinder, cool white studio",
  reference: "istockphoto-1596376637 (16.80s)",
  durationInFrames: CYLINDER_FRAMES,
  camera: COOL_CAMERA,
  podium: {
    kind: "cylinder",
    radius: 1.019,
    height: 0.62,
    fillet: 0.07,
    width: 0,
    depth: 0,
    rotationDeg: 0,
  },
  albedo: 0.85,
  floorTint: NEUTRAL,
  wallTint: NEUTRAL,
  tintBlendHeight: 2.6,
  podiumTint: NEUTRAL,
  cyclorama: COOL_CYC,
  light: COOL_LIGHT,
  shadow: COOL_SHADOW,
  gobo: COOL_GOBO,
  grain: 1.4,
  vignette: 0.04,
};

export const VARIANTS: readonly StudioSpec[] = [DISC, SLAB, CYLINDER];
