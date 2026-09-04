export type Rgb = { r: number; g: number; b: number };

export type Stop = { t: number } & Rgb;

export type Palette = {
  id: string;
  label: string;
  // Colour as a function of normalised radius: t=0 at the pupil edge,
  // t=1 at the outer boundary.
  stops: Stop[];
  // The secondary colour cast that bleeds through the main ramp in patches.
  undertone: Rgb;
  // How strongly the undertone can take over at its strongest.
  undertoneStrength: number;
  // Angle (radians, screen space, y down) of one undertone lobe. The other
  // sits opposite it, so V1's lobes land lower-left / upper-right.
  undertoneAxis: number;
  // Colour of the hottest inner-rim arcs before they blow out to white.
  rim: Rgb;
};

const rgb = (hex: string): Rgb => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

const ramp = (entries: [number, string][]): Stop[] =>
  entries.map(([t, hex]) => ({ t, ...rgb(hex) }));

// Upper-right lobe; the opposite lobe falls at lower-left.
const DIAGONAL_AXIS = -Math.PI / 4;

export const PALETTES: Record<string, Palette> = {
  cyan: {
    id: "cyan",
    label: "V1 Cyan",
    stops: ramp([
      [0.0, "#dffaff"],
      [0.1, "#9ff2ff"],
      [0.3, "#22d3ee"],
      [0.62, "#2547e0"],
      [0.82, "#2436cc"],
      [1.0, "#1b2a9c"],
    ]),
    undertone: rgb("#c026d3"),
    undertoneStrength: 0.72,
    undertoneAxis: DIAGONAL_AXIS,
    rim: rgb("#dffaff"),
  },
  gold: {
    id: "gold",
    label: "V2 Gold",
    stops: ramp([
      [0.0, "#fff6e2"],
      [0.1, "#ffe9b8"],
      [0.3, "#ffd27a"],
      [0.62, "#e8892a"],
      [0.82, "#c25a1c"],
      [1.0, "#8f3712"],
    ]),
    undertone: rgb("#d81f3c"),
    undertoneStrength: 0.82,
    undertoneAxis: DIAGONAL_AXIS + 0.35,
    rim: rgb("#fff4dd"),
  },
  violet: {
    id: "violet",
    label: "V3 Violet",
    stops: ramp([
      [0.0, "#fdeaff"],
      [0.1, "#f6bcff"],
      [0.3, "#e879f9"],
      [0.62, "#8b2fd0"],
      [0.82, "#6520b8"],
      [1.0, "#3d1580"],
    ]),
    undertone: rgb("#22d3ee"),
    undertoneStrength: 0.8,
    undertoneAxis: DIAGONAL_AXIS - 0.3,
    rim: rgb("#fbe8ff"),
  },
};

export const sampleRamp = (stops: Stop[], t: number): Rgb => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (c >= stops[i].t && c <= stops[i + 1].t) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const span = hi.t - lo.t || 1;
  const k = (c - lo.t) / span;
  return {
    r: lo.r + (hi.r - lo.r) * k,
    g: lo.g + (hi.g - lo.g) * k,
    b: lo.b + (hi.b - lo.b) * k,
  };
};
