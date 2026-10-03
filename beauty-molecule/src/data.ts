// Template data. Compositions are generated from every BACKGROUND x COLOUR
// combination (see Root.tsx). Adding a colourway = adding one row to COLOURS.

export type BackgroundId = 'dna' | 'structures';

export type BackgroundRow = {
  id: BackgroundId;
  /** Used in the composition id: BeautyMolecule_<name>_<Colour> */
  name: string;
  /** Hero molecule scale. 1 = hero atom ~9.5% of frame height. */
  heroScale: number;
  /** Hero centre offset from frame centre, world units at the focus plane
   * (frame is 8.87 x 4.99 there). */
  heroOffset: [number, number];
  /** Bond length and bond radius, relative to heroScale. */
  heroBondLength: number;
  heroBondRadius: number;
  /** Depth of field: circle of confusion (world units) per unit of depth
   * away from the focus plane. */
  cocK: number;
};

export type ColourRow = {
  id: string;
  name: string;
  /** Display (sRGB) colours, hit exactly after AgX tonemapping. */
  atomEdge: string;
  atomCenter: string;
  bgLight: string;
  bgDeep: string;
};

export const BACKGROUNDS: BackgroundRow[] = [
  {
    id: 'dna',
    name: 'DNA',
    heroScale: 1.25,
    heroOffset: [0.3, -0.35],
    heroBondLength: 1.0,
    heroBondRadius: 0.03,
    cocK: 0.013,
  },
  {
    id: 'structures',
    name: 'Structures',
    heroScale: 1.75,
    heroOffset: [-0.05, 0.05],
    heroBondLength: 1.08,
    heroBondRadius: 0.04,
    cocK: 0.007,
  },
];

export const COLOURS: ColourRow[] = [
  {
    id: 'coral',
    name: 'Coral',
    atomEdge: '#F06A5A',
    atomCenter: '#FFC8B8',
    bgLight: '#FFF2EE',
    bgDeep: '#F8D2C8',
  },
  {
    id: 'aqua',
    name: 'Aqua',
    atomEdge: '#2FB8C8',
    atomCenter: '#B8F0F0',
    bgLight: '#EEFAFB',
    bgDeep: '#C8E8EE',
  },
];

export const FPS = 30;
export const LOOP_FRAMES = 600; // 20 s
export const WIDTH = 3840;
export const HEIGHT = 2160;

// Remotion composition ids may not contain "_", so ids use "-";
// rendered files use the "_" names (BeautyMolecule_DNA_Coral.mp4).
export const compositionId = (b: BackgroundRow, c: ColourRow) =>
  `BeautyMolecule-${b.name}-${c.name}`;
export const outputName = (b: BackgroundRow, c: ColourRow) =>
  `BeautyMolecule_${b.name}_${c.name}`;
