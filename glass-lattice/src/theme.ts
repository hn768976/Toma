import {z} from 'zod';

export type Palette = {
  /** Backdrop at the darkest corner. */
  background: string;
  /** Soft ambient bloom behind the lattice. */
  backgroundGlow: string;
  /** Base tint of the glass body. */
  glass: string;
  /** Broad fresnel glow through the body of the glass. */
  emissive: string;
  /** Hot, near-white silhouette line along every bevel. */
  rimLight: string;
  /** Main light raking the lattice from the left. */
  keyLight: string;
  /** Cooler fill from below. */
  fillLight: string;
  /** Vertical gradient used for the procedural reflection environment. */
  envTop: string;
  envBottom: string;
};

export const PALETTES = {
  blue: {
    background: '#00030a',
    backgroundGlow: '#0d2a55',
    glass: '#173a70',
    emissive: '#3d8cff',
    rimLight: '#d5e7ff',
    keyLight: '#8fc0ff',
    fillLight: '#2f6bd8',
    envTop: '#0a1830',
    envBottom: '#dceaff',
  },
  violet: {
    background: '#05000c',
    backgroundGlow: '#280a4d',
    glass: '#3f0d70',
    emissive: '#9012ec',
    rimLight: '#eed4ff',
    keyLight: '#c88fff',
    fillLight: '#7014c0',
    envTop: '#190a30',
    envBottom: '#e6ccff',
  },
} satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;

export const glassLatticeSchema = z.object({
  palette: z.enum(['blue', 'violet']),
  /** Horizontal flip of the finished image — lattice moves to the right side. */
  mirrored: z.boolean(),
});

export type GlassLatticeProps = z.infer<typeof glassLatticeSchema>;
