import type {OverlayKind} from './overlays';

// One data row per coin version. To add one, add a row and register it in
// src/Root.tsx (see README "Adding a coin version").

export type CoinLayoutKind = 'stairs' | 'pile' | 'pileMixed' | 'silver' | 'rain';

export type CoinVersion = {
  id: string;
  layout: CoinLayoutKind;
  seed: number;
  camera: {
    pos: [number, number, number];
    target: [number, number, number];
    fov: number;
    dolly: [number, number, number]; // total camera move over 0..330
    drift: [number, number, number]; // extra slow move during the hold (330..450)
    focus: [number, number, number]; // world point kept in focus
  };
  aperture: number;
  maxBlur: number;
  // Set colours (display sRGB hex): wall top/bottom, table near/far.
  wall: [string, string];
  table: [string, string];
  reflectivity: number;
  overlay: OverlayKind | null;
  overlayStrength: number;
  tint: [number, number, number];
  saturation: number;
  exposure: number;
  envIntensity: number;
  envRotation: number; // radians about y
  key: number; // directional key light intensity
  metalTint: string; // multiplies the metal colour (e.g. cool tint for 3E)
  overlayProtect: number; // 0..1: keep saturated pixels (the coins) out of the screen blend
  lift?: string; // display-space milky haze: d + lift * (1 - d)
  bloom: number;
};

const base: Omit<CoinVersion, 'id' | 'layout' | 'seed' | 'camera'> = {
  aperture: 0.06,
  maxBlur: 0.014,
  wall: ['#F2F3F4', '#DADDE0'],
  table: ['#F4F5F5', '#E1E3E4'],
  reflectivity: 0.9,
  overlay: null,
  overlayStrength: 1,
  tint: [1, 1, 1],
  exposure: 0.8,
  envIntensity: 1.0,
  envRotation: 5.3,
  key: 3.0,
  metalTint: '#FFFFFF',
  overlayProtect: 0,
  bloom: 0,
  saturation: 0.86,
};

const stairsCam: CoinVersion['camera'] = {
  pos: [2.6, 4.4, 27],
  target: [0.2, 2.9, -2],
  fov: 22,
  dolly: [-0.3, 0.15, -2.0],
  drift: [-0.25, 0.05, -0.6],
  focus: [4.6, 3.2, 3.2], // nearest / tallest stack (per brief)
};

const pileCam: CoinVersion['camera'] = {
  pos: [0.9, 3.6, 22.5],
  target: [0.9, 2.4, -0.5],
  fov: 21,
  dolly: [0.2, 0.0, -1.6],
  drift: [0.2, 0.05, -0.5],
  focus: [-0.5, 3.0, 0.5],
};

export const COIN_VERSIONS: Record<string, CoinVersion> = {
  StairsWhite: {...base, id: 'CoinGrowth-StairsWhite', layout: 'stairs', seed: 101, camera: stairsCam, aperture: 0.03},
  StairsFinance: {
    ...base,
    id: 'CoinGrowth-StairsFinance',
    layout: 'stairs',
    seed: 101,
    camera: stairsCam,
    aperture: 0.03,
    wall: ['#7C95AA', '#8AA2B5'],
    table: ['#C8D4DE', '#8FA4B6'],
    overlay: 'financeBlue',
    overlayStrength: 1.0,
    overlayProtect: 0.55,
    saturation: 1.1,
  },
  PileWhite: {...base, id: 'CoinGrowth-PileWhite', layout: 'pile', seed: 202, camera: pileCam, aperture: 0.035},
  PileWarmFinance: {
    ...base,
    id: 'CoinGrowth-PileWarmFinance',
    layout: 'pileMixed',
    seed: 202,
    camera: pileCam,
    aperture: 0.045,
    wall: ['#4C4440', '#4A4A50'],
    table: ['#9C928C', '#5A585C'],
    overlay: 'candlesWarm',
    overlayStrength: 0.85,
    overlayProtect: 0.2,
    lift: '#2E2A28',
    saturation: 1.1,
  },
  SilverStacksChart: {
    ...base,
    id: 'CoinGrowth-SilverStacksChart',
    layout: 'silver',
    seed: 303,
    camera: {
      pos: [1.3, 3.2, 14.5],
      target: [1.5, 4.0, -1],
      fov: 30,
      dolly: [0.1, 0.25, -1.6],
      drift: [0.15, 0.05, -0.4],
      focus: [0.6, 4.0, -2.6],
    },
    aperture: 0.03,
    wall: ['#8EA6BC', '#7E97AE'],
    table: ['#B8C8D6', '#8DA3B8'],
    overlay: 'barsBlue',
    overlayStrength: 0.85,
    overlayProtect: 0,
    tint: [0.9, 0.96, 1.04],
    saturation: 0.75,
    metalTint: '#8FA6BE',
    lift: '#3A4A58',
  },
  CoinRain: {
    ...base,
    id: 'CoinGrowth-CoinRain',
    layout: 'rain',
    seed: 404,
    camera: {
      pos: [0, 1.35, 25],
      target: [0, 1.25, -2],
      fov: 22,
      dolly: [0, 0.1, -1.2],
      drift: [0.2, 0.0, -0.5],
      focus: [0, 0.5, -2],
    },
    aperture: 0.014,
    exposure: 0.9,
    envIntensity: 1.3,
  },
};
