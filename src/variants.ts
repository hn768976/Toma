import type {Silhouette, StrokeSpec} from './lib/mask';

export type Palette = {
  bgDeep: string;
  bgGlow: string;
  primary: string;
  white: string;
  secondary: string;
  accent: string;
};

export type BackgroundMode = 'circuit' | 'text' | 'dots';
export type SubjectMode = 'shimmer' | 'stream' | 'sphere';

export type VariantSpec = {
  palette: Palette;
  /** Authored in the 1920x1080 design space (see lib/space.ts). */
  silhouette: Silhouette;
  /** Interior lines that add particle density without widening the mask. */
  creases: StrokeSpec[];
  background: BackgroundMode;
  subject: SubjectMode;
};

export type VariantName = 'front' | 'profile' | 'hands';

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
  profile: {
    palette: {
      bgDeep: '#0B0A2E',
      bgGlow: '#241F6B',
      primary: '#6F5FE8',
      white: '#EDEAFF',
      secondary: '#4F3FC4',
      accent: '#A89FF5',
    },
    silhouette: {
      fill: [
        // Full left profile. The relief is deliberately exaggerated: at a grid
        // pitch of ~20 design units, an anatomically-scaled lip would vanish.
        'M 990 78 C 900 82 848 128 836 190',
        'C 828 222 822 240 818 262 C 830 288 850 294 856 302',
        'C 828 332 776 366 730 402 C 748 420 800 424 846 428',
        'C 826 438 802 442 800 454 C 818 464 840 464 838 474',
        'C 824 484 806 486 806 498 C 826 512 848 514 856 530',
        'C 858 546 856 558 866 570 C 884 590 906 598 932 602',
        'C 972 610 1000 612 1034 608 C 1080 604 1114 588 1138 562',
        'C 1188 508 1218 452 1216 380 C 1214 268 1192 168 1122 118',
        'C 1082 88 1036 76 990 78 Z',
        // neck: set back far enough that the chin clearly overhangs it
        'M 944 560 C 956 618 958 668 952 726 L 1204 732',
        'C 1186 664 1160 598 1152 536 Z',
        // chest in front, back behind, near arm running off the bottom edge
        'M 1010 656 C 1096 656 1160 680 1214 714',
        'C 1284 760 1324 826 1344 900 C 1358 950 1364 1010 1366 1084',
        'L 654 1084 C 658 1004 670 944 690 894',
        'C 716 828 758 774 814 734 C 866 698 918 660 1010 656 Z',
      ].join(' '),
      strokes: [],
    },
    creases: [
      // the ear is a density cluster rather than a shape in the outline
      {d: 'M 1060 412 C 1106 400 1124 438 1116 472 C 1110 500 1078 506 1058 490', w: 15},
      {d: 'M 830 262 C 858 250 884 254 902 268', w: 11},
      {d: 'M 866 408 C 914 396 960 402 996 420', w: 10},
      {d: 'M 910 572 C 958 600 1018 610 1072 600', w: 11},
      {d: 'M 906 124 C 968 102 1058 128 1100 190', w: 11},
      {d: 'M 986 712 C 1050 752 1130 758 1194 736', w: 13},
      {d: 'M 806 782 C 884 720 966 686 1050 674', w: 11},
      {d: 'M 1246 800 C 1286 890 1306 990 1312 1084', w: 11},
    ],
    background: 'text',
    subject: 'stream',
  },
  hands: {
    palette: {
      bgDeep: '#02120A',
      bgGlow: '#0C3D1E',
      primary: '#3FE87F',
      white: '#E8FFEF',
      secondary: '#2E9F6B',
      accent: '#C4FFD8',
    },
    // The subject is the sphere itself: a circle of radius 380 about the frame
    // centre, 70% of frame height. Running it through the same mask pipeline as
    // the other two variants is what gives it its limb density and its wrapping
    // grid — and for a sphere the grid is not a metaphor, the compressed
    // vertical bands are the latitude rings the orbiting particles ride along.
    silhouette: {
      fill: [
        'M 960 160 C 1170 160 1340 330 1340 540',
        'C 1340 750 1170 920 960 920 C 750 920 580 750 580 540',
        'C 580 330 750 160 960 160 Z',
      ].join(' '),
      strokes: [],
    },
    // A shell has no creases.
    creases: [],
    background: 'dots',
    subject: 'sphere',
  },
};
