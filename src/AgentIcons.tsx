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
  | 'globe'
  | 'gear'
  | 'cube'
  | 'documents'
  | 'shieldCheck'
  | 'chat'
  | 'avatar'
  | 'folder'
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
              <stop offset="0%" stopColor={glow} stopOpacity={0.34} />
              <stop offset="55%" stopColor={glow} stopOpacity={0.14} />
              <stop offset="100%" stopColor={glow} stopOpacity={0} />
            </radialGradient>
          </defs>
          <circle cx={cx} cy={cy} r={size * 1.55} fill={`url(#halo-${uid})`} />
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
   COMPOSITION
   ════════════════════════════════════════════════════════════════════════ */

export type AgentIconsProps = {
  variant: Variant;
};

export const AgentIcons: React.FC<AgentIconsProps> = ({variant}) => {
  const v: VariantSpec = VARIANTS[variant];
  const p = v.palette;
  const chip = useEntrance(0);
  const slots = SCATTER_SLOTS;

  return (
    <AbsoluteFill style={{backgroundColor: p.bg}}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="geometricPrecision"
      >
        {/* satellites — cascade outward from the chip */}
        {v.icons.map((spec, i) => (
          <SatelliteIcon
            key={`${variant}-icon-${i}`}
            spec={spec}
            slot={slots[i]}
            v={v}
            delay={(scatterRank[i] + 1) * STAGGER}
            seed={`${variant}-icon-${i}`}
            uid={`${variant}-${i}`}
          />
        ))}

        {/* sparkles last */}
        {SPARKLE_SLOTS.map((slot, i) => (
          <Sparkle
            key={`${variant}-spark-${i}`}
            slot={slot}
            kind={v.sparkles.kind}
            color={p[v.sparkles.colors[i % v.sparkles.colors.length]]}
            delay={(slots.length + 1 + i) * STAGGER}
            seed={`${variant}-spark-${i}`}
            idleAmp={v.idleAmp}
          />
        ))}

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
