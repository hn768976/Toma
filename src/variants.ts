/**
 * The ONLY place in the project that holds palettes, silhouette path data,
 * density-map rules, subject animation modes and panel labels.
 *
 * Swapping the scanned subject is a data change: nothing downstream knows what
 * a car, a jet or a brain is.
 */

export type VariantKey = 'car' | 'jet' | 'brain';

export type Palette = {
  bg: string;
  line: string;
  fill: string;
  text: string;
  particle: string;
  particleHot: string;
  sweep: string;
  accent: string;
};

/** scale/translate applied to a path so one path string can serve twice. */
export type Xform = [sx: number, sy: number, tx: number, ty: number];

export type PathRef = {d: string; t?: Xform};

export type Cluster = {x: number; y: number; r: number; boost: number};

export type Silhouette = {
  /** path-space viewBox that the silhouette is rasterised in */
  vb: [number, number];
  /** the region of path space that is fitted to the stage; defaults to vb */
  fit?: [x: number, y: number, w: number, h: number];
  /** filled to build the mask - the union of these is the silhouette */
  fills: PathRef[];
  /** stroked to build the distance field: outer edges + interior creases */
  lines: PathRef[];
  /** stroke width, in path units, used when building the distance field */
  creaseW: number;
  clusters: Cluster[];
  /** brightness gradient direction across the subject */
  light: [number, number];
  /** direction the scan sweep travels */
  axis: [number, number];
  /** subset of `lines` that pulses travel along in "propagate" mode */
  sulci?: PathRef[];
};

export type DensityRule = {
  target: number;
  /** exponential falloff (raster px) from the nearest edge or crease */
  falloff: number;
  /** baseline acceptance across flat interior areas */
  flat: number;
  /** grid the particles snap to, in 4K px */
  grid: number;
  sizeMin: number;
  sizeMax: number;
  gradLo: number;
  gradHi: number;
};

export type Motion =
  | {
      mode: 'sweep';
      /** frames per pass; must divide 600 */
      period: number;
      /** band half-width as a fraction of the subject's span */
      band: number;
      /** trail length as a fraction of the subject's span */
      trail: number;
      gain: number;
      /** optional independent pulse on the bright clusters */
      clusterPulse?: {period: number; amount: number};
    }
  | {
      mode: 'propagate';
      pulses: number;
      lifeMin: number;
      lifeMax: number;
      /** frames a particle takes to decay after a pulse passes */
      decay: number;
      /** how far a pulse spreads along the graph, in path units */
      spread: number;
      gain: number;
    };

export type ValueSpec = {
  label: string;
  unit: string;
  lo: number;
  hi: number;
  dp: number;
};

export type Readouts = {
  top: ValueSpec[];
  wave: {label: string; sub: string; energy: number};
  table: {label: string; tags: string[]};
  numA: ValueSpec;
  numB: ValueSpec;
  grid: {label: string; tags: string[]};
  meters: {label: string; tags: string[]};
  radar: {label: string; sub: string; turns: number}[];
  scroll: {label: string; tokens: string[]};
  strips: ValueSpec[];
  hist: {label: string};
  numerals: {label: string};
  status: {label: string; states: string[]};
};

export type Variant = {
  palette: Palette;
  silhouette: Silhouette;
  density: DensityRule;
  motion: Motion;
  readouts: Readouts;
};

/* ══════════════════════════════════════════════════════════════════════
   #region variant:car
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Generic crossover, three-quarter front view, nose to the left.
 *
 * Built the way an illustrator would: a near-side profile (with the wheel
 * arches cut out of it), plus three narrow "far side" slivers - the front
 * fascia, the bonnet top and the roof top - each pushed up and to the left.
 * Filling all of them unions into a three-quarter silhouette, and the near
 * profile survives inside it as a crease, which is what sells the perspective.
 * No badge, no grille detail, no brand cues.
 */
const CAR_PROFILE =
  'M 182 504 L 158 468 L 152 424 Q 156 384 176 344 ' +
  'C 280 338 400 332 496 328 L 520 326 L 640 214 ' +
  'Q 656 202 682 200 L 898 202 L 938 210 L 1030 296 ' +
  'L 1062 308 L 1102 390 Q 1118 414 1118 442 L 1102 506 ' +
  'L 1036 524 C 1036 440 1000 392 930 392 C 860 392 824 440 824 524 ' +
  'L 456 528 C 456 444 420 396 350 396 C 280 396 244 444 244 528 Z';

const CAR_FASCIA =
  'M 176 344 L 152 424 L 158 468 L 182 504 ' +
  'L 154 482 L 130 446 L 126 402 L 148 322 Z';

const CAR_BONNET_TOP =
  'M 176 344 L 148 322 C 250 316 380 308 492 304 L 520 326 ' +
  'C 400 332 280 338 176 344 Z';

const CAR_ROOF_TOP =
  'M 520 326 L 492 304 L 612 192 Q 628 180 654 178 L 870 180 ' +
  'L 910 188 L 938 210 L 898 202 L 682 200 Q 656 202 640 214 Z';

const CAR_REAR_TOP =
  'M 938 210 L 910 188 L 1002 274 L 1034 286 L 1062 308 L 1030 296 Z';

const CAR_WHEEL_F =
  'M 350 506 m -84 0 a 84 84 0 1 0 168 0 a 84 84 0 1 0 -168 0';
const CAR_WHEEL_R =
  'M 930 502 m -82 0 a 82 82 0 1 0 164 0 a 82 82 0 1 0 -164 0';

const CAR: Variant = {
  palette: {
    bg: '#01100E',
    line: '#1A5C52',
    fill: '#04211D',
    text: '#7FD4C4',
    particle: '#4FF5E0',
    particleHot: '#E8FFFA',
    sweep: '#A8FFF0',
    accent: '#2E9F8F',
  },
  silhouette: {
    vb: [1200, 660],
    fit: [104, 166, 1026, 436],
    fills: [
      {d: CAR_PROFILE},
      {d: CAR_FASCIA},
      {d: CAR_BONNET_TOP},
      {d: CAR_ROOF_TOP},
      {d: CAR_REAR_TOP},
      // the arch cutouts are wider than the wheels, so a crescent of empty
      // space is left inside each arch and the wheels read as wheels
      {d: CAR_WHEEL_F},
      {d: CAR_WHEEL_R},
    ],
    lines: [
      // outer silhouette, which doubles as the near-side body edge
      {d: CAR_PROFILE},
      {d: CAR_FASCIA},
      {d: CAR_BONNET_TOP},
      {d: CAR_ROOF_TOP},
      {d: CAR_REAR_TOP},
      // beltline
      {d: 'M 520 326 C 650 318 790 312 890 310 C 960 309 998 316 1024 328'},
      // window frames: B-pillar, C-pillar
      {d: 'M 742 314 L 732 184'},
      {d: 'M 938 210 L 968 316'},
      // door shut lines
      {d: 'M 548 328 L 554 522'},
      {d: 'M 758 314 L 764 522'},
      // bonnet shut line + bonnet centre crease
      {d: 'M 150 400 C 170 378 196 358 226 348'},
      {d: 'M 190 338 C 290 330 400 324 512 320'},
      // roof centre crease
      {d: 'M 656 190 L 884 191'},
      // wheel arches
      {d: 'M 244 528 C 244 444 280 396 350 396 C 420 396 456 444 456 528'},
      {d: 'M 824 524 C 824 440 860 392 930 392 C 1000 392 1036 440 1036 524'},
      // rocker + lower door crease
      {d: 'M 250 518 L 640 524 L 1030 518'},
      {d: 'M 270 470 C 520 478 780 478 1030 466'},
      // headlight wrap
      {d: 'M 154 428 C 176 414 202 406 234 400'},
      {d: 'M 128 406 C 134 388 138 360 148 322'},
      // tail lamp, tailgate shut and rear bumper shut
      {d: 'M 1030 296 C 1046 322 1056 352 1060 388'},
      {d: 'M 1072 336 C 1090 354 1100 374 1106 398'},
      {d: 'M 1044 472 C 1074 466 1094 458 1106 448'},
      // tyre walls and hubs, so the wheels are not flat discs
      {d: 'M 350 506 m -58 0 a 58 58 0 1 0 116 0 a 58 58 0 1 0 -116 0'},
      {d: 'M 350 506 m -28 0 a 28 28 0 1 0 56 0 a 28 28 0 1 0 -56 0'},
      {d: 'M 930 502 m -56 0 a 56 56 0 1 0 112 0 a 56 56 0 1 0 -112 0'},
      {d: 'M 930 502 m -27 0 a 27 27 0 1 0 54 0 a 27 27 0 1 0 -54 0'},
    ],
    creaseW: 2.4,
    clusters: [
      {x: 350, y: 506, r: 88, boost: 0.5},
      {x: 930, y: 502, r: 86, boost: 0.45},
      {x: 182, y: 402, r: 42, boost: 0.8},
      {x: 152, y: 378, r: 32, boost: 0.6},
    ],
    light: [-1, -0.45],
    axis: [1, 0],
  },
  density: {
    target: 5200,
    falloff: 6,
    flat: 0.028,
    grid: 8,
    sizeMin: 3,
    sizeMax: 9,
    gradLo: 0.52,
    gradHi: 1,
  },
  motion: {
    mode: 'sweep',
    period: 120,
    band: 0.07,
    trail: 0.3,
    gain: 1.15,
  },
  readouts: {
    top: [
      {label: 'EXTRACT.COORD', unit: 'X', lo: 10, hi: 99, dp: 0},
      {label: 'EXTRACT.COORD', unit: 'Y', lo: 10, hi: 99, dp: 0},
      {label: 'EXTRACT.COORD', unit: 'Z', lo: 10, hi: 99, dp: 0},
      {label: 'SCAN.DEPTH', unit: 'MM', lo: 120, hi: 480, dp: 0},
      {label: 'SURF.GAIN', unit: 'DB', lo: 4, hi: 26, dp: 1},
      {label: 'MESH.RES', unit: 'PT', lo: 2000, hi: 9800, dp: 0},
      {label: 'CHAN.LOCK', unit: '%', lo: 78, hi: 100, dp: 0},
      {label: 'PASS.IDX', unit: '', lo: 1, hi: 48, dp: 0},
    ],
    wave: {label: 'SURFACE TRACE', sub: 'DATA_KD2503', energy: 0.55},
    table: {
      label: 'SCANNING DATA',
      tags: [
        'RS7', 'RB2', 'RA4', 'R31', 'RD9', 'RC5', 'RF8', 'R12',
        'RG3', 'RH6', 'RJ1', 'RK7', 'RL4', 'RM9', 'RN2', 'RP5',
        'RQ8', 'RT3', 'RU6', 'RV1', 'RW7', 'RX4', 'RY9', 'RZ2',
      ],
    },
    numA: {label: 'PROFILE CHANNEL', unit: '', lo: 100, hi: 199, dp: 0},
    numB: {label: 'INDEXED CHANNEL', unit: '', lo: 100, hi: 199, dp: 0},
    grid: {
      label: 'LEVEL INDICATORS',
      tags: ['LOW LVL', 'MEDIUM LVL', 'HIGH LVL'],
    },
    meters: {
      label: 'CHANNEL DATA',
      tags: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'CA', 'CB', 'CC'],
    },
    radar: [
      {label: 'SECTOR SCAN', sub: 'ARR-A', turns: 3},
      {label: 'SECTOR SCAN', sub: 'ARR-B', turns: 5},
    ],
    scroll: {
      label: 'SEARCH ID CODES',
      tokens: ['SC', 'KD', 'LM', 'TR', 'QX', 'ZP', 'VN', 'HB', 'WG', 'FY'],
    },
    strips: [
      {label: 'X9', unit: '', lo: 0, hi: 100, dp: 0},
      {label: 'Y6', unit: '', lo: 0, hi: 100, dp: 0},
      {label: 'Z5', unit: '', lo: 0, hi: 100, dp: 0},
    ],
    hist: {label: 'CHANNEL SPECTRUM'},
    numerals: {label: 'RAW DATA STREAM'},
    status: {
      label: 'ONGOING TARGET SCAN',
      states: ['ACQUIRING', 'LOCKED', 'SAMPLING', 'INDEXING'],
    },
  },
};

/* #endregion variant:car */

export const VARIANTS: Record<VariantKey, Variant> = {
  car: CAR,
  /* #region register:jet */
  /* #endregion register:jet */
  /* #region register:brain */
  /* #endregion register:brain */
} as Record<VariantKey, Variant>;
