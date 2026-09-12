// Timing, camera, layout and palette config for the 3D "market trends"
// data-visualisation loop. Geometry is defined once at 1x (1920x1080
// logical units); the canvas is scaled by resolutionScale so the 1080p
// and 4K compositions are pixel-for-pixel the same design.

export const FPS = 30;

// 12 s seamless loop. The data plane travels LOOP_SCROLL world units per
// loop and every data series repeats with that exact period, and every
// time-based motion period below divides DURATION_IN_FRAMES, so the last
// frame flows straight back into frame 0.
export const DURATION_IN_FRAMES = 360;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// World units scrolled per loop == data period. 1 world unit ~= 1 px at
// the depth of the main plane's centre.
export const LOOP_SCROLL = 3000;

// Camera. Positioned in front of and slightly above the scene, pitched
// down a touch so the horizon (vanishing height) sits above the content
// and the receding grid lines climb toward the upper right like the
// reference footage.
export const FOCAL_LENGTH = 1700;
export const NEAR_PLANE = 60;
export const CAMERA_BASE = { x: 80, y: 130, z: 1780, yaw: 0, pitch: -0.05 };
// Slow drift, one full cycle per loop (so it is seamless).
export const CAMERA_DRIFT = { x: 70, y: 32, z: 60, yaw: 0.022, pitch: 0.012 };

// The data planes are all parallel, rotated about the vertical axis so
// the left edge is nearest the camera and the right edge recedes.
export const PLANE_YAW = -0.60; // radians (~ -34 deg)

// Signed offsets along the plane normal. Positive = nearer the camera.
export const LAYER_DEPTH = {
  far: -760,
  farDonut: -640,
  mid: -300,
  grid: -90,
  main: 0,
  curves: 45,
  fore: 560,
};

// Visible u-range (along the plane) that we bother iterating over, per
// plane. Generous: anything projected off-screen is skipped cheaply.
export const U_RANGE = { min: -1900, max: 3800 };

// Motion periods in frames; each divides DURATION_IN_FRAMES.
export const BAR_BREATHE_PERIOD = 90;
export const NODE_PULSE_PERIOD = 120;
export const CURVE_DRIFT_PERIOD = 360;

// Depth-of-field: CSS blur radius (1x px) applied to each canvas layer.
export const LAYER_BLUR = { far: 7, mid: 1.6, main: 0, fore: 18 };

export type Theme = {
  id: "dark" | "light";
  background: string;
  vignette: string;
  grid: string;
  node: string;
  nodeLink: string;
  green: string;
  greenEdge: string;
  cyan: string;
  cyanSoft: string;
  purple: string;
  lime: string;
  curvePrimary: string;
  curveAccent: string;
  label: string;
  labelSoft: string;
  valueTag: string;
  tickerUp: string;
  tickerDown: string;
  tickerNeutral: string;
  donut: string;
  donutFill: string;
  hbar: string;
  bokeh: string;
  farOpacity: number;
  midOpacity: number;
  foreOpacity: number;
};

export const DARK_THEME: Theme = {
  id: "dark",
  background:
    "radial-gradient(ellipse 95% 85% at 38% 48%, #0d2e40 0%, #082033 38%, #05121f 70%, #03090f 100%)",
  vignette:
    "radial-gradient(ellipse at center, rgba(0,0,0,0) 48%, rgba(1,6,12,0.62) 100%)",
  grid: "rgba(215, 232, 245, 0.30)",
  node: "rgba(236, 246, 255, 0.85)",
  nodeLink: "rgba(215, 232, 245, 0.22)",
  green: "#4dff2e",
  greenEdge: "#2fd11a",
  cyan: "#3fd9ff",
  cyanSoft: "rgba(63, 217, 255, 0.55)",
  purple: "#b551ff",
  lime: "#d2ff3d",
  curvePrimary: "#f4f8ff",
  curveAccent: "#ff2f4f",
  label: "#ffffff",
  labelSoft: "rgba(255,255,255,0.72)",
  valueTag: "#8ff0ff",
  tickerUp: "#3b7bff",
  tickerDown: "#ff2d55",
  tickerNeutral: "#c8d8ea",
  donut: "#35c6ec",
  donutFill: "rgba(53, 198, 236, 0.35)",
  hbar: "#2fb8ff",
  bokeh: "rgba(120, 220, 255, 0.55)",
  farOpacity: 0.85,
  midOpacity: 0.95,
  foreOpacity: 0.55,
};

export const LIGHT_THEME: Theme = {
  id: "light",
  background:
    "radial-gradient(ellipse 95% 85% at 38% 48%, #ffffff 0%, #f1f5fa 40%, #e3eaf2 72%, #d3dde8 100%)",
  vignette:
    "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(30,45,70,0.18) 100%)",
  grid: "rgba(30, 50, 80, 0.30)",
  node: "rgba(25, 42, 70, 0.80)",
  nodeLink: "rgba(30, 50, 80, 0.22)",
  green: "#16c24a",
  greenEdge: "#0f9a3a",
  cyan: "#0aa6d6",
  cyanSoft: "rgba(10, 166, 214, 0.55)",
  purple: "#8a3cf0",
  lime: "#8fbf00",
  curvePrimary: "#1b2a44",
  curveAccent: "#e5173f",
  label: "#172338",
  labelSoft: "rgba(23, 35, 56, 0.70)",
  valueTag: "#0a7fa6",
  tickerUp: "#2f6ff5",
  tickerDown: "#ee2f55",
  tickerNeutral: "#4d5f78",
  donut: "#1aa9d8",
  donutFill: "rgba(26, 169, 216, 0.30)",
  hbar: "#1e9fe0",
  bokeh: "rgba(30, 150, 210, 0.40)",
  farOpacity: 0.6,
  midOpacity: 0.95,
  foreOpacity: 0.45,
};

export const THEMES: Record<Theme["id"], Theme> = {
  dark: DARK_THEME,
  light: LIGHT_THEME,
};

export const FONT_FAMILY = `"Inter", "Liberation Sans", "DejaVu Sans", sans-serif`;
