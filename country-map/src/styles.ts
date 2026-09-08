// The two style versions. Colour is not the version axis beyond these two —
// the country is — so everything here is deliberately fixed, and a new country
// renders in both without touching this file.

export type MapStyle = {
  water: string;
  // Shadow / base / highlight for the relief ramp. The baked plate is neutral
  // at 128, so the middle entry is the colour flat ground reads as.
  landRamp: readonly [string, string, string];
  shore: string;
  shoreStrength: number;
  border: string;
  neighbourLabel: string;
  seaLabel: string;
  subjectFill: string;
  subjectEdge: string;
  subjectRamp: readonly [string, string, string];
  subjectReliefOpacity: number;
  subjectShadow: string;
  markerFill: string;
  markerRing: string;
  label: string;
  labelHalo: string;
  ping: string;
  grain: number;
  vignette: number;
};

export const STYLES = {
  light: {
    water: '#4a6a80',
    landRamp: ['#c8c8c6', '#e8e8e6', '#f4f4f2'],
    shore: '#8b9ba7',
    shoreStrength: 0.85,
    border: '#b0b0ae',
    neighbourLabel: '#8a8a88',
    seaLabel: '#8ba3b4',
    subjectFill: '#d93a2b',
    subjectEdge: '#a82a1e',
    subjectRamp: ['#ae2c1e', '#d93a2b', '#e8664f'],
    subjectReliefOpacity: 0.5,
    subjectShadow: 'rgba(40, 22, 18, 0.42)',
    markerFill: '#ffffff',
    markerRing: 'rgba(26, 28, 30, 0.8)',
    label: '#ffffff',
    labelHalo: 'rgba(20, 14, 12, 0.55)',
    ping: 'rgba(255, 255, 255, 0.9)',
    grain: 0.01,
    vignette: 0,
  },
  dark: {
    water: '#0a1420',
    landRamp: ['#0e1114', '#14171a', '#2a3138'],
    shore: '#33414c',
    shoreStrength: 0.9,
    border: '#3a4149',
    neighbourLabel: '#6a727a',
    seaLabel: '#33505f',
    subjectFill: '#d93a2b',
    subjectEdge: '#a82a1e',
    subjectRamp: ['#a82a1e', '#d93a2b', '#e8664f'],
    subjectReliefOpacity: 0.55,
    subjectShadow: 'rgba(0, 0, 0, 0.6)',
    markerFill: '#ffffff',
    markerRing: 'rgba(10, 14, 20, 0.85)',
    label: '#ffffff',
    labelHalo: 'rgba(0, 0, 0, 0.6)',
    ping: 'rgba(255, 255, 255, 0.85)',
    grain: 0.02,
    vignette: 0.38,
  },
} as const satisfies Record<string, MapStyle>;

export type StyleName = keyof typeof STYLES;

const channel = (hex: string, index: number) =>
  parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;

// feComponentTransfer table values for one channel of a three-stop ramp.
export const rampTable = (
  ramp: readonly [string, string, string],
  index: number,
) => ramp.map((c) => channel(c, index).toFixed(4)).join(' ');
