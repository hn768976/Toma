import { buildFrame, type Frame } from "./geometry";

export type ColorRole = "line" | "bright" | "accent" | "pale";

type Base = { id: string; group: number; color: ColorRole };

export type HatchBlock = Base & {
  kind: "hatch";
  x: number;
  y: number;
  w: number;
  h: number;
  /** Horizontal shift of the top edge relative to the bottom edge, in px. */
  lean: number;
  bars: number;
  /** Bar width as a fraction of the pitch. */
  duty: number;
  /** Frames for the stripes to drift by exactly one pitch. Divides 600. */
  driftPeriod: number;
  /** Bars are drawn in two runs with a wider gap between them. */
  splitAfter: number;
};

export type SolidBar = Base & {
  kind: "bar";
  x: number;
  y: number;
  w: number;
  h: number;
  /** Bright sub-segment, as fractions of the bar width. */
  from: number;
  to: number;
  /** Frames for one breathing cycle of the bright segment. Divides 600. */
  period: number;
};

export type TickRow = Base & {
  kind: "ticks";
  /** Start of the run, on the border line. */
  x: number;
  y: number;
  axis: "h" | "v";
  /** Length of the run along `axis`. */
  span: number;
  /** Tick length, perpendicular to `axis`, signed toward the interior. */
  len: number;
  count: number;
  /** Whole travelling-pulse passes across the run per 600 frames. */
  passes: number;
};

export type PlusMarker = Base & { kind: "plus"; x: number; y: number; size: number };

export type Ring = Base & {
  kind: "ring";
  cx: number;
  cy: number;
  r: number;
  /** Fraction of the circumference left open. */
  gap: number;
  /** Whole turns per 600 frames; sign sets the direction. */
  turns: number;
};

export type Trace = Base & {
  kind: "trace";
  pts: [number, number][];
  /** Indices of `pts` that carry a node dot. */
  dots: number[];
  r: number;
  /** Optional static dash pattern, in px, for a broken run. */
  dash?: [number, number];
};

export type DotPair = Base & {
  kind: "dots";
  pts: [number, number][];
  r: number;
};

export type Triangle = Base & { kind: "tri"; pts: [number, number][] };

export type Element =
  | HatchBlock
  | SolidBar
  | TickRow
  | PlusMarker
  | Ring
  | Trace
  | DotPair
  | Triangle;

/**
 * Every piece of border furniture, generated from fractions of the composition
 * size. Placement is deliberately asymmetric — a HUD should read as designed,
 * not tiled — but nothing here reaches into the middle of the frame, which is
 * left empty for the buyer's own footage.
 */
export const buildLayout = (W: number, H: number): { frame: Frame; elements: Element[] } => {
  const frame = buildFrame(W, H);
  const x = (f: number) => f * W;
  const y = (f: number) => f * H;

  const elements: Element[] = [
    // --- group 0: the two hatched blocks, the loudest elements -------------
    {
      kind: "hatch",
      id: "hatch-tl",
      group: 0,
      color: "line",
      x: x(0.0655),
      y: frame.topLo - y(0.033),
      w: x(0.163),
      h: y(0.033),
      lean: y(0.033) * 0.78,
      bars: 5,
      duty: 0.48,
      driftPeriod: 200,
      splitAfter: 5,
    },
    {
      kind: "hatch",
      id: "hatch-bc",
      group: 0,
      color: "line",
      x: x(0.392),
      y: frame.botHi,
      w: x(0.105),
      h: y(0.03),
      lean: y(0.03) * 0.78,
      bars: 5,
      duty: 0.46,
      driftPeriod: 150,
      splitAfter: 2,
    },

    // --- group 1: solid bar segments and the corner triangle ---------------
    {
      kind: "bar",
      id: "bar-top",
      group: 1,
      color: "bright",
      x: x(0.545),
      y: frame.topHi + y(0.005),
      w: x(0.197),
      h: y(0.017),
      from: 0.08,
      to: 0.6,
      period: 200,
    },
    {
      kind: "bar",
      id: "bar-bottom",
      group: 1,
      color: "bright",
      x: x(0.17),
      y: frame.botHi - y(0.022),
      w: x(0.202),
      h: y(0.017),
      from: 0.22,
      to: 0.68,
      period: 300,
    },
    {
      kind: "tri",
      id: "tri-tr",
      group: 1,
      color: "line",
      pts: [
        [x(0.882), y(0.11)],
        [x(0.9205), y(0.1235)],
        [x(0.9105), y(0.196)],
      ],
    },

    // --- group 2: tick runs -----------------------------------------------
    {
      kind: "ticks",
      id: "ticks-top",
      group: 2,
      color: "line",
      x: x(0.775),
      y: frame.topHi,
      axis: "h",
      span: x(0.13),
      len: y(0.012),
      count: 15,
      passes: 4,
    },
    {
      kind: "ticks",
      id: "ticks-left",
      group: 2,
      color: "line",
      x: frame.left,
      y: y(0.3),
      axis: "v",
      span: y(0.2),
      len: x(0.009),
      count: 13,
      passes: 3,
    },
    {
      kind: "ticks",
      id: "ticks-right",
      group: 2,
      color: "line",
      x: frame.right,
      y: y(0.6),
      axis: "v",
      span: y(0.18),
      len: -x(0.009),
      count: 12,
      passes: 2,
    },
    {
      kind: "ticks",
      id: "ticks-bottom",
      group: 2,
      color: "line",
      x: x(0.7),
      y: frame.botLo,
      axis: "h",
      span: x(0.13),
      len: -y(0.012),
      count: 13,
      passes: 5,
    },

    // --- group 3: plus markers just inside the corners ---------------------
    { kind: "plus", id: "plus-tl", group: 3, color: "pale", x: x(0.07), y: y(0.127), size: x(0.0105) },
    { kind: "plus", id: "plus-tr", group: 3, color: "pale", x: x(0.828), y: y(0.077), size: x(0.0105) },
    { kind: "plus", id: "plus-bl", group: 3, color: "pale", x: x(0.09), y: y(0.884), size: x(0.0105) },
    { kind: "plus", id: "plus-br", group: 3, color: "pale", x: x(0.901), y: y(0.912), size: x(0.0105) },

    // --- group 4: rings down the left and right edges ----------------------
    { kind: "ring", id: "ring-l1", group: 4, color: "accent", cx: x(0.067), cy: y(0.52), r: x(0.0115), gap: 0.13, turns: 1 },
    { kind: "ring", id: "ring-l2", group: 4, color: "accent", cx: x(0.067), cy: y(0.605), r: x(0.0115), gap: 0.17, turns: -1 },
    { kind: "ring", id: "ring-l3", group: 4, color: "accent", cx: x(0.067), cy: y(0.69), r: x(0.0115), gap: 0.12, turns: 2 },
    { kind: "ring", id: "ring-r1", group: 4, color: "accent", cx: x(0.933), cy: y(0.3), r: x(0.0115), gap: 0.16, turns: -2 },
    { kind: "ring", id: "ring-r2", group: 4, color: "accent", cx: x(0.933), cy: y(0.385), r: x(0.0115), gap: 0.13, turns: 1 },
    { kind: "ring", id: "ring-r3", group: 4, color: "accent", cx: x(0.933), cy: y(0.47), r: x(0.0115), gap: 0.17, turns: -1 },

    // --- group 5: dashed traces and node dots ------------------------------
    {
      kind: "trace",
      id: "trace-tl",
      group: 5,
      color: "accent",
      pts: [
        [x(0.072), y(0.152)],
        [x(0.23), y(0.152)],
        [x(0.268), y(0.126)],
        [x(0.392), y(0.126)],
      ],
      dots: [0, 1, 2, 3],
      r: x(0.0022),
    },
    {
      kind: "trace",
      id: "trace-br",
      group: 5,
      color: "accent",
      pts: [
        [x(0.47), y(0.868)],
        [x(0.63), y(0.868)],
        [x(0.668), y(0.894)],
        [x(0.862), y(0.894)],
      ],
      dots: [1, 2, 3],
      r: x(0.0022),
      dash: [x(0.009), x(0.005)],
    },
    {
      kind: "dots",
      id: "dots-tl",
      group: 5,
      color: "pale",
      pts: [
        [x(0.1625), y(0.1135)],
        [x(0.1705), y(0.1135)],
      ],
      r: x(0.0025),
    },
    {
      kind: "dots",
      id: "dots-br",
      group: 5,
      color: "pale",
      pts: [
        [x(0.8365), y(0.9185)],
        [x(0.8445), y(0.9185)],
      ],
      r: x(0.0025),
    },
  ];

  return { frame, elements };
};

export const GROUP_COUNT = 6;
