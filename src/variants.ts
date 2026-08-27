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
    // One hand is authored, then mirrored about x = 960 by tools/mirror-hand.mjs
    // and pasted here; palms, fingers and wrists are stroked rather than
    // outlined, which is what makes a hand tractable to draw as a path at all.
    silhouette: {
      fill: [
        'M 452 880 C 430 806 448 726 506 682 C 566 636 656 640 712 692 C 758 736 770 812 744 878 C 714 950 606 982 528 952 C 486 936 464 918 452 880 Z',
        'M 1468 880 C 1490 806 1472 726 1414 682 C 1354 636 1264 640 1208 692 C 1162 736 1150 812 1176 878 C 1206 950 1314 982 1392 952 C 1434 936 1456 918 1468 880 Z',
      ].join(' '),
      strokes: [
        {d: 'M 452 1150 C 470 1058 494 992 530 946', w: 158},
        {d: 'M 636 690 C 706 640 798 600 866 578', w: 46},
        {d: 'M 676 726 C 748 686 830 656 890 640', w: 48},
        {d: 'M 708 776 C 772 748 830 726 876 712', w: 44},
        {d: 'M 726 830 C 774 816 812 800 846 786', w: 38},
        {d: 'M 632 910 C 690 936 754 944 818 940', w: 62},
        {d: 'M 1468 1150 C 1450 1058 1426 992 1390 946', w: 158},
        {d: 'M 1284 690 C 1214 640 1122 600 1054 578', w: 46},
        {d: 'M 1244 726 C 1172 686 1090 656 1030 640', w: 48},
        {d: 'M 1212 776 C 1148 748 1090 726 1044 712', w: 44},
        {d: 'M 1194 830 C 1146 816 1108 800 1074 786', w: 38},
        {d: 'M 1288 910 C 1230 936 1166 944 1102 940', w: 62},
      ],
    },
    creases: [
      {d: 'M 502 690 C 472 760 474 844 512 918', w: 11},
      {d: 'M 452 838 C 534 802 628 796 710 812', w: 11},
      {d: 'M 474 776 C 552 734 646 724 726 742', w: 11},
      {d: 'M 622 676 C 668 712 700 762 720 830', w: 12},
      {d: 'M 658 706 C 674 694 686 686 700 678', w: 9},
      {d: 'M 694 750 C 708 738 722 730 736 722', w: 9},
      {d: 'M 720 802 C 734 792 746 784 758 776', w: 9},
      {d: 'M 760 626 C 768 640 772 650 776 662', w: 8},
      {d: 'M 792 672 C 800 686 804 696 808 708', w: 8},
      {d: 'M 800 738 C 808 750 812 758 816 768', w: 8},
      {d: 'M 792 806 C 798 816 802 822 806 830', w: 8},
      {d: 'M 620 880 C 600 912 598 940 606 968', w: 10},
      {d: 'M 1418 690 C 1448 760 1446 844 1408 918', w: 11},
      {d: 'M 1468 838 C 1386 802 1292 796 1210 812', w: 11},
      {d: 'M 1446 776 C 1368 734 1274 724 1194 742', w: 11},
      {d: 'M 1298 676 C 1252 712 1220 762 1200 830', w: 12},
      {d: 'M 1262 706 C 1246 694 1234 686 1220 678', w: 9},
      {d: 'M 1226 750 C 1212 738 1198 730 1184 722', w: 9},
      {d: 'M 1200 802 C 1186 792 1174 784 1162 776', w: 9},
      {d: 'M 1160 626 C 1152 640 1148 650 1144 662', w: 8},
      {d: 'M 1128 672 C 1120 686 1116 696 1112 708', w: 8},
      {d: 'M 1120 738 C 1112 750 1108 758 1104 768', w: 8},
      {d: 'M 1128 806 C 1122 816 1118 822 1114 830', w: 8},
      {d: 'M 1300 880 C 1320 912 1322 940 1314 968', w: 10},
    ],
    background: 'dots',
    subject: 'sphere',
  },
};
