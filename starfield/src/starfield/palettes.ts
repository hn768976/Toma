export type StarTint = {
  /** Core colour of the star sprite. */
  color: string;
  /** Share of the point-star population, 0..1. Each palette's shares sum to 1. */
  weight: number;
};

export type NebulaRegion = {
  /** Two-stop gradient painted through the cloud mask. */
  from: string;
  to: string;
  /** CSS gradient angle for the colour ramp. */
  angle: number;
  /** Where the region lives, as a CSS radial-gradient mask. */
  at: string;
  size: string;
  opacity: number;
  /** Radius, in 4K px, of the circular offset path each noise layer walks. */
  sway: [number, number];
};

export type Palette = {
  id: string;
  label: string;
  /** Near-black base plus the slight blue lift toward frame centre. */
  baseCenter: string;
  baseEdge: string;
  regions: [NebulaRegion, NebulaRegion];
  stars: StarTint[];
  /** Default PRNG seed, so the two versions get different star layouts. */
  seed: number;
};

export const PALETTES: Record<string, Palette> = {
  'v1-violet-teal': {
    id: 'v1-violet-teal',
    label: 'Violet / teal',
    baseCenter: '#02040f',
    baseEdge: '#01010a',
    regions: [
      {
        // Violet / magenta, upper right.
        from: '#7a2f9e',
        to: '#4a1f6b',
        angle: 155,
        at: '76% 22%',
        size: '68% 64%',
        opacity: 0.25,
        sway: [92, 132],
      },
      {
        // Teal / green, lower left.
        from: '#1d6b5a',
        to: '#14513f',
        angle: 335,
        at: '17% 85%',
        size: '66% 62%',
        opacity: 0.3,
        sway: [118, 84],
      },
    ],
    stars: [
      {color: '#cfe0ff', weight: 0.65}, // blue-white
      {color: '#ffd9b0', weight: 0.2}, // warm white
      {color: '#9fd8ff', weight: 0.1}, // pale cyan
      {color: '#d9a0ff', weight: 0.05}, // pale magenta
    ],
    seed: 1337,
  },
  'v2-amber-cyan': {
    id: 'v2-amber-cyan',
    label: 'Amber / cyan',
    baseCenter: '#060410',
    baseEdge: '#01010a',
    regions: [
      {
        // Warm amber / rust, upper right.
        from: '#a35a24',
        to: '#6b3a1f',
        angle: 155,
        at: '76% 22%',
        size: '68% 64%',
        opacity: 0.26,
        sway: [92, 132],
      },
      {
        // Cool cyan, lower left.
        from: '#1d6a8f',
        to: '#14405f',
        angle: 335,
        at: '17% 85%',
        size: '66% 62%',
        opacity: 0.3,
        sway: [118, 84],
      },
    ],
    // Same four temperatures, mix pushed warmer to sit under the amber clouds.
    stars: [
      {color: '#cfe0ff', weight: 0.5},
      {color: '#ffd9b0', weight: 0.33},
      {color: '#9fd8ff', weight: 0.09},
      {color: '#ffc7a8', weight: 0.08},
    ],
    seed: 4242,
  },
};

export const PALETTE_IDS = Object.keys(PALETTES) as (keyof typeof PALETTES)[];
