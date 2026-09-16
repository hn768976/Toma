/**
 * Every value that separates the two deliverables lives here, so the dark
 * reference-match and the light cyan version run the exact same geometry,
 * camera and motion.
 */
export type Theme = {
  id: string;
  label: string;

  /** Colour of the slab surfaces. */
  plate: string;
  /** Colour of the light in the seams. */
  neon: string;
  /** Colour the stack fades into at distance; also the clear colour. */
  backdrop: string;

  /** Flat light on the slab faces, before the key light. */
  ambient: number;
  /** Strength of the soft directional light that shapes the faces. */
  keyGain: number;
  /** How far the walls are darkened relative to the faces (1 = no crevice). */
  crevice: number;

  /** Hot chamfer line: gain and falloff around the lit azimuth. */
  rimGain: number;
  rimPower: number;
  /** Soft wash down the wall below the chamfer. */
  wallGain: number;
  wallPower: number;
  /** How fast that wash fades towards the bottom of the wall. */
  wallFalloff: number;
  /** Neon spilling across the flat faces. */
  faceGain: number;
  facePower: number;

  /** Distance at which the fade into `backdrop` begins, and its rate. */
  fogStart: number;
  fogDensity: number;

  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
};

/** Matches the supplied reference: near-black slabs, magenta-violet seams. */
export const violetTheme: Theme = {
  id: "violet",
  label: "Violet (reference match)",
  plate: "#15151a",
  neon: "#c81eff",
  backdrop: "#08080b",
  ambient: 0.1,
  keyGain: 0.5,
  crevice: 0.45,
  rimGain: 28,
  rimPower: 5.0,
  wallGain: 0.55,
  wallPower: 2.4,
  wallFalloff: 3.2,
  faceGain: 0.012,
  facePower: 3.0,
  fogStart: 40,
  fogDensity: 0.02,
  bloomStrength: 1.2,
  bloomRadius: 0.6,
  bloomThreshold: 1.0,
};

/** Light-mode counterpart: off-white slabs, cyan seams, bright backdrop. */
export const cyanTheme: Theme = {
  id: "cyan",
  label: "Cyan (white tiles)",
  plate: "#eceff3",
  neon: "#00d5ff",
  backdrop: "#e7ecf1",
  ambient: 0.52,
  keyGain: 0.42,
  crevice: 0.4,
  rimGain: 18,
  rimPower: 4.0,
  wallGain: 0.7,
  wallPower: 2.2,
  wallFalloff: 3.0,
  faceGain: 0.02,
  facePower: 3.0,
  fogStart: 40,
  fogDensity: 0.02,
  // The slabs themselves are near white, so the threshold has to clear them
  // before the seam light starts to bloom.
  bloomStrength: 1.3,
  bloomRadius: 0.6,
  bloomThreshold: 1.2,
};

export const themes = { violet: violetTheme, cyan: cyanTheme };
export type ThemeId = keyof typeof themes;
