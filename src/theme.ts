/**
 * Every colour used anywhere in this project lives in THEMES.
 * No other module may contain a hex literal.
 */

export type Variant = 'meal' | 'content';

export type Theme = {
  /** Upper-left of the background gradient. */
  backgroundLight: string;
  /** Lower-right of the background gradient. */
  backgroundDeep: string;
  /** Soft glow sitting behind the node cluster. */
  clusterGlow: string;
  /** Surface dots on the receding plane. */
  dotPale: string;
  /** Frosted card fill (used at ~45% alpha). */
  nodeFill: string;
  /** Bright card border. */
  nodeBorder: string;
  /** Line-art icon stroke. */
  icon: string;
  /** Text label beneath the card. */
  label: string;
  /** Neon connector core. */
  connector: string;
  /** Neon connector outer bloom. */
  connectorGlow: string;
  /** Travelling pulse core (kept near-white for a hot centre). */
  pulseCore: string;
  /** Fine film grain. */
  grain: string;
  /** Vignette ink. */
  vignette: string;
};

export const THEMES: Record<Variant, Theme> = {
  meal: {
    backgroundLight: '#6A6E7A',
    backgroundDeep: '#16244A',
    clusterGlow: '#2E4C86',
    dotPale: '#C8CED8',
    nodeFill: '#2A3550',
    nodeBorder: '#4FC8F5',
    icon: '#7FE0FF',
    label: '#9FE8FF',
    connector: '#F54FA8',
    connectorGlow: '#FF7FC4',
    pulseCore: '#FFE8F5',
    grain: '#FFFFFF',
    vignette: '#000000',
  },
  content: {
    backgroundLight: '#4A5568',
    backgroundDeep: '#0A1433',
    clusterGlow: '#1E3468',
    dotPale: '#A8B4C8',
    nodeFill: '#16203D',
    nodeBorder: '#3F8FE0',
    icon: '#6FB4F0',
    label: '#8FC8F5',
    connector: '#7B5FE8',
    connectorGlow: '#9B7FF5',
    pulseCore: '#EDE8FF',
    grain: '#FFFFFF',
    vignette: '#000000',
  },
};

/** `#RRGGBB` + alpha -> `rgba(...)`. The hex always originates in THEMES. */
export const withAlpha = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
