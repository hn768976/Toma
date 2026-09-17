// Shared configuration for the "airliner over a wireframe globe" pieces.
//
// Everything here is authored at 1x (1920x1080) and scaled up for the 4K
// compositions through `resolutionScale`, so the 1080p deliverable and the
// 4K master composition are the same shot, not two different tunings.
//
// World units: 1 unit is roughly 1 km at globe scale. The globe radius is
// deliberately large relative to the camera height so the lat/long grid
// reads as a gently curved plane rather than a visible ball.

export const FPS = 30;

// Both reference clips are exactly 16.000s. 16 * 30 = 480 frames.
export const DURATION_IN_FRAMES = 480;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;
export const ASPECT = BASE_WIDTH / BASE_HEIGHT;

// Globe radius. This is the main dial on how curved the graticule looks.
// Too small and the limb of the sphere shows up as a hard horizon, which
// neither reference has; too large and the grid flattens into a plane and
// loses the gentle bow that sells the globe. At R = 6000 with the camera
// ~145 units up, the true horizon sits ~1300 units out — comfortably
// behind the fog cutoff, so the grid dissolves into black instead.
export const GLOBE_RADIUS = 6000;

// The graticule is specified in arc length rather than degrees so that
// changing GLOBE_RADIUS re-curves the shot without also resizing every
// cell. ~36 units per cell is the size both references settle on.
export const GRID_SPACING_UNITS = 36;

// Half-width of the generated graticule patch, in arc length. Has to cover
// the camera's whole ground track plus the view depth; past the fog
// cutoff there is nothing to draw.
export const GRID_HALF_SPAN_UNITS = 1700;

// Arc length per line segment. Curvature only needs enough subdivision to
// keep the far-field bow smooth — near the camera the lines are straight
// anyway, so this is far cheaper than subdividing per cell.
export const GRID_SEGMENT_UNITS = 68;

// Great-circle "flight route" arcs drawn just above the surface.
export const ROUTE_COUNT = 16;
export const ROUTE_SEGMENTS = 96;
export const ROUTE_ALTITUDE = 1.5;
/** Route arcs are drawn this far out so they always cross the frame. */
export const ROUTE_REACH_UNITS = 2600;

// Line widths in CSS px at 1x, before any defocus widening.
export const GRID_LINE_WIDTH_PX = 2.6;
export const ROUTE_LINE_WIDTH_PX = 2.0;

// Relative brightness of the two line sets (1 = full white).
export const GRID_LINE_INTENSITY = 0.82;
export const ROUTE_LINE_INTENSITY = 0.5;

// Exponential distance fog, in 1/units. Tuned so the graticule dissolves
// into black a little before the horizon, as in both references.
export const FOG_DENSITY = 0.0034;

// Defocus strength. `BOKEH_K` multiplies |1/focus - 1/z| to get the
// circle-of-confusion diameter in px at 1x; `MAX_COC_PX` stops the very
// near foreground from smearing across the whole frame.
export const BOKEH_K = 8000;
export const MAX_COC_PX = 28;

// Aircraft wingspan in world units. The model geometry is normalised to a
// wingspan of 1 on load, so this is the only size dial.
export const PLANE_WINGSPAN = 30;

// CRT scanlines: a soft dark line every PITCH px, drifting down the frame.
// The pitch is at 1x and scales with the composition, so 4K shows the same
// apparent line density rather than twice as many.
//
// The profile is a triangular ramp rather than hard bands. Hard edges at a
// 4px pitch beat against the pixel grid as the pattern drifts sub-pixel,
// and they read as harsh banding on the one large bright area in frame —
// the aircraft. A soft ramp is both closer to a real CRT and alias-free.
export const SCANLINE_PITCH_PX = 4;
export const SCANLINE_OPACITY = 0.26;
/** Downward drift of the scanline pattern, px per second at 1x. */
export const SCANLINE_DRIFT_PX_PER_SEC = 2.5;

export const BACKGROUND_COLOR = "#000000";
