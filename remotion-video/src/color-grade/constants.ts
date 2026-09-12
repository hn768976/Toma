// Timing, geometry and palette for the "Color Grading Dashboard" films.
//
// Everything is authored in a 1920x1080 "base pixel" space. The 4K
// compositions render the exact same tree inside a CSS scale(2), so a
// single set of numbers drives both deliverables and they can never
// drift apart. See <Stage /> for how the scale is applied.

export const FPS = 30;

// The reference clip is 18.96s. 18.96 * 30 = 568.8, so 569 frames is the
// closest whole-frame match at 30fps (18.967s).
export const DURATION_IN_FRAMES = 569;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// The grading app's UI is laid out on one flat "screen plane" that is
// much larger than the 1920x1080 frame. The camera then tilts that plane
// in 3D and frames a slice of it, exactly like a macro lens pointed at a
// corner of a real monitor. Anything outside the frame still has to
// exist, because perspective drags it into shot at the edges.
export const PLANE_WIDTH = 3400;
export const PLANE_HEIGHT = 2050;

// Panel chrome. Desaturated blue-slate, matching a dark editorial NLE.
export const UI = {
  deck: "#080c12", // the bezel / gaps between panels
  panel: "#1a2634", // standard panel fill
  panelHi: "#22313f", // raised rows, headers
  panelLo: "#101922", // sunken wells (scope backgrounds)
  edgeLine: "rgba(126,160,190,0.16)",
  edgeBright: "rgba(150,190,225,0.32)",
  text: "#a9bccd",
  textDim: "#5e7182",
  textBright: "#e4eef6",
  amber: "#cfa055", // scope axis numerals read warm/tan in the reference
  cyan: "#46a8dc", // toolbar iconography
  cyanDim: "#2d6f93",
  orange: "#e8632c",
  chanR: "#ef3b33",
  chanG: "#36cf3f",
  chanB: "#4a9ae8",
  selection: "#f0a03c",
} as const;

// Hue wheel used by every color wheel. The reference reads red at the
// upper-left, magenta at the top, blue to the right and green at the
// bottom — i.e. hue *decreasing* as the conic sweep goes clockwise,
// starting 45 degrees anticlockwise of twelve o'clock.
export const HUE_WHEEL_CSS =
  "conic-gradient(from 0deg," +
  "hsl(0 88% 56%),hsl(330 85% 58%),hsl(300 80% 60%),hsl(270 78% 62%)," +
  "hsl(240 82% 58%),hsl(210 85% 56%),hsl(180 78% 50%),hsl(150 75% 48%)," +
  "hsl(120 72% 48%),hsl(90 74% 50%),hsl(60 88% 56%),hsl(30 90% 56%),hsl(0 88% 56%))";
