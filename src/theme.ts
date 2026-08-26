/**
 * Every colour in the piece lives here. Nothing outside this file may contain a
 * hex literal — a new palette is a new entry in THEMES, never an edit elsewhere.
 */

export type Variant = 'blue';

export interface Theme {
  /** Deepest background tone, at the frame edges. */
  backgroundDeep: string;
  /** Lighter background tone, pooled behind the hero. */
  backgroundMid: string;
  /** Opaque message cards. */
  cardWhite: string;
  /** Filled blue cards. */
  cardBlue: string;
  /** Text lines inside cards. */
  lineBlue: string;
  /** The badge halo — the brightest thing in frame. */
  glowCyan: string;
  /** The "AI" glyph. */
  badgeWhite: string;
  /** Floating code, comment lines. */
  codeCyan: string;
  /** Floating code, everything else. */
  codeWhite: string;
  /** Compositional counterweight. A small number of mid-distance cards only. */
  accentRed: string;
}

export const THEMES: Record<Variant, Theme> = {
  blue: {
    backgroundDeep: '#060B18',
    backgroundMid: '#101C33',
    cardWhite: '#E8EEF5',
    cardBlue: '#2A6FD9',
    lineBlue: '#4A9EE8',
    glowCyan: '#29C5F5',
    badgeWhite: '#FFFFFF',
    codeCyan: '#5FD8E8',
    codeWhite: '#D8E8F5',
    accentRed: '#C41E28',
  },
};

export const getTheme = (variant: Variant): Theme => THEMES[variant] ?? THEMES.blue;

/** `#RRGGBB` -> `rgba(r, g, b, a)`. The only place hex is parsed. */
export const withAlpha = (hex: string, alpha: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Mix two theme colours in sRGB. Used for gradient stops and card rims. */
export const mixColors = (a: string, b: string, t: number): string => {
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const ca = (na >> shift) & 255;
    const cb = (nb >> shift) & 255;
    return Math.round(ca + (cb - ca) * t);
  };
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
};
