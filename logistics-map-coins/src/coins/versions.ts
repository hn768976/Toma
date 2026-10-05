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
  bloom: number;
};

const base: Omit<CoinVersion, 'id' | 'layout' | 'seed' | 'camera'> = {
  aperture: 0.06,
  maxBlur: 0.022,
  wall: ['#F2F3F4', '#DADDE0'],
  table: ['#F3F4F5', '#D3D6D9'],
  reflectivity: 0.85,
  overlay: null,
  overlayStrength: 1,
  tint: [1, 1, 1],
  saturation: 1,
  exposure: 0.8,
  envIntensity: 1.0,
  envRotation: 0.6,
  key: 3.0,
  metalTint: '#FFFFFF',
  bloom: 0.08,
};

const stairsCam: CoinVersion['camera'] = {
  pos: [2.6, 3.1, 30],
  target: [0.4, 2.6, -2],
  fov: 21,
  dolly: [-0.3, 0.15, -2.0],
  drift: [-0.25, 0.05, -0.6],
  focus: [4.6, 4.0, 3.2],
};

const pileCam: CoinVersion['camera'] = {
  pos: [0.4, 3.2, 40],
  target: [0.2, 2.6, -1],
  fov: 20,
  dolly: [0.2, 0.2, -2.2],
  drift: [0.2, 0.05, -0.6],
  focus: [0.1, 2.4, 1.2],
};

export const COIN_VERSIONS: Record<string, CoinVersion> = {
  StairsWhite: {...base, id: 'CoinGrowth-StairsWhite', layout: 'stairs', seed: 101, camera: stairsCam},
  StairsFinance: {
    ...base,
    id: 'CoinGrowth-StairsFinance',
    layout: 'stairs',
    seed: 101,
    camera: stairsCam,
    wall: ['#8A96A2', '#7D8994'],
    table: ['#C9CED3', '#8E99A3'],
    overlay: 'financeBlue',
    overlayStrength: 0.6,
    saturation: 1.2,
  },
  PileWhite: {...base, id: 'CoinGrowth-PileWhite', layout: 'pile', seed: 202, camera: pileCam, aperture: 0.1},
  PileWarmFinance: {
    ...base,
    id: 'CoinGrowth-PileWarmFinance',
    layout: 'pileMixed',
    seed: 202,
    camera: pileCam,
    aperture: 0.1,
    wall: ['#8E8A88', '#837F7E'],
    table: ['#BDB8B4', '#8D8A88'],
    overlay: 'candlesWarm',
    overlayStrength: 0.6,
    saturation: 1.1,
  },
  SilverStacksChart: {
    ...base,
    id: 'CoinGrowth-SilverStacksChart',
    layout: 'silver',
    seed: 303,
    camera: {
      pos: [0.6, 2.4, 22],
      target: [0.6, 3.2, -1],
      fov: 26,
      dolly: [0.1, 0.25, -1.6],
      drift: [0.15, 0.05, -0.4],
      focus: [-0.6, 4.0, -3.5],
    },
    aperture: 0.05,
    wall: ['#6E8396', '#5F7488'],
    table: ['#8EA3B6', '#6A7F92'],
    overlay: 'barsBlue',
    overlayStrength: 0.7,
    tint: [0.86, 0.94, 1.06],
    saturation: 0.75,
    metalTint: '#CFE0F0',
  },
  CoinRain: {
    ...base,
    id: 'CoinGrowth-CoinRain',
    layout: 'rain',
    seed: 404,
    camera: {
      pos: [0, 2.6, 34],
      target: [0, 2.2, -2],
      fov: 24,
      dolly: [0, 0.1, -1.2],
      drift: [0.2, 0.0, -0.5],
      focus: [0, 1, 2],
    },
    aperture: 0.045,
  },
};
