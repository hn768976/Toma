// One data row per version. To add a colourway: add a row here; Root.tsx
// registers a <Composition> for every row automatically. Composition ids
// may not contain "_", so ids use "-"; delivered files use "_" (README).

export type HorizonColorway = {
  id: string;
  sky: string; // flat sky colour
  skyHorizon: string; // lighter sky right above the horizon
  ground: string; // deep plane colour
  streak: string; // streak colour
  streakHot: string; // dash heads / brightest points
  horizon: string; // horizon line core
};

export const HORIZON_COLORWAYS: HorizonColorway[] = [
  {
    id: "HorizonStreaks",
    sky: "#1A3AC8",
    skyHorizon: "#1E58F4",
    ground: "#06125A",
    streak: "#1F5CFF",
    streakHot: "#66D2FF",
    horizon: "#6CC8FF",
  },
];

export type ServerColorway = {
  id: string;
  light: string; // blue room / backlight
  led: string; // LED + bokeh colour
  ledAlt: string; // secondary (white-ish) LED colour
};

export const SERVER_COLORWAYS: ServerColorway[] = [
  { id: "ServerBokeh-BlueLime", light: "#2A6AD8", led: "#C8E040", ledAlt: "#E8F4FF" },
  { id: "ServerBokeh-BlueAmber", light: "#2A6AD8", led: "#FFB040", ledAlt: "#FFF0DC" },
];

export type GlassColorway = {
  id: string;
  /** Ramp from darkest to brightest. */
  deep: string;
  dark: string;
  mid: string;
  bright: string;
  /** Upper-mid stop between `mid` and `bright`. */
  upper: string;
};

export const GLASS_COLORWAYS: GlassColorway[] = [
  {
    id: "GlassBlock-TealViolet",
    deep: "#000000",
    dark: "#2A0A5A",
    mid: "#3FD8C0",
    bright: "#E8FFB0",
    upper: "#B4FAC0",
  },
  {
    id: "GlassBlock-CoralPink",
    deep: "#12030C",
    dark: "#3A0A2A",
    mid: "#FF6A5A",
    bright: "#FFF0D8",
    upper: "#FF9AC8",
  },
];
