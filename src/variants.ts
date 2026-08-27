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

export type Cluster = {
  x: number;
  y: number;
  r: number;
  boost: number;
  /** particles in this cluster respond to the motion's clusterPulse */
  pulse?: boolean;
};

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
/**
 * Sleek modern car in side profile, nose to the left.
 *
 * Every line of the upper body is a curve, not a ramp: the nose is rounded,
 * the bonnet is a domed arc that rises fast off the nose and flattens into the
 * cowl, and windshield, roof and rear glass run into one another as a single
 * continuous sweep down to a ducktail kick. Generic - no badge, no grille, no
 * brand cues.
 */
const CAR_PROFILE =
  'M 196 520 C 168 514 148 500 138 476 C 130 458 130 442 136 426 ' +
  'C 142 412 148 406 158 402 C 240 372 350 352 470 344 L 506 340 ' +
  'C 556 298 600 268 656 250 C 706 236 762 232 818 238 ' +
  'C 890 248 962 280 1024 322 L 1054 342 Q 1074 354 1076 378 ' +
  'L 1080 404 Q 1082 426 1074 450 L 1052 504 ' +
  'L 1000 518 C 1000 438 976 396 916 396 C 856 396 832 438 832 518 ' +
  'L 460 524 C 460 442 434 398 372 398 C 310 398 286 442 286 524 Z';

const CAR_FASCIA =
  'M 158 402 C 148 406 142 412 136 426 C 130 442 130 458 138 476 ' +
  'C 148 500 168 514 196 520 L 180 508 C 154 494 140 472 138 448 ' +
  'C 136 424 142 406 152 388 Z';

const CAR_BONNET_TOP =
  'M 158 402 C 240 372 350 352 470 344 L 506 340 L 490 326 ' +
  'C 370 334 250 354 152 388 Z';

const CAR_ROOF_TOP =
  'M 506 340 L 490 326 C 546 286 592 256 650 238 ' +
  'C 704 224 762 220 820 226 L 818 238 ' +
  'C 762 232 706 236 656 250 C 600 268 556 298 506 340 Z';

const CAR_REAR_TOP =
  'M 820 226 C 892 236 966 268 1030 310 L 1024 322 ' +
  'C 962 280 890 248 818 238 Z';

const CAR_WHEEL_F =
  'M 372 500 m -82 0 a 82 82 0 1 0 164 0 a 82 82 0 1 0 -164 0';
const CAR_WHEEL_R =
  'M 916 496 m -80 0 a 80 80 0 1 0 160 0 a 80 80 0 1 0 -160 0';

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
    fit: [118, 214, 974, 382],
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
      // beltline, rising gently toward the tail
      {d: 'M 506 340 C 640 334 780 328 890 326 C 950 325 1000 328 1046 336'},
      // window frames: B-pillar, raked rear-quarter pillar
      {d: 'M 740 330 L 730 234'},
      {d: 'M 890 326 L 858 236'},
      // door shut lines
      {d: 'M 548 344 L 554 518'},
      {d: 'M 754 330 L 760 516'},
      // bonnet shut line at the nose + the bonnet's own crown crease
      {d: 'M 146 430 C 162 412 180 402 206 394'},
      {d: 'M 180 412 C 258 386 360 368 476 360'},
      // roof crown crease
      {d: 'M 668 244 C 720 234 764 232 806 236'},
      // long character line down the flank
      {d: 'M 250 430 C 520 418 800 410 1052 398'},
      // wheel arches
      {d: 'M 286 524 C 286 442 310 398 372 398 C 434 398 460 442 460 524'},
      {d: 'M 832 518 C 832 438 856 396 916 396 C 976 396 1000 438 1000 518'},
      // rocker + lower door crease
      {d: 'M 296 510 L 646 518 L 996 510'},
      {d: 'M 310 478 C 550 486 790 484 1020 470'},
      // headlight wrap and the fascia's lower edge
      {d: 'M 140 440 C 158 420 182 408 214 400'},
      {d: 'M 138 476 C 152 492 172 506 196 520'},
      // tail lamp, decklid shut and rear bumper shut
      {d: 'M 1024 322 C 1046 336 1062 352 1070 372'},
      {d: 'M 1054 342 C 1066 358 1072 374 1074 392'},
      {d: 'M 1038 472 C 1058 464 1070 454 1075 442'},
      // tyre walls and hubs, so the wheels are not flat discs
      {d: 'M 372 500 m -56 0 a 56 56 0 1 0 112 0 a 56 56 0 1 0 -112 0'},
      {d: 'M 372 500 m -27 0 a 27 27 0 1 0 54 0 a 27 27 0 1 0 -54 0'},
      {d: 'M 916 496 m -55 0 a 55 55 0 1 0 110 0 a 55 55 0 1 0 -110 0'},
      {d: 'M 916 496 m -26 0 a 26 26 0 1 0 52 0 a 26 26 0 1 0 -52 0'},
    ],
    creaseW: 2.4,
    clusters: [
      {x: 372, y: 500, r: 86, boost: 0.5},
      {x: 916, y: 496, r: 84, boost: 0.45},
      {x: 168, y: 420, r: 46, boost: 0.8},
      {x: 140, y: 444, r: 30, boost: 0.6},
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


/* ══════════════════════════════════════════════════════════════════════
   #region variant:jet
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Generic delta-wing fighter, three-quarter view from slightly above, nose to
 * the left. Delta wing, twin canted tail fins, single canopy. No national
 * markings and no identifiable airframe - the angular silhouette does the work
 * a car's compound curves cannot.
 */
/**
 * Generic delta fighter, three-quarter view from slightly above, nose to the
 * left. Only ONE half of the airframe is authored - nose, LERX flare, wing and
 * stabilator down one side. JET_MIRROR reflects it across the fuselage
 * centreline while squashing it to 82% and nudging it left, which is what puts
 * the camera above and off to one side. Twin canted fins, a single canopy, two
 * nozzles. No national markings, no identifiable airframe.
 */
const JET_HALF =
  'M 90 360 C 130 372 178 384 236 392 L 320 400 L 396 406 ' +
  'C 436 418 476 432 500 442 L 520 446 L 852 646 L 886 650 ' +
  'L 902 476 L 928 452 L 958 454 L 1042 552 L 1064 548 ' +
  'L 1074 462 L 1088 430 L 1094 392 L 1096 360 Z';

const JET_INTAKE_HALF = 'M 400 412 L 540 444 L 548 472 L 408 438 Z';

const JET_MIRROR: Xform = [1, -0.82, -16, 655.2];

const JET_CANOPY =
  'M 236 360 C 250 328 296 312 344 310 C 396 309 430 324 442 344 ' +
  'C 434 368 392 382 344 382 C 292 382 246 376 236 360 Z';

const JET_FIN_NEAR = 'M 892 418 L 936 414 L 1010 288 L 974 278 Z';
const JET_FIN_FAR = 'M 890 313 L 934 310 L 1002 196 L 966 188 Z';

const JET_NOZZLE_NEAR =
  'M 1104 392 m -24 0 a 24 24 0 1 0 48 0 a 24 24 0 1 0 -48 0';
const JET_NOZZLE_FAR =
  'M 1094 334 m -22 0 a 22 22 0 1 0 44 0 a 22 22 0 1 0 -44 0';

const JET: Variant = {
  palette: {
    bg: '#030A1F',
    line: '#1E4A8F',
    fill: '#061436',
    text: '#8FB8F0',
    particle: '#4F9FFF',
    particleHot: '#E8F2FF',
    sweep: '#A8D4FF',
    accent: '#2E6FD4',
  },
  silhouette: {
    vb: [1200, 720],
    fit: [64, 108, 1074, 560],
    fills: [
      {d: JET_HALF},
      {d: JET_HALF, t: JET_MIRROR},
      {d: JET_INTAKE_HALF},
      {d: JET_INTAKE_HALF, t: JET_MIRROR},
      {d: JET_FIN_FAR},
      {d: JET_FIN_NEAR},
      {d: JET_CANOPY},
      {d: JET_NOZZLE_FAR},
      {d: JET_NOZZLE_NEAR},
    ],
    lines: [
      {d: JET_HALF},
      {d: JET_HALF, t: JET_MIRROR},
      {d: JET_INTAKE_HALF},
      {d: JET_INTAKE_HALF, t: JET_MIRROR},
      {d: JET_FIN_FAR},
      {d: JET_FIN_NEAR},
      {d: JET_CANOPY},
      {d: JET_NOZZLE_FAR},
      {d: JET_NOZZLE_NEAR},
      // fuselage spine
      {d: 'M 104 360 L 1092 360'},
      // wing-root join and the LERX crease ahead of it
      {d: 'M 520 446 L 902 476'},
      {d: 'M 520 446 L 902 476', t: JET_MIRROR},
      {d: 'M 396 406 L 520 446'},
      {d: 'M 396 406 L 520 446', t: JET_MIRROR},
      // one chordwise panel line out along each wing
      {d: 'M 686 546 L 894 563'},
      {d: 'M 686 546 L 894 563', t: JET_MIRROR},
      // canopy frame and coaming
      {d: 'M 296 314 L 298 380'},
      {d: 'M 236 360 L 442 344'},
      // fuselage station lines
      {d: 'M 320 400 L 320 330'},
      {d: 'M 928 452 L 928 300'},
      // nozzle inner rings
      {d: 'M 1104 392 m -11 0 a 11 11 0 1 0 22 0 a 11 11 0 1 0 -22 0'},
      {d: 'M 1094 334 m -10 0 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0'},
    ],
    creaseW: 2.6,
    clusters: [
      {x: 1104, y: 392, r: 34, boost: 0.9, pulse: true},
      {x: 1094, y: 334, r: 32, boost: 0.85, pulse: true},
      {x: 340, y: 346, r: 100, boost: 0.55},
    ],
    light: [-1, -0.5],
    axis: [1, 0],
  },
  density: {
    target: 5000,
    falloff: 4,
    flat: 0.014,
    grid: 8,
    sizeMin: 3,
    sizeMax: 9,
    gradLo: 0.5,
    gradHi: 1,
  },
  motion: {
    mode: 'sweep',
    // Nose-to-tail and faster than the car. 75 frames is the closest cadence
    // to the intended ~90 that still divides 600 exactly (8 passes), which the
    // seamless loop requires.
    period: 75,
    band: 0.055,
    trail: 0.26,
    gain: 1.2,
    // the afterburner clusters breathe on their own sine, 15 cycles per loop
    clusterPulse: {period: 40, amount: 0.25},
  },
  readouts: {
    top: [
      {label: 'ALTITUDE', unit: 'FT', lo: 18, hi: 42, dp: 0},
      {label: 'AIRSPEED', unit: 'KT', lo: 320, hi: 780, dp: 0},
      {label: 'HEADING', unit: 'DEG', lo: 0, hi: 359, dp: 0},
      {label: 'MACH', unit: 'M', lo: 0.6, hi: 1.8, dp: 2},
      {label: 'THRUST', unit: '%', lo: 42, hi: 100, dp: 0},
      {label: 'FUEL', unit: 'KG', lo: 1200, hi: 6400, dp: 0},
      {label: 'ANGLE OF ATK', unit: 'DEG', lo: 2, hi: 18, dp: 1},
      {label: 'LOAD', unit: 'G', lo: 1, hi: 9, dp: 0},
    ],
    wave: {label: 'RADAR RETURN', sub: 'BAND_X', energy: 0.5},
    table: {
      label: 'TELEMETRY FEED',
      tags: [
        'ALT', 'IAS', 'HDG', 'MCH', 'THR', 'FUL', 'AOA', 'GLD',
        'VSI', 'TAS', 'QNH', 'OAT', 'EPR', 'N1G', 'N2G', 'EGT',
        'HYD', 'ELE', 'RUD', 'AIL', 'FLP', 'GER', 'BRK', 'TRM',
      ],
    },
    numA: {label: 'ALTITUDE FL', unit: '', lo: 180, hi: 420, dp: 0},
    numB: {label: 'AIRSPEED KT', unit: '', lo: 320, hi: 780, dp: 0},
    grid: {
      label: 'SYSTEM STATUS',
      tags: ['HYD PRESS', 'FUEL FLOW', 'ELEC BUS'],
    },
    meters: {
      label: 'THRUST CHANNELS',
      tags: ['N1', 'N2', 'EG', 'FF', 'OP', 'VB', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6'],
    },
    radar: [
      {label: 'THREAT BEARING', sub: 'FWD', turns: 3},
      {label: 'THREAT BEARING', sub: 'AFT', turns: 5},
    ],
    scroll: {
      label: 'LOCK STATUS',
      tokens: ['TRK', 'LCK', 'SRC', 'ACQ', 'BRK', 'ILL', 'PNT', 'WRN', 'CHF', 'FLR'],
    },
    strips: [
      {label: 'FUL', unit: '', lo: 0, hi: 100, dp: 0},
      {label: 'THR', unit: '', lo: 0, hi: 100, dp: 0},
      {label: 'LCK', unit: '', lo: 0, hi: 100, dp: 0},
    ],
    hist: {label: 'RADAR SPECTRUM'},
    numerals: {label: 'DATALINK STREAM'},
    status: {
      label: 'TARGET LOCK STATUS',
      states: ['SEARCHING', 'TRACKING', 'LOCKED', 'ENGAGED'],
    },
  },
};

/* #endregion variant:jet */


/* ══════════════════════════════════════════════════════════════════════
   #region variant:brain
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Human brain, side view, facing left: cerebrum, cerebellum at the lower rear,
 * brain stem descending. The folds ARE the subject here, so the sulci are
 * authored as interior curves rather than left to the density map to invent -
 * a smooth brain-shaped outline on its own reads as a bean.
 */
const BRAIN_CEREBRUM =
  'M 180 370 C 186 288 250 226 342 192 C 440 156 560 150 664 174 ' +
  'C 790 202 886 272 924 356 C 950 414 944 462 900 486 ' +
  'C 858 508 812 498 780 484 C 742 468 706 470 672 486 ' +
  'C 606 516 522 528 452 518 C 402 510 368 490 356 462 ' +
  'L 372 428 C 340 418 312 412 286 406 C 246 396 210 386 180 370 Z';

const BRAIN_CEREBELLUM =
  'M 782 486 C 826 470 878 478 906 504 C 934 530 930 572 900 594 ' +
  'C 866 618 802 618 764 596 C 730 576 722 538 742 512 ' +
  'C 754 496 768 490 782 486 Z';

const BRAIN_STEM =
  'M 664 488 L 728 496 C 740 546 740 606 728 664 ' +
  'C 724 682 704 698 684 692 C 664 686 656 664 660 638 ' +
  'C 666 588 666 534 664 488 Z';

/** The sulci. Pulses travel along these, so they are also the graph. */
const BRAIN_SULCI: PathRef[] = [
  // lateral (Sylvian) fissure
  {d: 'M 372 430 C 444 456 528 468 610 462 C 664 458 700 444 720 424'},
  // central, precentral and postcentral sulci
  {d: 'M 556 172 C 562 238 574 308 592 370 C 600 398 610 418 622 432'},
  {d: 'M 470 184 C 480 248 492 316 510 376 C 518 402 528 420 540 434'},
  {d: 'M 646 180 C 656 242 668 308 686 366 C 694 392 704 408 716 420'},
  // frontal lobe
  {d: 'M 216 302 C 292 258 384 234 476 230'},
  {d: 'M 206 356 C 282 330 364 314 446 314'},
  {d: 'M 232 400 C 300 384 368 374 428 372'},
  {d: 'M 190 328 C 216 302 244 288 280 278'},
  // vertex
  {d: 'M 320 214 C 396 184 486 168 578 166'},
  {d: 'M 360 246 C 434 218 520 204 604 202'},
  // parietal and occipital
  {d: 'M 704 244 C 766 268 818 302 856 344'},
  {d: 'M 690 198 C 748 214 796 240 834 272'},
  {d: 'M 800 224 C 822 272 838 324 844 378'},
  {d: 'M 862 386 C 892 402 912 420 922 442'},
  {d: 'M 812 424 C 850 436 882 452 902 476'},
  // temporal lobe
  {d: 'M 396 484 C 468 502 548 512 624 502 C 662 496 690 486 706 472'},
  {d: 'M 400 506 C 470 522 546 530 614 522'},
  {d: 'M 424 468 C 486 482 552 488 612 482'},
  {d: 'M 660 484 C 700 476 740 474 776 480'},
  // cerebellum: fine ridged texture
  {d: 'M 752 514 C 802 500 862 506 900 524'},
  {d: 'M 742 538 C 798 526 862 530 908 548'},
  {d: 'M 744 562 C 798 552 860 556 902 574'},
  {d: 'M 756 586 C 804 578 856 582 890 596'},
  // brain stem
  {d: 'M 660 544 C 682 540 706 542 732 548'},
  {d: 'M 656 604 C 678 600 702 602 726 608'},
  // shorter cross-running folds, so the frontal and parietal crowns are not
  // just a stack of parallel arcs
  {d: 'M 380 200 C 392 244 404 286 420 322'},
  {d: 'M 288 240 C 306 276 322 312 336 348'},
  {d: 'M 250 268 C 320 236 400 216 484 208'},
  {d: 'M 232 348 C 256 370 278 386 302 398'},
  {d: 'M 744 200 C 760 246 772 296 776 344'},
  {d: 'M 858 300 C 880 330 896 362 904 396'},
  {d: 'M 500 440 C 516 462 530 484 540 508'},
  {d: 'M 300 214 C 318 238 334 264 346 292'},
];

const BRAIN: Variant = {
  palette: {
    bg: '#020F06',
    line: '#1A6B33',
    fill: '#05200E',
    text: '#8FE8A8',
    particle: '#3FFF7A',
    particleHot: '#E8FFEC',
    sweep: '#C4FFD4',
    accent: '#2ED44F',
  },
  silhouette: {
    vb: [1200, 900],
    fit: [166, 138, 782, 588],
    fills: [
      {d: BRAIN_CEREBRUM},
      {d: BRAIN_CEREBELLUM},
      {d: BRAIN_STEM},
    ],
    lines: [
      {d: BRAIN_CEREBRUM},
      {d: BRAIN_CEREBELLUM},
      {d: BRAIN_STEM},
      ...BRAIN_SULCI,
    ],
    creaseW: 2.2,
    clusters: [],
    light: [-1, -0.5],
    axis: [1, 0],
  },
  density: {
    target: 5200,
    falloff: 4.5,
    flat: 0.02,
    grid: 8,
    sizeMin: 3,
    sizeMax: 9,
    gradLo: 0.55,
    gradHi: 1,
  },
  motion: {
    // No sweep at all. Pulses originate at random points and travel ALONG the
    // folds, branching wherever folds meet.
    mode: 'propagate',
    pulses: 44,
    lifeMin: 40,
    lifeMax: 70,
    decay: 20,
    spread: 420,
    gain: 1.9,
  },
  readouts: {
    top: [
      {label: 'EEG ALPHA', unit: 'HZ', lo: 8, hi: 13, dp: 1},
      {label: 'EEG BETA', unit: 'HZ', lo: 13, hi: 30, dp: 1},
      {label: 'EEG THETA', unit: 'HZ', lo: 4, hi: 8, dp: 1},
      {label: 'EEG DELTA', unit: 'HZ', lo: 1, hi: 4, dp: 1},
      {label: 'SYNAPSE CNT', unit: 'M', lo: 1200, hi: 9800, dp: 0},
      {label: 'FIRING RATE', unit: 'HZ', lo: 20, hi: 140, dp: 0},
      {label: 'HEMI BALANCE', unit: '%', lo: 42, hi: 58, dp: 0},
      {label: 'CORTEX TEMP', unit: 'C', lo: 36, hi: 38, dp: 1},
    ],
    wave: {label: 'EEG TRACE', sub: 'CH_F3P4', energy: 0.95},
    table: {
      label: 'REGION ACTIVITY',
      tags: [
        'FRT', 'PAR', 'TMP', 'OCC', 'CBL', 'STM', 'HIP', 'AMY',
        'THL', 'INS', 'CNG', 'PFC', 'MTR', 'SMT', 'AUD', 'VIS',
        'BRO', 'WER', 'SNG', 'PUT', 'PAL', 'CAU', 'NAC', 'VTA',
      ],
    },
    numA: {label: 'SYNAPSE COUNT M', unit: '', lo: 100, hi: 999, dp: 0},
    numB: {label: 'SIGNAL LATENCY MS', unit: '', lo: 100, hi: 999, dp: 0},
    grid: {
      label: 'FREQUENCY BANDS',
      tags: ['ALPHA', 'BETA', 'THETA', 'DELTA', 'GAMMA', 'MU RHYTHM'],
    },
    meters: {
      label: 'CORTICAL CHANNELS',
      tags: ['F3', 'F4', 'C3', 'C4', 'P3', 'P4', 'O1', 'O2', 'T3', 'T4', 'FZ', 'CZ'],
    },
    radar: [
      {label: 'HEMISPHERE BALANCE', sub: 'L-HEM', turns: 3},
      {label: 'HEMISPHERE BALANCE', sub: 'R-HEM', turns: 5},
    ],
    scroll: {
      label: 'SPIKE TRAIN LOG',
      tokens: ['SPK', 'BST', 'INH', 'EXC', 'LTP', 'LTD', 'REF', 'SYN', 'AXN', 'DND'],
    },
    strips: [
      {label: 'ALP', unit: '', lo: 0, hi: 100, dp: 0},
      {label: 'BET', unit: '', lo: 0, hi: 100, dp: 0},
      {label: 'THT', unit: '', lo: 0, hi: 100, dp: 0},
    ],
    hist: {label: 'SPECTRAL POWER'},
    numerals: {label: 'SPIKE RASTER'},
    status: {
      label: 'NEURAL MONITOR STATE',
      states: ['BASELINE', 'PROPAGATING', 'SYNCHRONY', 'CONSOLIDATE'],
    },
  },
};

/* #endregion variant:brain */

export const VARIANTS: Record<VariantKey, Variant> = {
  /* #region register:car */
  car: CAR,
  /* #endregion register:car */
  /* #region register:jet */
  jet: JET,
  /* #endregion register:jet */
  /* #region register:brain */
  brain: BRAIN,
  /* #endregion register:brain */
} as Record<VariantKey, Variant>;
