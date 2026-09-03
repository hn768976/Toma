import { HEIGHT, WIDTH } from "./constants";
import { basePlaneMatrix } from "../lib/TiltedPlane";
import { planeConfig } from "./hud-plane";
import type { PanelKind } from "./SidePanel";
import type { Variant } from "./variants";

/**
 * Where everything sits on the plane.
 *
 * Positions are authored as SCREEN anchors and converted to plane
 * coordinates, not the other way round. The two variants tilt the plane
 * differently — v1 recedes to the upper-right, v2 to the upper-left — so a
 * plane coordinate that frames the shot in one lands off-canvas in the other.
 * An anchor in screen space survives the mirror; a plane coordinate does not.
 *
 * Density is a variant property, not a magic number sprinkled through the
 * layout: "high" fills the margins densely, "sparse" is roughly half the
 * element count with larger individual panels and more empty plane between
 * them — the wireframe aircraft is visually lighter than the solid one and a
 * dense HUD would bury it.
 */

export type StripSpec = {
  /** Plane-space top edge, derived from a screen height. */
  y: number;
  height: number;
  seed: string;
  rows: number;
};

export type PanelSpec = {
  u: number;
  v: number;
  w: number;
  h: number;
  kind: PanelKind;
  seed: string;
  accent?: boolean;
};

/** A column of panels stacked along the plane's v axis at constant u. */
type ColumnSpec = {
  /** Screen x the column should pass through at v = 0. */
  screenX: number;
  /** Screen y of the column's first panel. */
  screenY: number;
  w: number;
  gap: number;
  items: [kind: PanelKind, h: number, accent?: boolean][];
  seedPrefix: string;
};

/** A single panel anchored by the screen point its plane origin lands on. */
type LooseSpec = {
  screenX: number;
  screenY: number;
  w: number;
  h: number;
  kind: PanelKind;
  seed: string;
  accent?: boolean;
};

const toPlane = (inv: DOMMatrix, sx: number, sy: number) => {
  const p = new DOMPoint(sx, sy).matrixTransform(inv);
  return { u: p.x, v: p.y };
};

const HIGH_COLUMNS: ColumnSpec[] = [
  {
    screenX: 600,
    screenY: 380,
    w: 620,
    gap: 62,
    seedPrefix: "l",
    items: [
      ["numeric", 300],
      ["waveform", 250],
      ["table", 330],
      ["numeric", 240],
      ["waveform", 250],
    ],
  },
  {
    screenX: 2960,
    screenY: 210,
    w: 580,
    gap: 70,
    seedPrefix: "r",
    items: [["code", 1250]],
  },
  {
    screenX: 3480,
    screenY: 120,
    w: 90,
    gap: 0,
    seedPrefix: "t",
    items: [["tickrule", 1000]],
  },
];

const HIGH_LOOSE: LooseSpec[] = [
  {
    screenX: 2400,
    screenY: 420,
    w: 430,
    h: 200,
    kind: "numeric",
    seed: "m1",
    accent: true,
  },
  { screenX: 2760, screenY: 1720, w: 520, h: 260, kind: "table", seed: "m2" },
  {
    screenX: 1180,
    screenY: 1880,
    w: 500,
    h: 220,
    kind: "waveform",
    seed: "m3",
  },
  { screenX: 3300, screenY: 1430, w: 420, h: 280, kind: "table", seed: "m4" },
  { screenX: 260, screenY: 1980, w: 460, h: 200, kind: "numeric", seed: "m5" },
  { screenX: 900, screenY: 150, w: 480, h: 200, kind: "table", seed: "m6" },
  { screenX: 1760, screenY: 110, w: 440, h: 190, kind: "numeric", seed: "m7" },
];

const SPARSE_COLUMNS: ColumnSpec[] = [
  {
    screenX: 560,
    screenY: 430,
    w: 760,
    gap: 130,
    seedPrefix: "l",
    items: [
      ["numeric", 400],
      ["waveform", 340],
      ["table", 430],
    ],
  },
  {
    screenX: 3020,
    screenY: 260,
    w: 700,
    gap: 70,
    seedPrefix: "r",
    items: [["code", 1180]],
  },
  {
    screenX: 3560,
    screenY: 250,
    w: 100,
    gap: 0,
    seedPrefix: "t",
    items: [["tickrule", 860]],
  },
];

const SPARSE_LOOSE: LooseSpec[] = [
  {
    screenX: 2280,
    screenY: 1780,
    w: 620,
    h: 280,
    kind: "numeric",
    seed: "m1",
    accent: true,
  },
];

const expand = (
  inv: DOMMatrix,
  columns: ColumnSpec[],
  loose: LooseSpec[],
): PanelSpec[] => {
  const out: PanelSpec[] = [];
  for (const col of columns) {
    // The column's u comes from where it should cross screen x at v = 0; its
    // panels then stack purely in v, which keeps the stack parallel to the
    // plane's own axis instead of fighting it.
    const { u } = toPlane(inv, col.screenX, HEIGHT / 2);
    let v = toPlane(inv, col.screenX, col.screenY).v;
    col.items.forEach(([kind, h, accent], i) => {
      out.push({
        u,
        v,
        w: col.w,
        h,
        kind,
        seed: `${col.seedPrefix}${i}`,
        accent,
      });
      v += h + col.gap;
    });
  }
  for (const l of loose) {
    const { u, v } = toPlane(inv, l.screenX, l.screenY);
    out.push({
      u,
      v,
      w: l.w,
      h: l.h,
      kind: l.kind,
      seed: l.seed,
      accent: l.accent,
    });
  }
  return out;
};

export const buildLayout = (v: Variant) => {
  // Frame 0, i.e. without the ambient camera drift: the layout is static.
  const inv = basePlaneMatrix(planeConfig(v, 0)).inverse();
  const dense = v.density === "high";
  // The strips are plane-spanning bands; only their v matters, so it is taken
  // from the screen height they should sweep through at frame centre.
  const stripV = (screenY: number) => toPlane(inv, WIDTH / 2, screenY).v;
  const strips: StripSpec[] = dense
    ? [
        { y: stripV(230) - 140, height: 290, seed: "top", rows: 2 },
        { y: stripV(1900) - 140, height: 290, seed: "bot", rows: 2 },
      ]
    : [
        { y: stripV(210) - 95, height: 190, seed: "top", rows: 1 },
        { y: stripV(1930) - 95, height: 190, seed: "bot", rows: 1 },
      ];
  return {
    strips,
    panels: expand(
      inv,
      dense ? HIGH_COLUMNS : SPARSE_COLUMNS,
      dense ? HIGH_LOOSE : SPARSE_LOOSE,
    ),
  };
};
