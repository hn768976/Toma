/**
 * The ONLY place in this project where a hex colour literal may appear.
 * Everything else consumes these values through the Palette object.
 */

export type PaletteName =
  | 'blue'
  | 'cyan'
  | 'green'
  | 'amber'
  | 'violet'
  | 'red';

export type Palette = {
  /** Plane background. */
  bg: string;
  /** The faint grid that covers the whole plane. */
  grid: string;
  /** Panel / block border stroke. */
  border: string;
  /** Content tones, dimmest -> brightest. */
  tones: readonly [string, string, string];
};

export const PALETTES: Record<PaletteName, Palette> = {
  blue: {
    bg: '#020A24',
    grid: '#0F2450',
    border: '#2E6FC4',
    tones: ['#1E4A8A', '#4F9FE8', '#C8E4FF'],
  },
  cyan: {
    bg: '#01141C',
    grid: '#0A3A4A',
    border: '#2E9FB8',
    tones: ['#14607A', '#4FD4E8', '#C8F8FF'],
  },
  green: {
    bg: '#011408',
    grid: '#0A3A1E',
    border: '#2EA85F',
    tones: ['#146030', '#4FE87A', '#C8FFD8'],
  },
  amber: {
    bg: '#140C01',
    grid: '#3A2408',
    border: '#C4802E',
    tones: ['#7A4A14', '#F5B85F', '#FFE8C8'],
  },
  violet: {
    bg: '#0A0420',
    grid: '#241050',
    border: '#7B4FC4',
    tones: ['#3A1A78', '#A87FF5', '#E8D8FF'],
  },
  red: {
    bg: '#14040A',
    grid: '#3A0A1E',
    border: '#C42E5F',
    tones: ['#7A1430', '#F55F80', '#FFD8E4'],
  },
};

export const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[];

/** Split a palette hex into its 0-255 channels. */
const channels = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Re-express a palette colour at a given alpha. */
export const alpha = (hex: string, a: number): string => {
  const [r, g, b] = channels(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/** Scale a palette colour's luminance, optionally with alpha. */
export const shade = (hex: string, mul: number, a = 1): string => {
  const [r, g, b] = channels(hex);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * mul)));
  return `rgba(${clamp(r)}, ${clamp(g)}, ${clamp(b)}, ${a})`;
};
