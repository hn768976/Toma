// Colour schemes for the North America data-map.
//
// Two variants ship: "signal" reproduces the reference (blue landmass, amber
// city hotspots) and "cyan" is the dark cyan grade — a teal landmass lit by
// deep-blue hotspots, so the two-tone contrast survives without any warmth.

export type Theme = {
  id: string;
  label: string;
  /** Background radial: hot centre -> deep edge -> outer void. */
  bgInner: string;
  bgMid: string;
  bgOuter: string;
  /** Atmospheric haze sitting over the far half of the plane. */
  haze: string;
  vignette: string;
  /** Lat/long graticule. */
  graticule: string;
  graticuleBright: string;
  /** Land dot-matrix, dimmest bucket -> brightest bucket. */
  dotLow: [number, number, number];
  dotHigh: [number, number, number];
  /** Coastlines: a wide soft pass under a tight core pass. */
  coastGlow: string;
  coastCore: string;
  /** Internal (state) boundaries. */
  border: string;
  /** Route arcs and the pulses travelling along them. */
  arc: string;
  arcPulse: string;
  /** City hotspots. */
  cityGlow: [number, number, number];
  cityCore: string;
  cityBeam: [number, number, number];
  /** Expanding ping rings. */
  ping: [number, number, number];
};

export const SIGNAL_THEME: Theme = {
  id: "signal",
  label: "Signal Blue",
  bgInner: "#071233",
  bgMid: "#030716",
  bgOuter: "#000105",
  haze: "#08132e",
  vignette: "#000208",
  graticule: "rgba(62, 116, 224, 0.30)",
  graticuleBright: "rgba(96, 158, 255, 0.46)",
  dotLow: [26, 58, 126],
  dotHigh: [126, 178, 246],
  coastGlow: "rgba(40, 118, 246, 0.36)",
  coastCore: "rgba(98, 160, 248, 0.74)",
  border: "rgba(56, 112, 214, 0.30)",
  arc: "rgba(190, 212, 255, 0.36)",
  arcPulse: "rgba(255, 226, 182, 0.38)",
  cityGlow: [255, 122, 24],
  cityCore: "#fff5e2",
  cityBeam: [255, 158, 64],
  ping: [255, 150, 60],
};

export const CYAN_THEME: Theme = {
  id: "cyan",
  label: "Deep Cyan",
  bgInner: "#041d28",
  bgMid: "#020f15",
  bgOuter: "#000305",
  haze: "#041a22",
  vignette: "#000305",
  graticule: "rgba(34, 148, 170, 0.30)",
  graticuleBright: "rgba(60, 206, 230, 0.46)",
  dotLow: [12, 74, 84],
  dotHigh: [104, 214, 228],
  coastGlow: "rgba(22, 180, 204, 0.36)",
  coastCore: "rgba(76, 206, 228, 0.74)",
  border: "rgba(26, 136, 156, 0.30)",
  arc: "rgba(170, 200, 255, 0.36)",
  arcPulse: "rgba(204, 224, 255, 0.38)",
  cityGlow: [52, 108, 255],
  cityCore: "#d3e2ff",
  cityBeam: [84, 136, 255],
  ping: [74, 128, 255],
};

export const THEMES: Record<string, Theme> = {
  signal: SIGNAL_THEME,
  cyan: CYAN_THEME,
};

export const rgba = (c: [number, number, number], a: number) =>
  `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

export const mixRgb = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
