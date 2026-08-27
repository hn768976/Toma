import type {Silhouette, StrokeSpec} from './lib/mask';

export type Palette = {
  bgDeep: string;
  bgGlow: string;
  primary: string;
  white: string;
  secondary: string;
  accent: string;
};

export type BackgroundMode = 'circuit';
export type SubjectMode = 'shimmer';

export type VariantSpec = {
  palette: Palette;
  /** Authored in the 1920x1080 design space (see lib/space.ts). */
  silhouette: Silhouette;
  /** Interior lines that add particle density without widening the mask. */
  creases: StrokeSpec[];
  background: BackgroundMode;
  subject: SubjectMode;
};

export type VariantName = 'front';

/**
 * The single source of truth for every colour and every shape in the piece.
 * Nothing outside this file may contain a hex literal or a path string.
 */
export const VARIANTS: Record<VariantName, VariantSpec> = {
  front: {
    palette: {
      bgDeep: '#041028',
      bgGlow: '#0F3A6B',
      primary: '#3FE8F5',
      white: '#E8FDFF',
      secondary: '#2E7FD4',
      accent: '#7B4FA8',
    },
    silhouette: {
      fill: [
        // cranium, tapering into a jaw
        'M 960 78 C 1042 78 1106 154 1110 262 C 1114 330 1108 390 1092 442',
        'C 1074 504 1030 566 960 566 C 890 566 846 504 828 442',
        'C 812 390 806 330 810 262 C 814 154 878 78 960 78 Z',
        // neck
        'M 866 498 C 866 578 862 640 850 702 L 1070 702',
        'C 1058 640 1054 578 1054 498 Z',
        // trapezius sloping out to the deltoid, then arms hanging straight
        'M 880 658 C 800 668 726 700 668 742',
        'C 610 784 566 838 546 900 C 534 946 528 1010 526 1084',
        'L 1394 1084 C 1392 1010 1386 946 1374 900',
        'C 1354 838 1310 784 1252 742 C 1194 700 1120 668 1040 658 Z',
      ].join(' '),
      strokes: [],
    },
    creases: [
      // brow ridge and jaw line: the only features the head gets
      {d: 'M 845 262 C 895 234 1025 234 1075 262', w: 13},
      {d: 'M 826 422 C 846 518 890 558 960 560 C 1030 558 1074 518 1094 422', w: 11},
      // collar and trapezius ridges
      {d: 'M 754 780 C 856 846 1064 846 1166 780', w: 14},
      {d: 'M 648 848 C 730 788 812 740 894 716', w: 11},
      {d: 'M 1272 848 C 1190 788 1108 740 1026 716', w: 11},
      // the seam where each arm meets the torso
      {d: 'M 706 792 C 668 884 654 986 652 1084', w: 11},
      {d: 'M 1214 792 C 1252 884 1266 986 1268 1084', w: 11},
      // sternum hint
      {d: 'M 960 812 L 960 1084', w: 10},
    ],
    background: 'circuit',
    subject: 'shimmer',
  },
};
