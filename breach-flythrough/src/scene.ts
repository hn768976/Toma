import { LAYER_COUNT } from "./depth";
import { makeRng } from "./random";

/**
 * The contents of the eight depth planes.
 *
 * Built once, at module level, from a seeded PRNG: layer contents, positions
 * and rotations never change during playback, so a layer that wraps to the
 * back comes round carrying exactly what it had before. Positions and sizes
 * are stored as fractions of the frame width and only turned into pixels at
 * render time.
 */

const HEX_DIGITS = "0123456789ABCDEF";

/** Category names only — no values, invented or otherwise. */
const LABELS = [
  "Personal data",
  "Phone number - mail - address",
  "Name - age",
  "Profile",
  "Username",
  "Date of birth",
  "Payment details",
] as const;

export type Token = {
  text: string;
  /**
   * -1 for a token that just sits there. Anything else seeds a slow flicker;
   * see `tokenLit` for why the period has to divide the loop.
   */
  flicker: number;
};

export type Row = Token[];

export type Block = {
  /** Centre of the block, in frame widths, relative to the frame centre. */
  x: number;
  y: number;
  /** Cap height of a character, in frame widths. */
  fontSize: number;
  rows: Row[];
  /** Multiplied by the layer's own alpha. */
  alpha: number;
  /** Index into the palette's three data colours. */
  tone: 0 | 1 | 2;
};

export type RecordGroup = {
  x: number;
  y: number;
  /** Height of the padlock icon, in frame widths. */
  lockSize: number;
  /** Open red padlock, or the small green closed one. */
  breached: boolean;
  /** Category name shown above the data. Absent on the secured records. */
  label: string | null;
  labelSize: number;
  block: Block;
};

export type Layer = {
  index: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  alpha: number;
  blocks: Block[];
  records: RecordGroup[];
};

type SizeClass = "giant" | "large" | "medium" | "small" | "field";

/** Character size per class, as a fraction of the frame width. */
const FONT_SIZE: Record<SizeClass, number> = {
  giant: 0.045,
  large: 0.026,
  medium: 0.0165,
  small: 0.0105,
  field: 0.016,
};

type LayerRole = {
  size: SizeClass;
  /** Category name for this layer's breached record. */
  label?: (typeof LABELS)[number];
  /** A breached record: open red padlock, category label, block of data. */
  record: boolean;
  /** A secured record: small green padlock beside masked characters. */
  secured: boolean;
  /** A wide dim grid of characters, the aerial texture behind everything. */
  field: boolean;
  /** Loose blocks of data scattered around the plane. */
  loose: number;
};

/**
 * Roles are hand-assigned rather than drawn at random so the mix stays right
 * at every point in the cycle: four breached records spread through the depth,
 * and the two secured ones four slots apart, which is half the stack — one of
 * them is always somewhere in frame.
 *
 * Layers carry very little each. All eight are on screen at once, so anything
 * more than one or two items per plane fills the frame edge to edge and the
 * dark space the padlocks need to read against disappears.
 */
const LAYER_ROLES: LayerRole[] = [
  { size: "medium", record: true, label: "Personal data", secured: false, field: false, loose: 1 },
  { size: "large", record: false, secured: true, field: false, loose: 1 },
  { size: "field", record: false, secured: false, field: true, loose: 0 },
  { size: "giant", record: true, label: "Profile", secured: false, field: false, loose: 0 },
  { size: "small", record: true, label: "Username", secured: false, field: false, loose: 1 },
  { size: "medium", record: true, label: "Phone number - mail - address", secured: true, field: false, loose: 1 },
  { size: "field", record: false, secured: false, field: true, loose: 1 },
  { size: "large", record: true, label: "Date of birth", secured: false, field: false, loose: 1 },
];

const hexToken = (rng: ReturnType<typeof makeRng>) =>
  HEX_DIGITS[rng.int(0, 15)] + HEX_DIGITS[rng.int(0, 15)] + HEX_DIGITS[rng.int(0, 15)];

const makeRows = (
  rng: ReturnType<typeof makeRng>,
  rowCount: number,
  tokensPerRow: number,
  /** Fraction of tokens that flicker. Kept low — it is a twitch, not an effect. */
  flickerRate: number,
  masked = false,
): Row[] =>
  Array.from({ length: rowCount }, () =>
    Array.from({ length: tokensPerRow }, () => ({
      text: masked ? "xxxx" : hexToken(rng),
      flicker: rng.chance(flickerRate) ? rng.int(0, 8) : -1,
    })),
  );

const makeBlock = (
  rng: ReturnType<typeof makeRng>,
  fontSize: number,
  opts: {
    x: number;
    y: number;
    rows: number;
    cols: number;
    alpha: number;
    tone: 0 | 1 | 2;
    masked?: boolean;
  },
): Block => ({
  x: opts.x,
  y: opts.y,
  fontSize,
  rows: makeRows(rng, opts.rows, opts.cols, 0.045, opts.masked),
  alpha: opts.alpha,
  tone: opts.tone,
});

const buildLayer = (index: number): Layer => {
  const role = LAYER_ROLES[index];
  const rng = makeRng(`breach-layer-${index}`);
  const fontSize = FONT_SIZE[role.size];

  const blocks: Block[] = [];
  const records: RecordGroup[] = [];

  // The dim grid. Wide and tall enough that no edge of it ever crosses the
  // frame, even when the layer is at its most distant and smallest.
  if (role.field) {
    blocks.push(
      makeBlock(rng, FONT_SIZE.field * rng.range(0.9, 1.2), {
        x: rng.range(-0.3, 0.3),
        y: rng.range(-0.2, 0.2),
        rows: rng.int(28, 36),
        cols: rng.int(38, 46),
        alpha: rng.range(0.1, 0.17),
        tone: 2,
      }),
    );
  }

  for (let i = 0; i < role.loose; i++) {
    blocks.push(
      makeBlock(rng, fontSize * rng.range(0.75, 1.15), {
        x: rng.range(-1.0, 1.0),
        y: rng.range(-0.8, 0.8),
        rows: rng.int(5, 8),
        cols: rng.int(5, 9),
        alpha: rng.range(0.2, 0.42),
        tone: rng.chance(0.35) ? 1 : 2,
      }),
    );
  }

  if (role.record) {
    // Bias the breached records toward the middle of frame — they are what the
    // flight is meant to carry you past, so they should land near the focus.
    const x = rng.range(-0.34, 0.34);
    const y = rng.range(-0.3, 0.3);
    records.push({
      x,
      y,
      lockSize: fontSize * rng.range(6, 7.6),
      breached: true,
      label: role.label ?? null,
      labelSize: fontSize * 1.55,
      block: makeBlock(rng, fontSize, {
        // Records lay their padlock, label and data out in flow, so a block
        // belonging to one ignores its own coordinates.
        x: 0,
        y: 0,
        rows: rng.int(5, 7),
        cols: rng.int(6, 9),
        alpha: rng.range(0.72, 0.92),
        tone: 0,
      }),
    });
  }

  if (role.secured) {
    // Kept clear of the breached record on the same plane, so the secured few
    // and the breached many read as separate things rather than one pile.
    const breached = records[0];
    const side = breached ? (breached.x > 0 ? -1 : 1) : rng.pick([-1, 1]);
    const x = (breached?.x ?? 0) + side * rng.range(0.5, 0.85);
    const y = (breached?.y ?? 0) + rng.pick([-1, 1]) * rng.range(0.14, 0.5);
    const small = fontSize * 0.9;
    records.push({
      x,
      y,
      lockSize: small * 5.2,
      breached: false,
      label: null,
      labelSize: small,
      block: makeBlock(rng, small, {
        x: 0,
        y: 0,
        rows: rng.int(2, 3),
        cols: rng.int(3, 4),
        alpha: rng.range(0.6, 0.85),
        tone: 0,
        masked: true,
      }),
    });
  }

  return {
    index,
    // A few degrees on every axis so the planes never read as sliding
    // wallpaper. rotateZ is biased positive: as in the reference, the rows of
    // data run visibly downhill.
    rotateX: rng.range(-4, 4),
    rotateY: rng.range(-9, 9),
    rotateZ: rng.range(2, 7),
    alpha: role.field ? rng.range(0.5, 0.62) : rng.range(0.72, 0.92),
    blocks,
    records,
  };
};

export const LAYERS: Layer[] = Array.from({ length: LAYER_COUNT }, (_, i) =>
  buildLayer(i),
);

/**
 * Whether a flickering token is lit on this frame.
 *
 * The step counter advances every 4 frames, giving 90 steps over the 360-frame
 * loop, and 90 divides by 9 — so the pattern lands back exactly where it
 * started when the loop comes round.
 */
export const tokenLit = (flicker: number, frame: number): boolean =>
  flicker < 0 || (Math.floor(frame / 4) + flicker) % 9 !== 0;
