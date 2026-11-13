import type { MapStyle } from '../render/pixiMap';

const darkPolys = (dark: string, water: string, runway: string, bg: string) => ({
  sea: water, river: water, park: dark, block: dark, yard: dark, airport: dark, runway, pier: bg,
});

export const TEAL: MapStyle = {
  bg: '#0B171C',
  polys: darkPolys('#050A0C', '#04080A', '#10262A', '#0B171C'),
  classes: {
    highway: { color: '#8AEAEE', halfW: 13, alpha: 1, glow: { color: '#4FC8D0', sigma: 34, alpha: 0.5 } },
    avenue: { color: '#5ACCD0', halfW: 9, alpha: 0.97, glow: { color: '#3FB0B8', sigma: 18, alpha: 0.2 } },
    street: { color: '#3AA8AC', halfW: 5.6, alpha: 0.8 },
    lane: { color: '#3FB0B8', halfW: 4.2, alpha: 0.7 },
    rail: { color: '#3FB0B8', halfW: 3.2, alpha: 0.6 },
  },
  // the travelled main road reads as the brightest, glowing line (as in the reference)
  route: { color: '#C8FAFA', halfW: 12, alpha: 0.95, glow: { color: '#6AE8F0', sigma: 34, alpha: 0.5 } },
  widthZoomExp: 0.5,
  laneFade: [0.16, 0.34],
  streetFade: [0.1, 0.2],
  vignette: 0.16,
  bloom: 0.16,
  soft: 0.2,
};

// Look 2: the same map, a little cooler and dimmer inside the interface frame.
export const TEAL_IFACE: MapStyle = {
  ...TEAL,
  bg: '#18262A',
  polys: darkPolys('#080A0A', '#070909', '#1E3234', '#18262A'),
  classes: {
    highway: { color: '#A8E4E4', halfW: 10, alpha: 0.95, glow: { color: '#6FC4C8', sigma: 26, alpha: 0.3 } },
    avenue: { color: '#86D2D4', halfW: 7.6, alpha: 0.92, glow: { color: '#6FC4C8', sigma: 16, alpha: 0.15 } },
    street: { color: '#6FB0B0', halfW: 4.6, alpha: 0.9, glow: { color: '#6FB0B0', sigma: 11, alpha: 0.1 } },
    lane: { color: '#6FB0B0', halfW: 3.3, alpha: 0.66 },
    rail: { color: '#6FC4C8', halfW: 3, alpha: 0.55 },
  },
  route: { color: '#A8DCDC', halfW: 10, alpha: 0.6, glow: { color: '#80C8CC', sigma: 30, alpha: 0.3 } },
  vignette: 0.0,
  bloom: 0.2,
};

// Looks 3-4: GPS navigation analysis dashboard maps.
const analysis = (street: string, bright: string, bg: string, dark: string): MapStyle => ({
  bg,
  polys: darkPolys(dark, dark, bg, bg),
  classes: {
    highway: { color: bright, halfW: 6.5, alpha: 1, glow: { color: street, sigma: 18, alpha: 0.14 } },
    avenue: { color: street, halfW: 6, alpha: 1, glow: { color: street, sigma: 13, alpha: 0.14 } },
    street: { color: street, halfW: 3.8, alpha: 0.95, glow: { color: street, sigma: 10, alpha: 0.12 } },
    lane: { color: street, halfW: 2.8, alpha: 0.72 },
    rail: { color: street, halfW: 2.6, alpha: 0.6 },
  },
  widthZoomExp: 0.5,
  laneFade: [0.16, 0.34],
  streetFade: [0.06, 0.12],
  vignette: 0.15,
  bloom: 0.3,
  soft: 0.22,
});
export const ANALYSIS_BLUE = analysis('#6CC8F0', '#9ED8F4', '#071016', '#000203');
export const ANALYSIS_AMBER = analysis('#F0A03A', '#F8C680', '#120A04', '#030201');

// Look 5: night map - dim slate-blue streets on dark navy.
export const NIGHT: MapStyle = {
  bg: '#15212C',
  polys: darkPolys('#0D1620', '#0C141E', '#1A2632', '#15212C'),
  classes: {
    highway: { color: '#86A2BA', halfW: 5, alpha: 0.9, glow: { color: '#6A88A4', sigma: 18, alpha: 0.22 } },
    avenue: { color: '#7792AC', halfW: 3.6, alpha: 0.92, glow: { color: '#6A88A4', sigma: 10, alpha: 0.12 } },
    street: { color: '#6F8EA6', halfW: 2.8, alpha: 0.78, glow: { color: '#5A7A98', sigma: 8, alpha: 0.12 } },
    lane: { color: '#5A7A98', halfW: 2.3, alpha: 0.65 },
    rail: { color: '#5A7A98', halfW: 1.8, alpha: 0.5 },
  },
  widthZoomExp: 0.5,
  laneFade: [0.14, 0.3],
  streetFade: [0.05, 0.1],
  vignette: 0.75,
  vignetteColor: '#04080E',
  bloom: 0.25,
  soft: 0.3,
};

// Looks 8-9: dim grey background city for the target locator.
export const GREY: MapStyle = {
  bg: '#141517',
  polys: darkPolys('#0D0E0F', '#111214', '#1A1C1E', '#141517'),
  classes: {
    highway: { color: '#50555C', halfW: 5.5, alpha: 1 },
    avenue: { color: '#454A50', halfW: 3.9, alpha: 1 },
    street: { color: '#33373C', halfW: 2.6, alpha: 1 },
    lane: { color: '#3A3E44', halfW: 2, alpha: 0.75 },
    rail: { color: '#3A3E44', halfW: 1.7, alpha: 0.7 },
  },
  widthZoomExp: 0.5,
  laneFade: [0.14, 0.3],
  streetFade: [0.05, 0.1],
  vignette: 0.45,
  vignetteColor: '#101112',
  bloom: 0.15,
  soft: 0.3,
};
