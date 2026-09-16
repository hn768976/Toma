export type PaletteName = "blue" | "mono";

type Stop = { t: number; r: number; g: number; b: number };

export type Palette = {
  /** Intensity ramp, dimmest -> brightest, used to colour each particle. */
  stops: Stop[];
  /** Flat backdrop colour behind everything. */
  background: string;
  /** CSS gradient painted over the backdrop: the soft key-light bloom. */
  backdropGradient: string;
  /** Corner darkening painted over the particles. */
  vignette: string;
};

const PALETTES: Record<PaletteName, Palette> = {
  // Reference look: deep navy field, electric blue body, cyan-white crests.
  blue: {
    stops: [
      { t: 0, r: 10, g: 24, b: 92 },
      { t: 0.34, r: 18, g: 62, b: 208 },
      { t: 0.66, r: 36, g: 126, b: 255 },
      { t: 0.86, r: 96, g: 206, b: 255 },
      { t: 1, r: 205, g: 244, b: 255 },
    ],
    background: "#02050f",
    backdropGradient:
      "radial-gradient(64% 52% at 52% -4%, rgba(38, 92, 224, 0.55) 0%, rgba(14, 38, 122, 0.28) 38%, rgba(2, 5, 15, 0) 72%)",
    vignette:
      "radial-gradient(ellipse 78% 70% at 50% 46%, rgba(0,0,0,0) 40%, rgba(0, 1, 6, 0.62) 100%)",
  },
  // Monochrome grade of exactly the same animation: neutral greys, no hue.
  mono: {
    stops: [
      { t: 0, r: 42, g: 42, b: 42 },
      { t: 0.32, r: 104, g: 104, b: 104 },
      { t: 0.62, r: 142, g: 142, b: 142 },
      { t: 0.84, r: 208, g: 208, b: 208 },
      { t: 1, r: 255, g: 255, b: 255 },
    ],
    background: "#000000",
    backdropGradient:
      "radial-gradient(64% 52% at 52% -4%, rgba(128, 128, 128, 0.34) 0%, rgba(58, 58, 58, 0.18) 38%, rgba(0, 0, 0, 0) 72%)",
    vignette:
      "radial-gradient(ellipse 78% 70% at 50% 46%, rgba(0,0,0,0) 40%, rgba(0, 0, 0, 0.66) 100%)",
  },
};

export const getPalette = (name: PaletteName): Palette => PALETTES[name];

const sampleStops = (stops: Stop[], t: number) => {
  const clamped = Math.max(0, Math.min(1, t));
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i].t && clamped <= stops[i + 1].t) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }
  const span = upper.t - lower.t || 1;
  const k = (clamped - lower.t) / span;
  return {
    r: Math.round(lower.r + (upper.r - lower.r) * k),
    g: Math.round(lower.g + (upper.g - lower.g) * k),
    b: Math.round(lower.b + (upper.b - lower.b) * k),
  };
};

export const INTENSITY_STEPS = 64;
export const ALPHA_STEPS = 24;

// Setting fillStyle + globalAlpha for 34k particles a frame is the hot loop's
// biggest cost. Instead we precompute every (intensity, alpha) pair we can
// produce as a ready-made rgba() string, so the loop touches only fillStyle
// and never reads back canvas state.
export const buildColorTable = (name: PaletteName): string[] => {
  const { stops } = getPalette(name);
  const table: string[] = new Array(INTENSITY_STEPS * ALPHA_STEPS);
  for (let i = 0; i < INTENSITY_STEPS; i++) {
    const { r, g, b } = sampleStops(stops, i / (INTENSITY_STEPS - 1));
    for (let j = 0; j < ALPHA_STEPS; j++) {
      const a = (j + 1) / ALPHA_STEPS;
      table[i * ALPHA_STEPS + j] = `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
    }
  }
  return table;
};
