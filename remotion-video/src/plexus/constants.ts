// Timing, world geometry and palettes for the "plexus tunnel" motion
// graphic: a camera flying forward through a hollow-cored cloud of nodes
// joined by hairline edges, with distance fog and depth-of-field.
//
// Every distance below is in WORLD UNITS, authored at 1x (1080p). The
// renderer multiplies by a resolution scale derived from the composition
// width, so the 1080p and 4K compositions are pixel-for-pixel the same
// framing — only sharper.

export const FPS = 30;

// 18s, matching the reference clip. The loop is seamless: the camera
// travels exactly TUNNEL_DEPTH over these frames and node z-positions
// wrap modulo TUNNEL_DEPTH, so the frame after the last one is frame 0.
export const DURATION_IN_FRAMES = 540;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// --- Node cloud -----------------------------------------------------------

export const NODE_COUNT = 1150;

// Nodes live in a cylindrical shell around the camera's flight path, which
// is what gives the footage its open "tunnel" centre.
export const TUNNEL_INNER_RADIUS = 210;
export const TUNNEL_OUTER_RADIUS = 1250;

// Length of the z-slab that wraps around. Also the distance the camera
// covers in one loop.
export const TUNNEL_DEPTH = 5400;

// Pinhole projection: screen_offset = world_offset * FOCAL_LENGTH / z.
export const FOCAL_LENGTH = 1250;

// Radius of a node at z = FOCAL_LENGTH, in px at 1080p.
export const NODE_RADIUS = 3.1;

// --- Edges ----------------------------------------------------------------

// Two nodes are linked when their 3D distance is under this. Distance is
// measured toroidally in z so the edge set survives the loop wrap.
export const LINK_DISTANCE = 470;

// Without a cap, the dense outer shell turns into a hairball. Capping
// degree keeps the open, triangulated look of the reference.
export const MAX_LINKS_PER_NODE = 5;

export const LINE_WIDTH = 1.05; // px at 1080p

// --- Camera ---------------------------------------------------------------

// Gentle sway, one full cycle per loop so it rejoins seamlessly.
export const CAMERA_SWAY_X = 95;
export const CAMERA_SWAY_Y = 62;

// Per-node breathing. The period must divide DURATION_IN_FRAMES.
export const WIGGLE_PERIOD = 180;
export const WIGGLE_AMPLITUDE = 26;

// --- Depth cues -----------------------------------------------------------

// Nodes nearer than this are behind the camera plane and skipped.
export const NEAR_CLIP = 90;

// Fade band as a node rushes past the lens, so nothing pops out of frame.
export const NEAR_FADE_END = 420;

// Distance fog: full strength at FOG_START, invisible by FOG_END. FOG_END
// sits below TUNNEL_DEPTH so nodes are already gone when they wrap.
export const FOG_START = 2150;
export const FOG_END = 5000;

// Depth of field. Nodes at FOCUS_DISTANCE are crisp; the circle of
// confusion grows either side of it, hard-capped so near nodes stay as
// soft bokeh blobs rather than screen-filling washes.
export const FOCUS_DISTANCE = 1500;
export const DOF_STRENGTH = 26;
export const MAX_BLUR_RADIUS = 46;

// --- Palettes -------------------------------------------------------------

export type Rgb = readonly [number, number, number];

export type PlexusTheme = {
  // Radial background wash: centre colour -> edge colour.
  backgroundCenter: string;
  backgroundEdge: string;
  // Colour the fog dissolves distant geometry into.
  fog: Rgb;
  node: Rgb;
  line: Rgb;
  nodeOpacity: number;
  lineOpacity: number;
  // Additive halo behind each node. 0 disables the pass entirely.
  glowOpacity: number;
  glowRadiusFactor: number;
  // Corner darkening (dark theme) or lifting (light theme).
  vignette: string;
};

// Matches the reference: near-white studio background, graphite nodes,
// silver edges. The fog colour is the background so distance dissolves
// geometry into the paper rather than greying it out.
export const LIGHT_THEME: PlexusTheme = {
  backgroundCenter: "#ffffff",
  backgroundEdge: "#f6f7f9",
  fog: [252, 252, 253],
  node: [44, 46, 54],
  line: [118, 122, 134],
  nodeOpacity: 0.92,
  lineOpacity: 0.5,
  glowOpacity: 0,
  glowRadiusFactor: 0,
  vignette: "rgba(205, 208, 216, 0.16)",
};

// Inverted counterpart: midnight navy ground, ice-blue nodes with a soft
// additive halo, cobalt edges.
export const DARK_THEME: PlexusTheme = {
  backgroundCenter: "#0d1b3d",
  backgroundEdge: "#03060f",
  fog: [5, 9, 22],
  node: [176, 216, 255],
  line: [64, 122, 226],
  nodeOpacity: 0.95,
  lineOpacity: 0.62,
  glowOpacity: 0.48,
  glowRadiusFactor: 4.2,
  vignette: "rgba(1, 2, 7, 0.62)",
};

export const THEMES = { light: LIGHT_THEME, dark: DARK_THEME } as const;

export type ThemeName = keyof typeof THEMES;
