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
    // Sampled off the reference: a narrow near-white rim, a cyan sliver, a
    // long saturated azure body (its brightest band measures rgb(18,113,187),
    // markedly bluer than cyan), then violet-indigo outward where the
    // reference's outer band reads rgb(33,19,98) - red above green.
    stops: ramp([
      [0.0, "#eafcff"],
      [0.02, "#9fe8ff"],
      [0.08, "#1696ff"],
      [0.42, "#293cbe"],
      [0.62, "#4326c8"],
      [1.0, "#3c1268"],
    ]),
    undertone: rgb("#c026d3"),
    undertoneStrength: 0.54,
    undertoneAxis: DIAGONAL_AXIS,
    rim: rgb("#dffaff"),
  },
  gold: {
    id: "gold",
    label: "V2 Gold",
    stops: ramp([
      [0.0, "#fff6e2"],
      [0.02, "#ffe4a8"],
      [0.08, "#ffb43c"],
      [0.42, "#e8701e"],
      [0.62, "#c43a18"],
      [1.0, "#6e2410"],
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
      [0.02, "#f6b4ff"],
      [0.08, "#e15cf9"],
      [0.42, "#9b2ae0"],
      [0.62, "#6a1ec8"],
      [1.0, "#2e1470"],
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
