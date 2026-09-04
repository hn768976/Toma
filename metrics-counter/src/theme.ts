export type Theme = {
  id: 'light' | 'dark';
  /** Base colour of the paper / panel. */
  surface: string;
  /** Slight warmth (V1) or cool cast (V2) laid over the surface. */
  surfaceTint: string;
  grid: string;
  gridStrong: string;
  type: string;
  /** Light falloff towards the far (top) edge of the plane. */
  falloff: string;
  /** Screen-space glow sitting behind the sharp band. Null disables it. */
  glow: string | null;
  vignette: boolean;
  /** Opacity of the grain layer; roughly its peak deviation. 0 = no grain. */
  grain: number;
};

export const LIGHT: Theme = {
  id: 'light',
  surface: '#f4f4f2',
  surfaceTint: 'rgba(255, 244, 226, 0.34)',
  grid: '#d8d8d4',
  gridStrong: '#cbcbc6',
  type: '#111111',
  falloff:
    'linear-gradient(to top, rgba(28,28,26,0) 34%, rgba(28,28,26,0.055) 68%, rgba(28,28,26,0.13) 100%)',
  glow: null,
  vignette: false,
  grain: 0.03,
};

export const DARK: Theme = {
  id: 'dark',
  surface: '#0b0c0e',
  surfaceTint: 'rgba(20, 30, 46, 0.24)',
  grid: '#1e2126',
  gridStrong: '#262b32',
  type: '#f2f4f6',
  falloff:
    'linear-gradient(to top, rgba(0,0,0,0) 30%, rgba(0,0,0,0.30) 70%, rgba(0,0,0,0.62) 100%)',
  glow: 'rgba(96, 150, 220, 0.10)',
  vignette: true,
  grain: 0.075,
};
