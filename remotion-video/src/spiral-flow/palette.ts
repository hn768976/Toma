/**
 * Colour grades for the Spiral Flow loop.
 *
 * Nothing in the scene is vertex-coloured: the look comes almost entirely from
 * coloured lights bouncing off a near-white soft-touch material, the same way
 * the reference plate was lit. Swapping a grade therefore re-lights the shot
 * rather than repainting it, which keeps the shading physically consistent.
 */

export type Grade = {
  /** Base albedo of the ribbed surface. Kept near-white so lights do the work. */
  surface: string;
  /** Hot core light sitting at the centre of the spiral. */
  core: string;
  /** Main coloured key, sweeping in from the back left. */
  key: string;
  /** Opposing fill that paints the foreground ribs. */
  fill: string;
  /** Soft bounce coming up from below the rim. */
  bounce: string;
  /** Sheen tint — the velvet falloff on grazing angles. */
  sheen: string;
  /** Exponential fog; also the colour the far rim dissolves into. */
  fog: string;
  /**
   * Backdrop stops, read along a diagonal running out of the top-left corner:
   * `[corner, band, far]`. Only the top-left wedge of the backdrop is ever
   * unoccluded, so these three control the one visible piece of sky.
   */
  backdrop: [string, string, string];
  /** Colour of the screen-blended core bloom. */
  bloom: string;
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
    backdrop: ["#c49ae8", "#3f49cf", "#7b74e6"],
    bloom: "#e8f0ff",
  },
  /** Electric royal blue sibling — same lighting geometry, pure blue hues. */
  blue: {
    surface: "#aac2f3",
    core: "#dcecff",
    key: "#1b3ad6",
    fill: "#2f6bf5",
    bounce: "#23479f",
    sheen: "#9dc0ff",
    fog: "#8ba4ef",
    backdrop: ["#93c2ef", "#2536c4", "#4a6ce6"],
    bloom: "#eaf4ff",
  },
} as const satisfies Record<string, Grade>;

export type GradeName = keyof typeof GRADES;
