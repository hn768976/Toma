import type { MapStyle } from '../render/pixiMap';

const darkPolys = (dark: string, water: string, runway: string, bg: string) => ({
  sea: water, river: water, park: dark, block: dark, yard: dark, airport: dark, runway, pier: bg,
});

export const TEAL: MapStyle = {
  bg: '#0A1418',
  polys: darkPolys('#050A0C', '#04080A', '#10262A', '#0A1418'),
  classes: {
    highway: { color: '#8AF0F0', halfW: 10.5, alpha: 1, glow: { color: '#5AE0E0', sigma: 30, alpha: 0.42 } },
    avenue: { color: '#7AE6E6', halfW: 7.5, alpha: 0.95, glow: { color: '#5AC8C8', sigma: 18, alpha: 0.18 } },
    street: { color: '#5AC8C8', halfW: 5.4, alpha: 0.9 },
    lane: { color: '#5AC8C8', halfW: 3.6, alpha: 0.65 },
    rail: { color: '#5AC8C8', halfW: 2.8, alpha: 0.55 },
  },
  widthZoomExp: 0.5,
  laneFade: [0.16, 0.34],
  streetFade: [0.1, 0.2],
  vignette: 0.55,
};

// Look 2: the same map, a little cooler and dimmer inside the interface frame.
export const TEAL_IFACE: MapStyle = {
  ...TEAL,
  bg: '#0C1416',
  classes: {
    highway: { color: '#9AE6E6', halfW: 9.5, alpha: 0.95, glow: { color: '#6AD0D0', sigma: 26, alpha: 0.3 } },
    avenue: { color: '#8AD8D8', halfW: 6.8, alpha: 0.9, glow: { color: '#5AB8B8', sigma: 15, alpha: 0.12 } },
    street: { color: '#70BCBC', halfW: 4.8, alpha: 0.82 },
    lane: { color: '#70BCBC', halfW: 3.2, alpha: 0.6 },
    rail: { color: '#70BCBC', halfW: 2.5, alpha: 0.5 },
  },
  vignette: 0.35,
};

// Looks 3-4: GPS navigation analysis dashboard maps.
const analysis = (street: string, bright: string, bg: string, dark: string): MapStyle => ({
  bg,
  polys: darkPolys(dark, dark, bg, bg),
  classes: {
    highway: { color: bright, halfW: 7.5, alpha: 1, glow: { color: street, sigma: 22, alpha: 0.35 } },
    avenue: { color: bright, halfW: 5, alpha: 0.92, glow: { color: street, sigma: 13, alpha: 0.12 } },
    street: { color: street, halfW: 3.6, alpha: 0.9 },
    lane: { color: street, halfW: 2.5, alpha: 0.65 },
    rail: { color: street, halfW: 2, alpha: 0.55 },
  },
  widthZoomExp: 0.5,
  laneFade: [0.16, 0.34],
  streetFade: [0.06, 0.12],
  vignette: 0.3,
});
export const ANALYSIS_BLUE = analysis('#4AB8F0', '#BFE6FF', '#0A1218', '#03070A');
export const ANALYSIS_AMBER = analysis('#F0A03A', '#FFE0B0', '#140C06', '#070402');

// Look 5: night map - dim slate-blue streets on dark navy.
export const NIGHT: MapStyle = {
  bg: '#0B1520',
  polys: darkPolys('#050A12', '#04080E', '#0F1C28', '#0B1520'),
  classes: {
    highway: { color: '#8FAAC4', halfW: 5.5, alpha: 0.95, glow: { color: '#5A7A98', sigma: 16, alpha: 0.18 } },
    avenue: { color: '#7A96B2', halfW: 3.8, alpha: 0.9 },
    street: { color: '#5A7A98', halfW: 2.7, alpha: 0.85 },
    lane: { color: '#5A7A98', halfW: 1.9, alpha: 0.6 },
    rail: { color: '#5A7A98', halfW: 1.6, alpha: 0.5 },
  },
  widthZoomExp: 0.5,
  laneFade: [0.18, 0.36],
  streetFade: [0.06, 0.12],
  vignette: 0.92,
  vignetteColor: '#04080E',
};

// Looks 8-9: dim grey background city for the target locator.
export const GREY: MapStyle = {
  bg: '#16181A',
  polys: darkPolys('#0E0F10', '#0C0D0E', '#1C1F22', '#16181A'),
  classes: {
    highway: { color: '#565B62', halfW: 5.5, alpha: 1 },
    avenue: { color: '#4A4F56', halfW: 3.9, alpha: 1 },
    street: { color: '#3A3E44', halfW: 2.8, alpha: 1 },
    lane: { color: '#3A3E44', halfW: 2, alpha: 0.75 },
    rail: { color: '#3A3E44', halfW: 1.7, alpha: 0.7 },
  },
  widthZoomExp: 0.5,
  laneFade: [0.18, 0.36],
  streetFade: [0.06, 0.12],
  vignette: 0.5,
  vignetteColor: '#0A0B0C',
};
