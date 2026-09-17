/**
 * Colour grades for the Spiral Flow loop.
 *
 * Nothing in the scene is vertex-coloured: the look comes almost entirely from
 * coloured lights bouncing off a near-white soft-touch material, the same way
 * the reference plate was lit. Swapping a grade therefore re-lights the shot
 * rather than repainting it, which keeps the shading physically consistent.
 *
 * Adding a grade here is all it takes — the schema enum and the composition
 * list are both derived from these keys.
 */

export type Grade = {
  /** Base albedo of the ribbed surface. Kept light so lights do the work. */
  surface: string;
  /** Hot core light sitting above the pole the flutes converge at. */
  core: string;
  /** Main coloured key, raking across the tubes from the left. */
  key: string;
  /** Opposing fill that paints the foreground ribs. */
  fill: string;
  /** Soft bounce coming up from below. */
  bounce: string;
  /** Sheen tint — the velvet falloff at grazing angles. */
  sheen: string;
  /** Exponential fog; also the colour the far side dissolves into. */
  fog: string;
  /**
   * Backdrop wash, `[deep, light]`, running deep at the top-left to light at
   * the bottom-right. Only the wedge outside the sphere's limb is ever
   * unoccluded, so these two control the one visible piece of sky.
   */
  backdrop: [string, string];
};

export const GRADES = {
  /** Matches the supplied reference: indigo key, violet fill, icy core. */
  violet: {
    surface: "#d4c4f8",
    core: "#dbe7ff",
    key: "#2f4ae6",
    fill: "#a855f0",
    bounce: "#8a4fd8",
    sheen: "#c9b6ff",
    fog: "#a79ae8",
    backdrop: ["#3a42c8", "#8b83ea"],
  },
  /** Electric royal blue — same lighting geometry, pure blue hues. */
  blue: {
    surface: "#aac2f3",
    core: "#dcecff",
    key: "#1b3ad6",
    fill: "#2f6bf5",
    bounce: "#23479f",
    sheen: "#9dc0ff",
    fog: "#8ba4ef",
    backdrop: ["#1c2fb4", "#4f74e4"],
  },
  /**
   * Deep teal into mint. The coolest of the four, pushing the soft-touch
   * material towards sea glass.
   *
   * Green carries far more luminance than blue or violet at the same nominal
   * saturation, so these are luminance-matched to the violet grade rather than
   * picked by eye — matching by hue alone blew the core and the tubes out.
   */
  emerald: {
    surface: "#8cc7b0",
    core: "#c4f2e2",
    key: "#0c6f74",
    fill: "#14916c",
    bounce: "#12624f",
    sheen: "#93d6bd",
    fog: "#6aab9b",
    backdrop: ["#0c4f5c", "#3ea08d"],
  },
  /**
   * Crimson into amber. The warm counterweight to the other three — the same
   * hot core now reads as a low sun rather than a lamp. Luminance-matched to
   * the violet grade for the same reason as `emerald`.
   */
  ember: {
    surface: "#dcae85",
    core: "#ffe6c0",
    key: "#a81f42",
    fill: "#c26a1c",
    bounce: "#8a3324",
    sheen: "#f0c79b",
    fog: "#cb8d70",
    backdrop: ["#6f1b3f", "#d4783f"],
  },
} as const satisfies Record<string, Grade>;

export type GradeName = keyof typeof GRADES;

/** Non-empty tuple of grade names, for `z.enum` and the composition list. */
export const GRADE_NAMES = Object.keys(GRADES) as [GradeName, ...GradeName[]];
