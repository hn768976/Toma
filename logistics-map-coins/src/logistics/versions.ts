import type {Hotspot, MapLook} from './mapMaterial';
import type {IconKind} from './icons';

// One data row per version. To add a framing, add a row here and register it
// in src/Root.tsx (see README "Adding a map framing").

export type PinDef = {
  lon: number;
  lat: number;
  kind: 'pin' | 'pinMinor' | 'pinChart';
  code?: string; // invented label code
  sub?: string; // small second line (made-up figures)
  labelDx?: number; // label offset in degrees
  labelDy?: number;
};

export type ArcDef = {
  from: number; // pin index
  to: number;
  height?: number; // relative to span
  period: number; // pulse period in frames (must divide 600)
  offset: number;
  // Draw-on / fade cycle: [start frame, period]. Omit for always-on arcs.
  draw?: [number, number];
};

export type CounterDef = {lon: number; lat: number; prefix: string; seed: number; digits: number; step: number};

export type RouteDef = {
  // polyline in lon/lat; icons travel along it
  path: [number, number][];
  icon: IconKind;
  count: number;
  laps: number; // traversals per 600 frames (integer for a clean loop)
  offset: number;
  altitude?: number; // world units above ground (planes)
  color?: 'accent' | 'white';
};

export type StaticIconDef = {lon: number; lat: number; icon: IconKind; color?: 'accent' | 'white'};

export type MapCamera = {
  target: [number, number]; // lon, lat
  dist: number;
  tilt: number; // degrees from straight down
  yaw: number; // degrees, rotation about the vertical
  fov: number;
  push: number; // fraction of dist the camera pushes in at mid-loop
  side: number; // world units of sideways drift (sin over the loop)
  yawDrift: number; // degrees
  roll: number; // degrees
};

export type MapVersion = {
  id: string;
  accent: string;
  accentGain: number;
  camera: MapCamera;
  look: MapLook;
  hotspots: Hotspot[];
  pins: PinDef[];
  arcs: ArcDef[];
  counters: CounterDef[];
  hudBox: [number, number, number, number]; // lon0, lon1, lat0, lat1 covered by the HUD layer
  freeLabels: {lon: number; lat: number; text: string; size?: number; alpha?: number}[];
  routes: RouteDef[];
  staticIcons: StaticIconDef[];
  pinSize: number; // world units (scaled by camera distance)
  arcRadius: number;
  iconSize: number;
  hudSize: number; // label cap height in degrees
  post: {aperture: number; maxBlur: number; bloomStrength: number; bloomThreshold: number; vignette: number; topLight: number; exposure: number};
};

const baseLook: MapLook = {
  dotPitch: 0.75,
  dotSize: 0.36,
  landLit: '#2A6A70',
  landShadow: '#0A1E22',
  ocean: '#071216',
  coast: ['#3FA6AE', 0.55],
  city: ['#FF8A2A', 3.2],
  cityStrength: 1,
  grid: ['#1C4A52', 0.22],
  gridStep: 15,
  reliefHeight: 0.05,
  reliefBase: 0.5,
  reliefContrast: 2.6,
};

export const WORLD: MapVersion = {
  id: 'LogisticsMap-World',
  accent: '#FF8A2A',
  accentGain: 2.4,
  camera: {target: [8, 4], dist: 40, tilt: 16, yaw: 0, fov: 30, push: 0.06, side: 0.6, yawDrift: 0.8, roll: 0},
  look: {...baseLook},
  hotspots: [
    {lon: -95, lat: 38, radius: 14, intensity: 0.55, color: '#FF8A2A'},
    {lon: 8, lat: 48, radius: 9, intensity: 0.5, color: '#FF8A2A'},
    {lon: -48, lat: -20, radius: 7, intensity: 0.4, color: '#FF8A2A'},
    {lon: 112, lat: 0, radius: 9, intensity: 0.45, color: '#FF8A2A'},
  ],
  pins: [
    {lon: -122, lat: 57, kind: 'pin', code: 'HUB-01', sub: 'NODE 14', labelDx: 4, labelDy: 5},
    {lon: -66, lat: -8, kind: 'pin', code: 'HUB-02', sub: 'EXT [ 681297 ]', labelDx: -32, labelDy: 1},
    {lon: -1, lat: 51, kind: 'pin', code: 'HUB-03', labelDx: 3, labelDy: 6},
    {lon: 57, lat: 60, kind: 'pin', code: 'HUB-04', labelDx: -10, labelDy: 8},
    {lon: 112, lat: 64, kind: 'pin', code: 'HUB-05', labelDx: 5, labelDy: 6},
    {lon: 134, lat: -26, kind: 'pin', code: 'HUB-06', labelDx: -28, labelDy: 4},
    {lon: 14, lat: 22, kind: 'pin', code: 'PORT-03', labelDx: 4, labelDy: -6},
    {lon: -150, lat: 64, kind: 'pinMinor'},
    {lon: -168, lat: -10, kind: 'pinMinor'},
    {lon: -40, lat: 68, kind: 'pinMinor'},
    {lon: 70, lat: 10, kind: 'pinMinor'},
    {lon: 40, lat: -8, kind: 'pinMinor'},
    {lon: 95, lat: 50, kind: 'pinMinor'},
    {lon: 150, lat: 48, kind: 'pinMinor'},
    {lon: 162, lat: -40, kind: 'pinMinor'},
    {lon: 22, lat: -50, kind: 'pinMinor'},
    {lon: -95, lat: 18, kind: 'pinMinor'},
    {lon: 25, lat: 72, kind: 'pinMinor'},
  ],
  arcs: [
    {from: 0, to: 2, period: 150, offset: 0},
    {from: 2, to: 4, period: 120, offset: 40},
    {from: 4, to: 5, period: 150, offset: 75, height: 0.25},
    {from: 1, to: 2, period: 100, offset: 20, draw: [0, 300]},
    {from: 2, to: 6, period: 120, offset: 90, height: 0.4},
    {from: 3, to: 5, period: 200, offset: 10, draw: [150, 300]},
    {from: 0, to: 1, period: 150, offset: 60, height: 0.22, draw: [90, 300]},
  ],
  counters: [
    {lon: -150, lat: 20, prefix: '[', seed: 1, digits: 2, step: 6},
    {lon: -82, lat: 8, prefix: 'EXT [', seed: 2, digits: 6, step: 3},
    {lon: 30, lat: -4, prefix: '#01 /// ', seed: 3, digits: 6, step: 4},
    {lon: 120, lat: 22, prefix: '', seed: 4, digits: 3, step: 5},
    {lon: 80, lat: -32, prefix: 'EXT [', seed: 5, digits: 6, step: 3},
  ],
  hudBox: [-200, 200, -80, 92],
  freeLabels: [
    {lon: -150, lat: 66, text: 'ROUTE A-7 · INDEX [ 4 820 KM ]'},
    {lon: -60, lat: 32, text: 'ROUTE C-2', alpha: 0.5},
    {lon: -120, lat: -30, text: 'GRID 06/12', alpha: 0.5},
    {lon: -75, lat: -48, text: 'MATH [ 6418674 ] x_5984', size: 1.15},
    {lon: 38, lat: 50, text: 'ZONE B-11 · 2 310 KM', alpha: 0.6},
    {lon: 120, lat: 68, text: 'TRANSIT LINE 09 [ km ]', alpha: 0.8},
    {lon: 120, lat: 20, text: '588/365', alpha: 0.8},
    {lon: -10, lat: -36, text: 'CORE 2/4', alpha: 0.5},
  ],
  routes: [],
  staticIcons: [],
  pinSize: 1.15,
  arcRadius: 0.024,
  iconSize: 1,
  hudSize: 2.5,
  post: {aperture: 0.06, maxBlur: 0.006, bloomStrength: 0.6, bloomThreshold: 0.35, vignette: 0.55, topLight: 0.35, exposure: 1},
};

export const ASIA: MapVersion = {
  id: 'LogisticsMap-Asia',
  accent: '#5FE8FF',
  accentGain: 1.6,
  camera: {target: [70, 26], dist: 18, tilt: 36, yaw: 20, fov: 32, push: 0.03, side: 1.4, yawDrift: 2, roll: 0},
  look: {...baseLook, dotPitch: 0.6, dotSize: 0.37, reliefBase: 0.55, city: ['#FF6A4A', 0.9], cityStrength: 0.3, coast: ['#4FC6D0', 0.7]},
  hotspots: [
    {lon: 8, lat: 50, radius: 4, intensity: 1.4, color: '#5FE8FF'},
    {lon: -4, lat: 8, radius: 4, intensity: 1.6, color: '#5FE8FF'},
    {lon: 100, lat: 12, radius: 3.5, intensity: 1.6, color: '#5FE8FF'},
    {lon: 121, lat: 14, radius: 3, intensity: 1.2, color: '#5FE8FF'},
    {lon: 77, lat: 22, radius: 6, intensity: 0.35, color: '#5FE8FF'},
    {lon: 40, lat: 52, radius: 8, intensity: 0.25, color: '#5FE8FF'},
    {lon: 105, lat: 45, radius: 9, intensity: 0.3, color: '#7AD8FF'},
  ],
  pins: [
    {lon: 8, lat: 50, kind: 'pin', code: 'HUB-01', labelDx: -22, labelDy: 2},
    {lon: -4, lat: 8, kind: 'pin', code: 'PORT-03', labelDx: 3, labelDy: -5},
    {lon: 78, lat: 21, kind: 'pin', code: 'HUB-07', sub: '#01 /// 510074', labelDx: -14, labelDy: -6},
    {lon: 103, lat: 6, kind: 'pinChart', code: 'NODE 4', labelDx: 5, labelDy: -6},
    {lon: 92, lat: 56, kind: 'pin', code: 'HUB-09', labelDx: 4, labelDy: 5},
    {lon: 135, lat: -24, kind: 'pin', code: 'HUB-12'},
    {lon: 46, lat: 30, kind: 'pinMinor'},
    {lon: 20, lat: -2, kind: 'pinMinor'},
    {lon: 60, lat: 50, kind: 'pinMinor'},
    {lon: 120, lat: 38, kind: 'pinMinor'},
  ],
  arcs: [
    {from: 0, to: 2, period: 120, offset: 0, height: 0.18},
    {from: 1, to: 2, period: 150, offset: 50, height: 0.18},
    {from: 0, to: 3, period: 200, offset: 100, height: 0.16, draw: [60, 300]},
    {from: 2, to: 3, period: 100, offset: 30, height: 0.25},
    {from: 3, to: 5, period: 150, offset: 70, height: 0.25, draw: [200, 300]},
    {from: 2, to: 4, period: 120, offset: 15, height: 0.22},
  ],
  counters: [
    {lon: 52, lat: 14, prefix: '#01 /// ', seed: 11, digits: 6, step: 3},
    {lon: 124, lat: 20, prefix: '', seed: 12, digits: 3, step: 5},
    {lon: 108, lat: 62, prefix: '', seed: 13, digits: 9, step: 4},
    {lon: 22, lat: 18, prefix: '', seed: 14, digits: 2, step: 10},
  ],
  hudBox: [-40, 170, -45, 80],
  freeLabels: [
    {lon: 106, lat: 68, text: 'INDEX [ m ]', alpha: 0.7},
    {lon: -20, lat: 60, text: 'ROUTE A-7', alpha: 0.6},
    {lon: 0, lat: 38, text: 'ZONE C-3', alpha: 0.5},
    {lon: 70, lat: -12, text: 'EXT 3 940 KM', alpha: 0.5},
    {lon: 126, lat: 28, text: '588/365', size: 1.2},
  ],
  routes: [],
  staticIcons: [],
  pinSize: 1.25,
  arcRadius: 0.022,
  iconSize: 1,
  hudSize: 1.7,
  post: {aperture: 0.07, maxBlur: 0.007, bloomStrength: 0.7, bloomThreshold: 0.4, vignette: 0.6, topLight: 0.2, exposure: 1},
};

export const ROUTES: MapVersion = {
  id: 'LogisticsMap-Routes',
  accent: '#FF8A2A',
  accentGain: 1.9,
  camera: {target: [14, 41], dist: 4.4, tilt: 55, yaw: 10, fov: 36, push: 0.04, side: 0.7, yawDrift: 2.5, roll: 0},
  look: {...baseLook, dotPitch: 0.22, dotSize: 0.34, landLit: '#2A6A70', landShadow: '#061416', reliefBase: 0.32, reliefContrast: 3.2, city: ['#FF7A22', 3.0], cityStrength: 0.5, gridStep: 2.5, reliefHeight: 0.02},
  hotspots: [
    {lon: -3.7, lat: 40.4, radius: 3.64, intensity: 3.52, color: '#FF7A22'},
    {lon: 2.3, lat: 48.8, radius: 2.86, intensity: 2.56, color: '#FF7A22'},
    {lon: 12.5, lat: 41.9, radius: 2.08, intensity: 2.56, color: '#FF7A22'},
    {lon: 29, lat: 41, radius: 2.34, intensity: 2.72, color: '#FF7A22'},
    {lon: 31.2, lat: 30, radius: 2.86, intensity: 2.72, color: '#FF7A22'},
    {lon: 9.2, lat: 45.5, radius: 1.95, intensity: 2.08, color: '#FF7A22'},
    {lon: 23.7, lat: 38, radius: 1.56, intensity: 1.92, color: '#FF7A22'},
  ],
  pins: [
    {lon: -3.7, lat: 40.4, kind: 'pin', code: 'HUB-01', labelDx: 1.5, labelDy: -2.5},
    {lon: 2.3, lat: 48.8, kind: 'pin', code: 'HUB-02', labelDx: 1.2, labelDy: 1.2},
    {lon: 12.5, lat: 41.9, kind: 'pin', code: 'PORT-03', labelDx: 1.2, labelDy: 1.2},
    {lon: 29, lat: 41, kind: 'pin', code: 'HUB-04', labelDx: 1.2, labelDy: 1.2},
    {lon: 31.2, lat: 30, kind: 'pin', code: 'PORT-05', labelDx: 1.2, labelDy: -2},
    {lon: 9.2, lat: 45.5, kind: 'pinMinor'},
    {lon: 23.7, lat: 38, kind: 'pinMinor'},
    {lon: 3, lat: 36.7, kind: 'pinMinor'},
    {lon: 10.2, lat: 36.8, kind: 'pinMinor'},
    {lon: 16, lat: 52, kind: 'pinMinor'},
  ],
  arcs: [
    {from: 0, to: 2, period: 100, offset: 0, height: 0.3},
    {from: 1, to: 3, period: 150, offset: 30, height: 0.3},
    {from: 2, to: 4, period: 120, offset: 60, height: 0.35},
    {from: 0, to: 1, period: 120, offset: 20, height: 0.35, draw: [0, 300]},
    {from: 2, to: 3, period: 100, offset: 80, height: 0.3, draw: [150, 300]},
    {from: 3, to: 4, period: 150, offset: 10, height: 0.4},
  ],
  counters: [
    {lon: 4, lat: 33.5, prefix: 'EXT [ ', seed: 21, digits: 6, step: 3},
    {lon: 18, lat: 34.5, prefix: '#02 /// ', seed: 22, digits: 6, step: 4},
    {lon: 26, lat: 46, prefix: '[ ', seed: 23, digits: 6, step: 5},
  ],
  hudBox: [-15, 45, 25, 60],
  freeLabels: [
    {lon: -2, lat: 37, text: 'ROUTE A-7', alpha: 0.7},
    {lon: 16, lat: 39.2, text: 'ROUTE B-2 · 1 260 KM', alpha: 0.7},
    {lon: 25, lat: 34.6, text: 'LANE 07', alpha: 0.6},
    {lon: 6, lat: 52, text: 'GRID 22/48', alpha: 0.5},
  ],
  routes: [
    // sea lanes (ships / tankers)
    {path: [[-6, 36], [0, 37.2], [5, 37.6], [11, 37.4], [15, 36.2], [20, 35.2], [26, 34.2], [31, 32.2]], icon: 'ship', count: 3, laps: 1, offset: 0},
    {path: [[32.4, 31.6], [28, 33.6], [23, 35.6], [18, 37], [14, 38.6], [10, 40], [7, 41.5], [5.4, 43.1]], icon: 'tanker', count: 2, laps: 1, offset: 0.25},
    {path: [[12.6, 44.5], [14.8, 42.6], [17.4, 41], [19.4, 39.4], [20.5, 37.5], [22, 36.2], [25, 36.6], [26.4, 39.4]], icon: 'ship', count: 2, laps: 1, offset: 0.55},
    {path: [[-9.6, 43.8], [-6, 44.4], [-3, 45.8], [-2.2, 47.6], [-5, 48.6], [-3, 50], [1.3, 50.6], [3.4, 52.4]], icon: 'tanker', count: 1, laps: 1, offset: 0.1},
    // land routes (trucks)
    {path: [[-3.7, 40.4], [-0.4, 41.6], [2.2, 42.5], [4.8, 44], [4.8, 46.4], [2.3, 48.8]], icon: 'truck', count: 2, laps: 2, offset: 0.1, color: 'white'},
    {path: [[9.2, 45.5], [11.4, 46.6], [14, 48], [16.4, 48.2], [19, 47.5], [21, 46.2], [26, 44.4], [29, 41]], icon: 'truck', count: 2, laps: 1, offset: 0.4, color: 'white'},
    {path: [[2.3, 48.8], [6, 49.6], [9.2, 49.4], [13.4, 52.5], [17, 51.1], [21, 52.2]], icon: 'truck', count: 1, laps: 1, offset: 0.7, color: 'white'},
    // air
    {path: [[-3.7, 40.4], [12.5, 41.9]], icon: 'plane', count: 1, laps: 2, offset: 0.3, altitude: 0.55, color: 'white'},
    {path: [[2.3, 48.8], [29, 41]], icon: 'plane', count: 1, laps: 1, offset: 0.6, altitude: 0.7, color: 'white'},
  ],
  staticIcons: [
    {lon: -8.5, lat: 42.2, icon: 'factory'},
    {lon: 4.8, lat: 45.7, icon: 'factory'},
    {lon: 9.6, lat: 45.2, icon: 'factory', color: 'white'},
    {lon: 19.9, lat: 50.1, icon: 'factory'},
    {lon: 35.5, lat: 33.9, icon: 'factory', color: 'white'},
    {lon: 14.3, lat: 40.8, icon: 'tanker'},
    {lon: 26, lat: 38, icon: 'factory', color: 'white'},
  ],
  pinSize: 1.9,
  arcRadius: 0.026,
  iconSize: 1.9,
  hudSize: 0.5,
  post: {aperture: 0.028, maxBlur: 0.005, bloomStrength: 0.75, bloomThreshold: 0.4, vignette: 0.65, topLight: -0.15, exposure: 1},
};

export const MAP_VERSIONS = {World: WORLD, Asia: ASIA, Routes: ROUTES};
