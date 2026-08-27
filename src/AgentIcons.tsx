import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

/* ════════════════════════════════════════════════════════════════════════
   CANVAS + STYLE CONSTANTS
   ════════════════════════════════════════════════════════════════════════ */

/** Design canvas. Every number in this file is expressed in these units. */
export const W = 3840;
export const H = 2160;
const CX = W / 2;
const CY = H / 2;

/** Stroke weight at 4K. Round caps + joins everywhere. */
export const STROKE = 7;

/** Centre chip side length — ~15% of frame height. */
const CHIP = 324;

/** Clean geometric sans, resolved from fonts that ship with the renderer. */
const FONT = '"Liberation Sans", "Helvetica Neue", Helvetica, Arial, sans-serif';

/* Timing — 300 frames @ 30fps */
const CASCADE_START = 12;
const STAGGER = 5;
const IDLE_START = 120;
const IDLE_LEN = 180;

/** Periods that divide evenly into the idle section, so every element is
 *  back at its starting phase on the last frame. */
const IDLE_PERIODS = [30, 36, 45, 60, 90].filter((n) => IDLE_LEN % n === 0);

const SPRING_CONFIG = {damping: 13, stiffness: 95} as const;

/* ════════════════════════════════════════════════════════════════════════
   VARIANTS — the single source of truth for palette, label, icons, layout.
   No hex literal, no chip label and no icon list exists anywhere else.
   ════════════════════════════════════════════════════════════════════════ */

export type LayoutMode = 'scatter' | 'grid';
export type SparkleKind = 'star' | 'tick';

export type IconName =
  /* light — general agent domain */
  | 'globe'
  | 'gear'
  | 'cube'
  | 'documents'
  | 'shieldCheck'
  | 'chat'
  | 'avatar'
  | 'folder'
  /* dark — security domain */
  | 'padlock'
  | 'key'
  | 'fingerprint'
  | 'firewall'
  | 'alert'
  | 'eye'
  | 'shieldKeyhole'
  | 'bug'
  /* warm — data domain */
  | 'database'
  | 'barChart'
  | 'pieChart'
  | 'lineGraph'
  | 'cloud'
  | 'funnel'
  | 'tableGrid'
  | 'arrowUp'
  /* shared */
  | 'chipEcho';

export type Palette = {
  bg: string;
  chipFill: string;
  chipText: string;
  trace: string;
} & Record<string, string>;

export type IconSpec = {
  /** Which glyph <SatelliteIcon> should switch to. */
  name: IconName;
  /** Palette key for the primary colour. */
  color: string;
  /** Palette key for a secondary colour, where the glyph uses one. */
  accent?: string;
};

export type VariantSpec = {
  layout: LayoutMode;
  label: [string, string];
  palette: Palette;
  icons: IconSpec[];
  sparkles: {kind: SparkleKind; colors: string[]};
  /** Idle bob amplitude in canvas units. */
  idleAmp: number;
  /** Idle rotation amplitude in degrees. */
  idleRot: number;
  /** Palette key of a soft halo drawn behind the centre chip, or null. */
  chipGlow: string | null;
  /** Palette key for the grid connector traces, or null when there are none. */
  connector: string | null;
};

export const VARIANTS = {
  light: {
    layout: 'scatter',
    label: ['AI', 'Agent'],
    palette: {
      bg: '#FFFFFF',
      chipFill: '#1B62D4',
      chipText: '#FFFFFF',
      trace: '#1B62D4',
      red: '#E8334A',
      violet: '#9B2FE0',
      amber: '#F5A623',
      cyan: '#3FA8E8',
      green: '#22B85F',
      pink: '#F55A9B',
      blue: '#1B62D4',
    },
    icons: [
      {name: 'globe', color: 'red'},
      {name: 'gear', color: 'violet'},
      {name: 'cube', color: 'cyan'},
      {name: 'documents', color: 'blue'},
      {name: 'shieldCheck', color: 'blue', accent: 'green'},
      {name: 'chat', color: 'amber'},
      {name: 'avatar', color: 'red'},
      {name: 'folder', color: 'amber'},
      {name: 'chipEcho', color: 'blue'},
    ],
    sparkles: {
      kind: 'star',
      colors: ['pink', 'cyan', 'pink', 'violet', 'violet', 'cyan'],
    },
    idleAmp: 14,
    idleRot: 2,
    chipGlow: null,
    connector: null,
  },

  dark: {
    layout: 'scatter',
    label: ['AI', 'Agent'],
    palette: {
      bg: '#14161A',
      chipFill: '#C4F52E',
      chipText: '#14161A',
      trace: '#C4F52E',
      coral: '#FF5C4D',
      lime: '#C4F52E',
      grey: '#7A8290',
      white: '#E8ECF2',
      amber: '#FFB020',
    },
    icons: [
      {name: 'padlock', color: 'lime'},
      {name: 'key', color: 'grey'},
      {name: 'fingerprint', color: 'white'},
      {name: 'firewall', color: 'coral'},
      {name: 'alert', color: 'coral'},
      {name: 'eye', color: 'grey'},
      {name: 'shieldKeyhole', color: 'lime'},
      {name: 'bug', color: 'grey'},
      {name: 'chipEcho', color: 'lime'},
    ],
    sparkles: {
      kind: 'tick',
      colors: ['grey', 'lime', 'grey', 'grey', 'lime', 'grey'],
    },
    idleAmp: 14,
    idleRot: 2,
    chipGlow: 'lime',
    connector: null,
  },

  warm: {
    layout: 'grid',
    label: ['DATA', 'HUB'],
    palette: {
      bg: '#F2EAD9',
      chipFill: '#1F5E5B',
      chipText: '#F2EAD9',
      trace: '#1F5E5B',
      terracotta: '#C4553A',
      olive: '#6B7A3A',
      mustard: '#D99A2B',
      teal: '#1F5E5B',
      brown: '#7A5540',
    },
    icons: [
      {name: 'database', color: 'teal'},
      {name: 'barChart', color: 'mustard'},
      {name: 'pieChart', color: 'terracotta'},
      {name: 'lineGraph', color: 'olive'},
      {name: 'cloud', color: 'teal'},
      {name: 'funnel', color: 'mustard'},
      {name: 'tableGrid', color: 'brown'},
      {name: 'arrowUp', color: 'olive'},
    ],
    sparkles: {kind: 'star', colors: []},
    idleAmp: 5,
    idleRot: 0,
    chipGlow: null,
    connector: 'teal',
  },
} satisfies Record<string, VariantSpec>;

export type Variant = keyof typeof VARIANTS;

/* ════════════════════════════════════════════════════════════════════════
   LAYOUT TABLES
   ════════════════════════════════════════════════════════════════════════ */

export type Slot = {x: number; y: number; size: number};

/**
 * Loose scatter — deliberately uneven distances and angles. Index order
 * matches the variant icon list; cascade order is derived from distance.
 */
const SCATTER_SLOTS: Slot[] = [
  {x: 720, y: 690, size: 336},
  {x: 1370, y: 322, size: 300},
  {x: 2060, y: 268, size: 282},
  {x: 2680, y: 424, size: 316},
  {x: 3180, y: 880, size: 328},
  {x: 700, y: 1320, size: 336},
  {x: 3060, y: 1530, size: 336},
  {x: 2400, y: 1870, size: 304},
  {x: 1300, y: 1650, size: Math.round(CHIP * 0.6)},
];

/** Sparkle / scan-tick positions — shared by every scatter variant. */
const SPARKLE_SLOTS: (Slot & {angle: number})[] = [
  {x: 1124, y: 1030, size: 78, angle: -18},
  {x: 2896, y: 452, size: 62, angle: 34},
  {x: 792, y: 1902, size: 84, angle: 12},
  {x: 3084, y: 1988, size: 70, angle: -42},
  {x: 1762, y: 1808, size: 66, angle: 58},
  {x: 2528, y: 1174, size: 58, angle: -8},
];

const dist = (s: Slot) => Math.hypot(s.x - CX, s.y - CY);

/** Cascade rank per slot index — nearest the chip goes first. */
const scatterRank = (() => {
  const order = SCATTER_SLOTS.map((s, i) => ({i, d: dist(s)}))
    .sort((a, b) => a.d - b.d)
    .map((o) => o.i);
  const rank: number[] = new Array(SCATTER_SLOTS.length).fill(0);
  order.forEach((slotIndex, position) => {
    rank[slotIndex] = position;
  });
  return rank;
})();

/* ── GRID layout ──────────────────────────────────────────────────────────
   A genuine second layout branch: a regular 3x3 grid with the chip holding
   the centre cell, and right-angle circuit traces joining each cell to it. */

const GRID_COLS = [640, CX, 3200];
const GRID_ROWS = [400, CY, 1760];
const GRID_ICON = 360;
const GRID_HALF = GRID_ICON / 2;
/** Traces stop just short of the glyph rather than at the cell box edge. */
const GRID_PORT = GRID_HALF * 0.84;
/** Where a trace leaves the chip — just clear of its outermost pin dots. */
const CHIP_PORT = 260;
/** Half the gutter, used as the turning column for the corner traces. */
const GRID_TURN_X = [1250, 2590];
const CORNER_R = 34;

/** Eight cells in reading order, centre cell (the chip) skipped. */
const GRID_SLOTS: Slot[] = [
  {x: GRID_COLS[0], y: GRID_ROWS[0], size: GRID_ICON},
  {x: GRID_COLS[1], y: GRID_ROWS[0], size: GRID_ICON},
  {x: GRID_COLS[2], y: GRID_ROWS[0], size: GRID_ICON},
  {x: GRID_COLS[0], y: GRID_ROWS[1], size: GRID_ICON},
  {x: GRID_COLS[2], y: GRID_ROWS[1], size: GRID_ICON},
  {x: GRID_COLS[0], y: GRID_ROWS[2], size: GRID_ICON},
  {x: GRID_COLS[1], y: GRID_ROWS[2], size: GRID_ICON},
  {x: GRID_COLS[2], y: GRID_ROWS[2], size: GRID_ICON},
];

export type Pt = {x: number; y: number};

/**
 * Corner points per trace. Every segment is horizontal or vertical — the
 * corner cells turn twice, through the gutter, so no trace ever crosses a
 * neighbouring cell.
 */
const GRID_ROUTES: Pt[][] = [
  /* top-left    */ [
    {x: CX - CHIP_PORT, y: CY - 70},
    {x: GRID_TURN_X[0], y: CY - 70},
    {x: GRID_TURN_X[0], y: GRID_ROWS[0]},
    {x: GRID_COLS[0] + GRID_PORT, y: GRID_ROWS[0]},
  ],
  /* top         */ [
    {x: CX, y: CY - CHIP_PORT},
    {x: CX, y: GRID_ROWS[0] + GRID_PORT},
  ],
  /* top-right   */ [
    {x: CX + CHIP_PORT, y: CY - 70},
    {x: GRID_TURN_X[1], y: CY - 70},
    {x: GRID_TURN_X[1], y: GRID_ROWS[0]},
    {x: GRID_COLS[2] - GRID_PORT, y: GRID_ROWS[0]},
  ],
  /* left        */ [
    {x: CX - CHIP_PORT, y: CY},
    {x: GRID_COLS[0] + GRID_PORT, y: CY},
  ],
  /* right       */ [
    {x: CX + CHIP_PORT, y: CY},
    {x: GRID_COLS[2] - GRID_PORT, y: CY},
  ],
  /* bottom-left */ [
    {x: CX - CHIP_PORT, y: CY + 70},
    {x: GRID_TURN_X[0], y: CY + 70},
    {x: GRID_TURN_X[0], y: GRID_ROWS[2]},
    {x: GRID_COLS[0] + GRID_PORT, y: GRID_ROWS[2]},
  ],
  /* bottom      */ [
    {x: CX, y: CY + CHIP_PORT},
    {x: CX, y: GRID_ROWS[2] - GRID_PORT},
  ],
  /* bottom-right*/ [
    {x: CX + CHIP_PORT, y: CY + 70},
    {x: GRID_TURN_X[1], y: CY + 70},
    {x: GRID_TURN_X[1], y: GRID_ROWS[2]},
    {x: GRID_COLS[2] - GRID_PORT, y: GRID_ROWS[2]},
  ],
];

/** Replace each corner with a quadratic fillet, sampled into a polyline so
 *  the drawn path and the travelling dots share one source of truth. */
const filletPolyline = (pts: Pt[], r: number, seg = 12): Pt[] => {
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const p = pts[i];
    const b = pts[i + 1];
    const d1 = Math.hypot(a.x - p.x, a.y - p.y);
    const d2 = Math.hypot(b.x - p.x, b.y - p.y);
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const s1 = {x: p.x + ((a.x - p.x) / d1) * rr, y: p.y + ((a.y - p.y) / d1) * rr};
    const s2 = {x: p.x + ((b.x - p.x) / d2) * rr, y: p.y + ((b.y - p.y) / d2) * rr};
    out.push(s1);
    for (let k = 1; k < seg; k++) {
      const t = k / seg;
      const u = 1 - t;
      out.push({
        x: u * u * s1.x + 2 * u * t * p.x + t * t * s2.x,
        y: u * u * s1.y + 2 * u * t * p.y + t * t * s2.y,
      });
    }
    out.push(s2);
  }
  out.push(pts[pts.length - 1]);
  return out;
};

export type Trace = {d: string; pts: Pt[]; cum: number[]; total: number};

const buildTrace = (route: Pt[]): Trace => {
  const pts = filletPolyline(route, CORNER_R);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const d = pts
    .map((q, i) => `${i === 0 ? 'M' : 'L'}${q.x.toFixed(2)} ${q.y.toFixed(2)}`)
    .join(' ');
  return {d, pts, cum, total: cum[cum.length - 1]};
};

const GRID_TRACES: Trace[] = GRID_ROUTES.map(buildTrace);

/** Point at a normalised distance along a trace. */
const pointAt = (tr: Trace, t: number): Pt => {
  const target = Math.max(0, Math.min(1, t)) * tr.total;
  let i = 1;
  while (i < tr.cum.length - 1 && tr.cum[i] < target) i++;
  const span = tr.cum[i] - tr.cum[i - 1] || 1;
  const f = (target - tr.cum[i - 1]) / span;
  const a = tr.pts[i - 1];
  const b = tr.pts[i];
  return {x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f};
};

/* Grid cascade: the hub wires itself up, one trace at a time. */
const TRACE_START = 22;
const TRACE_GAP = 11;
const TRACE_DRAW = 10;
/** Travelling-dot radius and the frames over which the dots fade in. */
const DOT_R = 13;
const DOT_FADE = 15;

/* ════════════════════════════════════════════════════════════════════════
   MOTION HELPERS
   ════════════════════════════════════════════════════════════════════════ */

/** Spring-in from 0.75 with a delay, plus the opacity gate that keeps the
 *  frame empty before the element's turn. */
const useEntrance = (delay: number) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({
    frame: frame - (CASCADE_START + delay),
    fps,
    config: SPRING_CONFIG,
  });
  return {
    scale: 0.75 + 0.25 * s,
    opacity: interpolate(s, [0, 0.35], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  };
};

/**
 * Tiny closed elliptical path with a seeded phase and a period that divides
 * evenly into the 180-frame idle section, so the idle loop is internally
 * consistent. Runs continuously so it is already in phase at frame 120.
 */
const idleBob = (seed: string, frame: number, amp: number, rotAmp: number) => {
  if (amp === 0 && rotAmp === 0) {
    return {bx: 0, by: 0, rot: 0};
  }
  const period = IDLE_PERIODS[Math.floor(random(`${seed}:p`) * IDLE_PERIODS.length)];
  const phase = random(`${seed}:h`) * Math.PI * 2;
  const t = phase + (Math.PI * 2 * (frame - IDLE_START)) / period;
  const ax = amp * (0.55 + 0.45 * random(`${seed}:ax`));
  const ay = amp * (0.55 + 0.45 * random(`${seed}:ay`));
  return {
    bx: ax * Math.cos(t),
    by: ay * Math.sin(t),
    rot: rotAmp * Math.sin(t + phase),
  };
};

/* ════════════════════════════════════════════════════════════════════════
   GEOMETRY HELPERS (pure, evaluated once at module load)
   ════════════════════════════════════════════════════════════════════════ */

const polar = (r: number, deg: number, cx = 50, cy = 50) => {
  const a = (deg * Math.PI) / 180;
  return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
};

/** Eight-tooth gear silhouette with an evenodd centre hole. */
const GEAR_PATH = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const base = i * 45 - 90;
    pts.push(polar(45, base - 12));
    pts.push(polar(45, base + 12));
    pts.push(polar(33, base + 20));
    pts.push(polar(33, base + 25));
  }
  const outer = `M${pts.join(' L')} Z`;
  const hole = 'M64 50 A14 14 0 1 0 36 50 A14 14 0 1 0 64 50 Z';
  return `${outer} ${hole}`;
})();

const STAR_PATH =
  'M50 8 C53.5 35 65 46.5 92 50 C65 53.5 53.5 65 50 92 ' +
  'C46.5 65 35 53.5 8 50 C35 46.5 46.5 35 50 8 Z';

/* ════════════════════════════════════════════════════════════════════════
   <CentreChip> — also reused, at 60%, as the outline-only chip echo.
   ════════════════════════════════════════════════════════════════════════ */

type CentreChipProps = {
  cx: number;
  cy: number;
  size: number;
  label: [string, string];
  fill: string;
  textFill: string;
  trace: string;
  /** Outline-only echo: stroked body, background fill, coloured text. */
  outline: boolean;
  glow?: string | null;
  uid: string;
};

export const CentreChip: React.FC<CentreChipProps> = ({
  cx,
  cy,
  size,
  label,
  fill,
  textFill,
  trace,
  outline,
  glow,
  uid,
}) => {
  const half = size / 2;
  const stub = size * 0.16;
  const dot = size * 0.046;
  const perEdge = 6;
  const font = size * 0.205;

  const pins: React.ReactNode[] = [];
  for (let e = 0; e < 4; e++) {
    for (let i = 0; i < perEdge; i++) {
      const t = 0.12 + (0.76 * i) / (perEdge - 1);
      const along = -half + size * t;
      let x1 = 0;
      let y1 = 0;
      let x2 = 0;
      let y2 = 0;
      let dx = 0;
      let dy = 0;
      if (e === 0) {
        x1 = along; y1 = -half; x2 = along; y2 = -half - stub; dy = -1;
      } else if (e === 1) {
        x1 = half; y1 = along; x2 = half + stub; y2 = along; dx = 1;
      } else if (e === 2) {
        x1 = along; y1 = half; x2 = along; y2 = half + stub; dy = 1;
      } else {
        x1 = -half; y1 = along; x2 = -half - stub; y2 = along; dx = -1;
      }
      pins.push(
        <g key={`${e}-${i}`}>
          <line x1={cx + x1} y1={cy + y1} x2={cx + x2} y2={cy + y2} />
          <circle cx={cx + x2 + dx * dot} cy={cy + y2 + dy * dot} r={dot} />
        </g>
      );
    }
  }

  return (
    <g>
      {glow ? (
        <>
          <defs>
            <radialGradient id={`halo-${uid}`}>
              <stop offset="0%" stopColor={glow} stopOpacity={0.17} />
              <stop offset="28%" stopColor={glow} stopOpacity={0.1} />
              <stop offset="60%" stopColor={glow} stopOpacity={0.035} />
              <stop offset="100%" stopColor={glow} stopOpacity={0} />
            </radialGradient>
          </defs>
          <circle cx={cx} cy={cy} r={size * 2.35} fill={`url(#halo-${uid})`} />
        </>
      ) : null}

      {/* pin traces */}
      <g
        fill="none"
        stroke={trace}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {pins}
      </g>

      {/* body */}
      <rect
        x={cx - half}
        y={cy - half}
        width={size}
        height={size}
        rx={size * 0.13}
        fill={outline ? textFill : fill}
        stroke={outline ? trace : 'none'}
        strokeWidth={outline ? STROKE : 0}
      />

      <text
        x={cx}
        y={cy - size * 0.135}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={FONT}
        fontSize={font}
        fontWeight={700}
        fill={outline ? trace : textFill}
      >
        {label[0]}
      </text>
      <text
        x={cx}
        y={cy + size * 0.135}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={FONT}
        fontSize={font}
        fontWeight={700}
        fill={outline ? trace : textFill}
      >
        {label[1]}
      </text>
    </g>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   <SatelliteIcon> — one component, one switch, twelve glyphs.
   Glyphs are authored inside a 100×100 box and scaled by the caller, so
   `sw` is the stroke width that lands on exactly STROKE px at 4K.
   ════════════════════════════════════════════════════════════════════════ */

type GlyphProps = {
  name: IconName;
  c: string;
  a: string;
  bg: string;
  sw: number;
  uid: string;
};

const Glyph: React.FC<GlyphProps> = ({name, c, a, bg, sw, uid}) => {
  const line = {
    fill: 'none',
    stroke: c,
    strokeWidth: sw,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;

  switch (name) {
    case 'globe':
      return (
        <g {...line}>
          <circle cx={50} cy={50} r={38} />
          <ellipse cx={50} cy={50} rx={16} ry={38} />
          <line x1={50} y1={12} x2={50} y2={88} />
          <line x1={12} y1={50} x2={88} y2={50} />
          <line x1={17.1} y1={31} x2={82.9} y2={31} />
          <line x1={17.1} y1={69} x2={82.9} y2={69} />
        </g>
      );

    case 'gear':
      return <path d={GEAR_PATH} fill={c} fillRule="evenodd" />;

    case 'cube':
      return (
        <g>
          {/* two tones only: light top face over a solid body */}
          <path d="M16 33 L50 52 L50 88 L16 69 Z" fill={c} />
          <path d="M84 33 L50 52 L50 88 L84 69 Z" fill={c} />
          <path d="M50 14 L84 33 L50 52 L16 33 Z" fill={c} fillOpacity={0.45} />
        </g>
      );

    case 'documents':
      return (
        <g {...line}>
          <rect x={19} y={13} width={46} height={60} rx={5} />
          <path d="M31 25 H65 L82 42 V87 H31 Z" fill={bg} />
          <path d="M65 25 V42 H82" />
          <line x1={41} y1={55} x2={72} y2={55} />
          <line x1={41} y1={67} x2={72} y2={67} />
          <line x1={41} y1={79} x2={62} y2={79} />
        </g>
      );

    case 'shieldCheck':
      return (
        <g>
          <path
            d="M50 10 L84 23 V52 C84 72 67 85 50 92 C33 85 16 72 16 52 V23 Z"
            fill={c}
          />
          <path
            d="M34 51 L45.5 62.5 L67 40"
            fill="none"
            stroke={a}
            strokeWidth={sw * 1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );

    case 'chat':
      return (
        <g>
          <path
            d="M34 18 H66 A16 16 0 0 1 82 34 V52 A16 16 0 0 1 66 68 H46 L26 86 L32 68 A16 16 0 0 1 18 52 V34 A16 16 0 0 1 34 18 Z"
            {...line}
          />
          <circle cx={34} cy={43} r={5} fill={c} />
          <circle cx={50} cy={43} r={5} fill={c} />
          <circle cx={66} cy={43} r={5} fill={c} />
        </g>
      );

    case 'avatar':
      return (
        <g>
          <defs>
            <clipPath id={`av-${uid}`}>
              <circle cx={50} cy={50} r={42} />
            </clipPath>
          </defs>
          <circle cx={50} cy={50} r={42} fill={c} />
          <g clipPath={`url(#av-${uid})`} fill={bg}>
            <circle cx={50} cy={39} r={14} />
            <path d="M50 57 C68 57 81 70 81 98 H19 C19 70 32 57 50 57 Z" />
          </g>
        </g>
      );

    case 'folder':
      return (
        <g>
          <path
            d="M20 22 H40 L48 33 H80 A7 7 0 0 1 87 40 V77 A7 7 0 0 1 80 84 H20 A7 7 0 0 1 13 77 V29 A7 7 0 0 1 20 22 Z"
            fill={c}
          />
          <g
            fill="none"
            stroke={bg}
            strokeWidth={sw}
            strokeLinecap="round"
          >
            <line x1={26} y1={49} x2={64} y2={49} />
            <line x1={26} y1={60} x2={64} y2={60} />
            <line x1={26} y1={71} x2={52} y2={71} />
          </g>
        </g>
      );

    /* ── security domain ─────────────────────────────────────────── */

    case 'padlock':
      return (
        <g>
          <path
            d="M32 50 V36 A18 18 0 0 1 68 36 V50"
            fill="none"
            stroke={c}
            strokeWidth={sw * 1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x={19} y={46} width={62} height={44} rx={9} fill={c} />
          <g fill={bg}>
            <circle cx={50} cy={62} r={6.5} />
            <path d="M46.6 66 L44.5 80 H55.5 L53.4 66 Z" />
          </g>
        </g>
      );

    case 'key':
      return (
        <g {...line}>
          <circle cx={29} cy={50} r={18} />
          <circle cx={29} cy={50} r={6.5} />
          <line x1={47} y1={50} x2={90} y2={50} />
          <line x1={74} y1={50} x2={74} y2={65} />
          <line x1={86} y1={50} x2={86} y2={60} />
        </g>
      );

    case 'fingerprint':
      return (
        <g {...line}>
          <path d="M12 60 A 38 42 0 0 1 88 60" />
          <path d="M12 60 V76" />
          <path d="M88 60 V76" />
          <path d="M21 62 A 29 33 0 0 1 79 62" />
          <path d="M21 62 V72" />
          <path d="M79 62 V72" />
          <path d="M30 64 A 20 24 0 0 1 70 64" />
          <path d="M39 66 A 11 15 0 0 1 61 66" />
          <path d="M47 68 A 3 5 0 0 1 53 68" />
        </g>
      );

    case 'firewall':
      return (
        <g {...line}>
          <rect x={11} y={23} width={78} height={56} rx={6} />
          <line x1={11} y1={41.7} x2={89} y2={41.7} />
          <line x1={11} y1={60.3} x2={89} y2={60.3} />
          <line x1={37} y1={23} x2={37} y2={41.7} />
          <line x1={63} y1={23} x2={63} y2={41.7} />
          <line x1={24} y1={41.7} x2={24} y2={60.3} />
          <line x1={50} y1={41.7} x2={50} y2={60.3} />
          <line x1={76} y1={41.7} x2={76} y2={60.3} />
          <line x1={37} y1={60.3} x2={37} y2={79} />
          <line x1={63} y1={60.3} x2={63} y2={79} />
        </g>
      );

    case 'alert':
      return (
        <g>
          <path
            d="M43.4 15 A8 8 0 0 1 56.6 15 L88 79 A8 8 0 0 1 81 91 H19 A8 8 0 0 1 12 79 Z"
            fill={c}
          />
          <g fill={bg}>
            <rect x={45} y={38} width={10} height={28} rx={5} />
            <circle cx={50} cy={78} r={5.6} />
          </g>
        </g>
      );

    case 'eye':
      return (
        <g {...line}>
          <path d="M10 50 C28 24 72 24 90 50 C72 76 28 76 10 50 Z" />
          <circle cx={50} cy={50} r={12.5} fill={c} />
          <line x1={1} y1={50} x2={6} y2={50} />
          <line x1={94} y1={50} x2={99} y2={50} />
        </g>
      );

    case 'shieldKeyhole':
      return (
        <g {...line}>
          <path d="M50 10 L84 23 V52 C84 72 67 85 50 92 C33 85 16 72 16 52 V23 Z" />
          <circle cx={50} cy={45} r={8.5} />
          <line x1={50} y1={53.5} x2={50} y2={69} />
        </g>
      );

    case 'bug':
      return (
        <g>
          <ellipse cx={50} cy={57} rx={22} ry={27} fill={c} />
          <circle cx={50} cy={29} r={11.5} fill={c} />
          <g
            fill="none"
            stroke={c}
            strokeWidth={sw}
            strokeLinecap="round"
          >
            <path d="M43 21 L36 10" />
            <path d="M57 21 L64 10" />
            <path d="M29 43 L12 34" />
            <path d="M28 57 L8 57" />
            <path d="M29 71 L12 81" />
            <path d="M71 43 L88 34" />
            <path d="M72 57 L92 57" />
            <path d="M71 71 L88 81" />
          </g>
        </g>
      );

    /* ── data domain ─────────────────────────────────────────────── */

    case 'database':
      return (
        <g>
          <path d="M18 26 V72 C18 82 32 89 50 89 C68 89 82 82 82 72 V26 Z" fill={c} />
          <ellipse cx={50} cy={26} rx={32} ry={12} fill={c} />
          <g fill="none" stroke={bg} strokeWidth={sw} strokeLinecap="round">
            <ellipse cx={50} cy={26} rx={32} ry={12} />
            <path d="M18 45 C18 55 32 62 50 62 C68 62 82 55 82 45" />
            <path d="M18 62 C18 72 32 79 50 79 C68 79 82 72 82 62" />
          </g>
        </g>
      );

    case 'barChart':
      return (
        <g fill={c}>
          <rect x={16} y={56} width={19} height={33} rx={4} />
          <rect x={40} y={36} width={19} height={53} rx={4} />
          <rect x={64} y={14} width={19} height={75} rx={4} />
        </g>
      );

    case 'pieChart':
      return (
        <g fill={c}>
          <path d="M50 50 L50 12 A38 38 0 1 1 12 50 Z" />
          <g transform="translate(-9 -9)">
            <path d="M50 50 L12 50 A38 38 0 0 1 50 12 Z" />
          </g>
        </g>
      );

    case 'lineGraph':
      return (
        <g>
          <path
            d="M16 12 V84 H88"
            fill="none"
            stroke={c}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M27 73 L45 56 L61 63 L81 30"
            fill="none"
            stroke={c}
            strokeWidth={sw * 1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <g fill={c}>
            <circle cx={27} cy={73} r={5} />
            <circle cx={45} cy={56} r={5} />
            <circle cx={61} cy={63} r={5} />
            <circle cx={81} cy={30} r={5} />
          </g>
        </g>
      );

    case 'cloud':
      return (
        <g {...line}>
          <path d="M28 74 A19 19 0 0 1 30 38 A22 22 0 0 1 70 42 A17 17 0 0 1 74 74 Z" />
        </g>
      );

    case 'funnel':
      return <path d="M11 20 H89 L57 57 V83 L43 92 V57 Z" fill={c} />;

    case 'tableGrid':
      return (
        <g {...line}>
          <rect x={12} y={17} width={76} height={66} rx={7} />
          <path
            d="M12 24 A7 7 0 0 1 19 17 H81 A7 7 0 0 1 88 24 V36 H12 Z"
            fill={c}
            stroke="none"
          />
          <line x1={12} y1={36} x2={88} y2={36} />
          <line x1={12} y1={59.5} x2={88} y2={59.5} />
          <line x1={37.3} y1={36} x2={37.3} y2={83} />
          <line x1={62.7} y1={36} x2={62.7} y2={83} />
        </g>
      );

    case 'arrowUp':
      return (
        <g>
          <circle cx={50} cy={50} r={40} fill={c} />
          <path d="M50 24 L71 47 H59.5 V75 H40.5 V47 H29 Z" fill={bg} />
        </g>
      );

    case 'chipEcho':
      /* rendered by <SatelliteIcon> directly — never reaches this switch */
      return null;

    default:
      return null;
  }
};

type SatelliteIconProps = {
  spec: IconSpec;
  slot: Slot;
  v: VariantSpec;
  delay: number;
  seed: string;
  uid: string;
};

export const SatelliteIcon: React.FC<SatelliteIconProps> = ({
  spec,
  slot,
  v,
  delay,
  seed,
  uid,
}) => {
  const frame = useCurrentFrame();
  const {scale, opacity} = useEntrance(delay);
  const {bx, by, rot} = idleBob(seed, frame, v.idleAmp, v.idleRot);

  const p = v.palette;
  const c = p[spec.color];
  const a = spec.accent ? p[spec.accent] : c;

  if (spec.name === 'chipEcho') {
    return (
      <g
        opacity={opacity}
        transform={`translate(${slot.x + bx} ${slot.y + by}) rotate(${rot}) scale(${scale})`}
      >
        <CentreChip
          cx={0}
          cy={0}
          size={slot.size}
          label={v.label}
          fill={p.bg}
          textFill={p.bg}
          trace={c}
          outline
          uid={uid}
        />
      </g>
    );
  }

  const k = slot.size / 100;
  return (
    <g
      opacity={opacity}
      transform={
        `translate(${slot.x + bx} ${slot.y + by}) rotate(${rot}) ` +
        `scale(${scale * k}) translate(-50 -50)`
      }
    >
      <Glyph name={spec.name} c={c} a={a} bg={p.bg} sw={STROKE / k} uid={uid} />
    </g>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   <Sparkle> — four-pointed star, or a scan tick in the dark variant.
   ════════════════════════════════════════════════════════════════════════ */

type SparkleProps = {
  slot: Slot & {angle: number};
  kind: SparkleKind;
  color: string;
  delay: number;
  seed: string;
  idleAmp: number;
};

export const Sparkle: React.FC<SparkleProps> = ({
  slot,
  kind,
  color,
  delay,
  seed,
  idleAmp,
}) => {
  const frame = useCurrentFrame();
  const {scale, opacity} = useEntrance(delay);
  const {bx, by} = idleBob(seed, frame, idleAmp * 0.6, 0);

  /* twinkle: 0.85 → 1.15 on a seeded sine that also divides into 180 */
  const period = IDLE_PERIODS[Math.floor(random(`${seed}:tp`) * IDLE_PERIODS.length)];
  const phase = random(`${seed}:tw`) * Math.PI * 2;
  const twinkle =
    1 + 0.15 * Math.sin(phase + (Math.PI * 2 * (frame - IDLE_START)) / period);

  const k = (slot.size / 100) * scale * twinkle;

  return (
    <g
      opacity={opacity}
      transform={
        `translate(${slot.x + bx} ${slot.y + by}) rotate(${slot.angle}) ` +
        `scale(${k}) translate(-50 -50)`
      }
    >
      {kind === 'star' ? (
        <path d={STAR_PATH} fill={color} />
      ) : (
        <line
          x1={14}
          y1={50}
          x2={86}
          y2={50}
          stroke={color}
          strokeWidth={(STROKE / (slot.size / 100)) * 1.6}
          strokeLinecap="round"
        />
      )}
    </g>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   <Connector> — right-angle circuit trace for the grid layout. Draws on via
   stroke-dash, then carries two travelling dots through the idle section.
   ════════════════════════════════════════════════════════════════════════ */

type ConnectorProps = {
  trace: Trace;
  color: string;
  index: number;
  seed: string;
};

export const Connector: React.FC<ConnectorProps> = ({trace, color, index, seed}) => {
  const frame = useCurrentFrame();

  const start = CASCADE_START + TRACE_START + index * TRACE_GAP;
  const progress = interpolate(frame, [start, start + TRACE_DRAW], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const dotOpacity = interpolate(frame, [IDLE_START, IDLE_START + DOT_FADE], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* two dots per line, half a cycle apart, on a period dividing into 180 */
  const period = IDLE_PERIODS[Math.floor(random(`${seed}:dp`) * IDLE_PERIODS.length)];
  const wrap = (x: number) => ((x % 1) + 1) % 1;
  const dots = [0, 0.5].map((off) =>
    pointAt(trace, wrap((frame - IDLE_START) / period + off))
  );

  return (
    <g>
      {progress > 0 ? (
        <path
          d={trace.d}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={trace.total}
          strokeDashoffset={trace.total * (1 - progress)}
        />
      ) : null}
      {dotOpacity > 0
        ? dots.map((q, i) => (
            <circle
              key={i}
              cx={q.x}
              cy={q.y}
              r={DOT_R}
              fill={color}
              opacity={dotOpacity}
            />
          ))
        : null}
    </g>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   COMPOSITION
   ════════════════════════════════════════════════════════════════════════ */

export type AgentIconsProps = {
  variant: Variant;
};

export const AgentIcons: React.FC<AgentIconsProps> = ({variant}) => {
  const v: VariantSpec = VARIANTS[variant];
  const p = v.palette;
  const chip = useEntrance(0);

  const isGrid = v.layout === 'grid';
  const slots = isGrid ? GRID_SLOTS : SCATTER_SLOTS;
  const connectorColor = v.connector ? p[v.connector] : null;
  const showSparkles = !isGrid && v.sparkles.colors.length > 0;

  /* scatter cascades outward from the chip; the grid wires itself up, so an
     icon lands the moment its connector reaches it. */
  const iconDelay = (i: number) =>
    isGrid
      ? TRACE_START + i * TRACE_GAP + TRACE_DRAW
      : (scatterRank[i] + 1) * STAGGER;

  return (
    <AbsoluteFill style={{backgroundColor: p.bg}}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="geometricPrecision"
      >
        {/* connector traces sit under everything */}
        {isGrid && connectorColor
          ? GRID_TRACES.map((tr, i) => (
              <Connector
                key={`${variant}-trace-${i}`}
                trace={tr}
                color={connectorColor}
                index={i}
                seed={`${variant}-trace-${i}`}
              />
            ))
          : null}

        {v.icons.map((spec, i) => (
          <SatelliteIcon
            key={`${variant}-icon-${i}`}
            spec={spec}
            slot={slots[i]}
            v={v}
            delay={iconDelay(i)}
            seed={`${variant}-icon-${i}`}
            uid={`${variant}-${i}`}
          />
        ))}

        {showSparkles
          ? SPARKLE_SLOTS.map((slot, i) => (
              <Sparkle
                key={`${variant}-spark-${i}`}
                slot={slot}
                kind={v.sparkles.kind}
                color={p[v.sparkles.colors[i % v.sparkles.colors.length]]}
                delay={(slots.length + 1 + i) * STAGGER}
                seed={`${variant}-spark-${i}`}
                idleAmp={v.idleAmp}
              />
            ))
          : null}

        {/* the chip itself never moves */}
        <g
          opacity={chip.opacity}
          transform={`translate(${CX} ${CY}) scale(${chip.scale}) translate(${-CX} ${-CY})`}
        >
          <CentreChip
            cx={CX}
            cy={CY}
            size={CHIP}
            label={v.label}
            fill={p.chipFill}
            textFill={p.chipText}
            trace={p.trace}
            outline={false}
            glow={v.chipGlow ? p[v.chipGlow] : null}
            uid={`${variant}-chip`}
          />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
