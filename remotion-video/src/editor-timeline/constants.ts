// Shared timing, palette and screen-geometry constants for the
// "video editing timeline on a monitor" macro shot.
//
// Everything here is authored in two independent coordinate systems:
//
//   * UI space   - the flat editor interface, in virtual screen pixels.
//                  Resolution-independent: the 1080p and 4K compositions
//                  render the exact same UI-space layout and only differ
//                  by the scale factor applied to the 3D stage.
//   * frame space - the output video, 1920x1080 at 1x.
//
// Keeping them separate is what lets the 4K composition be a true 2x of
// the 1080p one (pure CSS scale of vector/DOM content, no resampling)
// rather than a re-layout.

export const FPS = 30;

// The reference clip is 52.16s. 52.16 * 30 = 1564.8, so 1565 frames is
// the closest whole-frame match at 30fps (52.1667s).
export const DURATION_IN_FRAMES = 1565;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// --- UI space -------------------------------------------------------
// The virtual editor screen. Much wider/taller than the visible frame:
// the camera only ever sees a macro crop of it, which is exactly what
// gives the shot its "leaning in close to someone's monitor" feel.
export const UI_WIDTH = 6400;
export const UI_HEIGHT = 1900;

// How far the surrounding application chrome is drawn past the timeline
// panel on every side. The lens sees only a macro crop, but a strongly
// yawed plane pulls distant geometry back into frame fast, so without
// this overscan the panel's own edge shows up as a hard line against
// the background - the single most obvious "this is a CSS plane" tell.
export const OVERSCAN = 2200;

// Seconds of edit the panel holds; UI_WIDTH must cover it.
export const SPAN_SECONDS = 104;

// Horizontal zoom of the edit: UI pixels per second of edited footage.
export const PX_PER_SECOND = 58;

// Left column of per-track controls (mute/solo/lock buttons). It sits
// nearest the lens and is almost entirely out of focus, so it mostly
// reads as a column of bokeh discs.
export const HEADER_WIDTH = 236;

// Where the edit area starts in UI space.
export const TRACK_X0 = HEADER_WIDTH + 24;

// --- palette ---------------------------------------------------------
// Sampled from the reference: a near-black IDE-grey chrome with clips in
// one saturated cyan family, one violet accent, and warm orange/yellow
// badge dots that survive being thrown far out of focus.
export const PALETTE = {
  screenBase: "#03060a",
  panel: "#0b0f15",
  panelAlt: "#0e131a",
  trackBed: "#05080d",
  trackBedAlt: "#070a10",
  gridLine: "rgba(120, 150, 175, 0.09)",

  clipCyan: "#25c9de",
  clipCyanTop: "#7ef0fb",
  clipCyanDeep: "#12a3b8",
  clipTeal: "#1f8fa3",
  clipViolet: "#8d7cb4",
  clipVioletTop: "#b3a7d2",

  audioBed: "#217e91",
  audioBedTop: "#3aa7bc",
  waveform: "#5fe6f5",
  waveformHot: "#f2fdff",

  playhead: "#8fd8ff",
  playheadCore: "#d8f2ff",
  rubberBand: "#e8c23a",
  selection: "#ffffff",
  trimHot: "#ff5a48",

  badgeRed: "#e0503f",
  badgeAmber: "#f0a93c",
  badgeBlue: "#4e8ff0",
  label: "rgba(236, 249, 255, 0.86)",
  labelDim: "rgba(200, 224, 238, 0.5)",
  ruler: "rgba(176, 203, 219, 0.55)",
} as const;

// --- lens ------------------------------------------------------------
// Depth-of-field is faked with a stack of copies of the stage, each
// blurred by a different amount and masked to a band running along the
// screen's receding axis. CSS filters are applied before masking, so a
// layer is blurred whole and then only its band is kept; the bands
// overlap so neighbouring blur levels cross-fade instead of banding.
//
// `from`/`to` are fractions of frame width. `fade` is how much of the
// band is spent ramping in/out at each end.
export type DofLayer = {
  blur: number; // px at 1x
  from: number;
  to: number;
  fadeIn: number;
  fadeOut: number;
};

export const VIGNETTE = "rgba(1, 2, 5, 0.62)";
