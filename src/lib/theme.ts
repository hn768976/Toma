import type {CSSProperties} from 'react';

/**
 * Global spec, section "Colors". These are the only four colours in the film.
 * Accent is reserved for packets and nothing else.
 */
export const COLORS = {
  bg: '#FFFFFF',
  fill: '#D8D8D8',
  ink: '#1A1A1A',
  accent: '#FF6B35',
} as const;

/**
 * Global spec, section "Type". One weight, all caps, wide tracking.
 * Max three words on screen at any time.
 */
export const FONT_STACK =
  'Inter, "Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif';

export const TYPE: CSSProperties = {
  fontFamily: FONT_STACK,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: COLORS.ink,
  whiteSpace: 'nowrap',
};

export const STROKE = 4;
