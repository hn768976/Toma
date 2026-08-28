import { BLOCK, DEPTH_HALF, LOOP_FRAMES } from "./plane";
import { pickWeighted, rand, randInt, randRange } from "./rng";
import type { IconName, VariantConfig, VariantKey } from "./variants";

/**
 * The layout is generated ONCE per variant (seeded, deterministic) and reused
 * every frame — regenerating per frame would make the whole field strobe.
 *
 * One block spans local x ∈ [-DEPTH_HALF, DEPTH_HALF] (depth) and
 * local y ∈ [0, BLOCK) (drift axis). The block is drawn at several
 * y-offsets of exactly BLOCK, and the sheet translates by exactly one BLOCK
 * over the 450-frame loop, so frame 0 and frame 450 are pixel-identical.
 */

export type TileColorKey = "tileDark" | "tileMid" | "tileLight";

export interface TileSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  color: TileColorKey;
  alpha: number;
  /** Bitmask of edges carrying a thin brighter line: 1=T 2=R 4=B 8=L. */
  edges: number;
  /** Per-tile jitter for the "separating" drift mode. */
  sepAmp: number;
  sepAngle: number;
}

export interface IconSpec {
  x: number;
  y: number;
  size: number;
  name: IconName;
  tier: "pale" | "white";
  flickers: { start: number; dur: number }[];
  sepAmp: number;
  sepAngle: number;
}

export interface DotBlockSpec {
  x: number;
  y: number;
  cols: number;
  rows: number;
  cell: number;
  gap: number;
  litFrac: number;
  /** Reroll period — a divisor of 450 so the loop closes. */
  period: number;
  phase: number;
  id: number;
  sepAmp: number;
  sepAngle: number;
}

export interface OutlineSpec {
  x: number;
  y: number;
  kind: "rect" | "ellipse";
  w: number;
  h: number;
  lineWidth: number;
  alpha: number;
  sepAmp: number;
  sepAngle: number;
}

export interface DashSpec {
  x: number;
  y: number;
  len: number;
  lineWidth: number;
  alpha: number;
  dash: number;
  sepAmp: number;
  sepAngle: number;
}

export interface HighlightSpec {
  x: number;
  y: number;
  r: number;
  alpha: number;
  sepAmp: number;
  sepAngle: number;
}

export interface GlitchSlice {
  yFrac: number;
  hFrac: number;
  shift: number;
}

export interface GlitchEvent {
  start: number;
  dur: number;
  slices: GlitchSlice[];
  flash: number[]; // icon indices flashing white
}

export interface Layout {
  tiles: TileSpec[];
  icons: IconSpec[];
  dotBlocks: DotBlockSpec[];
  outlines: OutlineSpec[];
  dashes: DashSpec[];
  highlights: HighlightSpec[];
  glitches: GlitchEvent[];
}

const sepJitter = (seed: string): [number, number] => [
  randRange(`${seed}-sepamp`, 0.55, 1.45),
  randRange(`${seed}-sepang`, -0.32, 0.32),
];

const generateTiles = (v: VariantKey, cfg: VariantConfig): TileSpec[] => {
  const tiles: TileSpec[] = [];
  const cellW = 172; // along depth (x)
  const cellH = 132; // along drift (y)
  const cols = Math.ceil((2 * DEPTH_HALF) / cellW);
  const rows = Math.ceil(BLOCK / cellH);
  const colorWeights = [
    { key: "tileDark" as const, weight: 40 },
    { key: "tileMid" as const, weight: 38 },
    { key: "tileLight" as const, weight: 22 },
  ];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      // 1–2 overlapping tiles per cell, with irregular gaps where none spawn.
      const spawns =
        (rand(`${v}-tile-${i}-${j}-p1`) < 0.84 ? 1 : 0) +
        (rand(`${v}-tile-${i}-${j}-p2`) < 0.5 ? 1 : 0);
      for (let n = 0; n < spawns; n++) {
        const s = `${v}-tile-${i}-${j}-${n}`;
        const x =
          -DEPTH_HALF +
          (i + 0.5) * cellW +
          randRange(`${s}-jx`, -0.55, 0.55) * cellW;
        const y = (j + 0.5) * cellH + randRange(`${s}-jy`, -0.55, 0.55) * cellH;
        // Sizes from small squares to wide bars (wide along the depth axis,
        // which reads near-horizontal on screen).
        const shape = rand(`${s}-shape`);
        let w: number;
        let h: number;
        if (shape < 0.18) {
          // wide bar
          w = cellW * randRange(`${s}-w`, 1.9, 3.7);
          h = cellH * randRange(`${s}-h`, 0.5, 0.9);
        } else if (shape < 0.34) {
          // tall panel
          w = cellW * randRange(`${s}-w`, 0.7, 1.1);
          h = cellH * randRange(`${s}-h`, 1.5, 2.4);
        } else {
          // square-ish panel
          w = cellW * randRange(`${s}-w`, 0.75, 1.35);
          h = cellH * randRange(`${s}-h`, 0.7, 1.3);
        }
        const color = pickWeighted(`${s}-color`, colorWeights).key;
        const alpha = randRange(`${s}-alpha`, cfg.tileAlpha[0], cfg.tileAlpha[1]);
        let edges = 0;
        if (rand(`${s}-edge`) < 0.26) {
          edges |= 1 << randInt(`${s}-edge1`, 0, 3);
          if (rand(`${s}-edge2`) < 0.35) edges |= 1 << randInt(`${s}-edge3`, 0, 3);
        }
        const [sepAmp, sepAngle] = sepJitter(s);
        tiles.push({ x, y, w, h, color, alpha, edges, sepAmp, sepAngle });
      }
    }
  }
  return tiles;
};

const generateIcons = (v: VariantKey, cfg: VariantConfig): IconSpec[] => {
  const icons: IconSpec[] = [];
  const count = cfg.iconsPerBlock;
  const minDist = 255;
  const lockName = cfg.iconSet[0].name; // the plurality icon (padlock)
  for (let k = 0; k < count; k++) {
    // Seeded rejection sampling for a poisson-ish spread. The y span extends
    // a margin past the block edge implicitly via wrapping in draw copies.
    let x = 0;
    let y = 0;
    let placed = false;
    for (let attempt = 0; attempt < 14; attempt++) {
      const s = `${v}-icon-${k}-try${attempt}`;
      x = randRange(`${s}-x`, -DEPTH_HALF + 60, DEPTH_HALF - 60);
      y = randRange(`${s}-y`, 0, BLOCK);
      let ok = true;
      for (const other of icons) {
        // Distance on the wrapped drift axis.
        let dy = Math.abs(y - other.y);
        dy = Math.min(dy, BLOCK - dy);
        const dx = x - other.x;
        if (dx * dx + dy * dy < minDist * minDist) {
          ok = false;
          break;
        }
      }
      if (ok) {
        placed = true;
        break;
      }
    }
    if (!placed) continue;
    // Weighted draw; avoid two of the same non-lock icon adjacent.
    let name = pickWeighted(`${v}-icon-${k}-name`, cfg.iconSet).name;
    if (name !== lockName) {
      for (let redraw = 0; redraw < 5; redraw++) {
        let clash = false;
        for (const other of icons) {
          let dy = Math.abs(y - other.y);
          dy = Math.min(dy, BLOCK - dy);
          const dx = x - other.x;
          if (other.name === name && dx * dx + dy * dy < 470 * 470) {
            clash = true;
            break;
          }
        }
        if (!clash) break;
        name = pickWeighted(`${v}-icon-${k}-name-r${redraw}`, cfg.iconSet).name;
        if (name === lockName) break;
      }
    }
    const s = `${v}-icon-${k}`;
    const [sepAmp, sepAngle] = sepJitter(s);
    icons.push({
      x,
      y,
      size: randRange(`${s}-size`, 92, 158),
      name,
      tier: rand(`${s}-tier`) < 0.28 ? "white" : "pale",
      flickers: [],
      sepAmp,
      sepAngle,
    });
  }
  // Flicker events: 3–5 brief brightenings per second across the field,
  // wrapped modulo 450 so the loop closes.
  const events = 66;
  for (let e = 0; e < events; e++) {
    const idx = randInt(`${v}-flick-${e}-i`, 0, icons.length - 1);
    icons[idx].flickers.push({
      start: rand(`${v}-flick-${e}-s`) * LOOP_FRAMES,
      dur: randRange(`${v}-flick-${e}-d`, 9, 18),
    });
  }
  return icons;
};

const generateDotBlocks = (v: VariantKey): DotBlockSpec[] => {
  const blocks: DotBlockSpec[] = [];
  const periods = [45, 50, 75, 90]; // all divide 450 — reroll wraps cleanly
  for (let k = 0; k < 30; k++) {
    const s = `${v}-dots-${k}`;
    const [sepAmp, sepAngle] = sepJitter(s);
    blocks.push({
      x: randRange(`${s}-x`, -DEPTH_HALF, DEPTH_HALF),
      y: randRange(`${s}-y`, 0, BLOCK),
      cols: randInt(`${s}-c`, 3, 6),
      rows: randInt(`${s}-r`, 4, 8),
      cell: randRange(`${s}-cell`, 9, 14),
      gap: randRange(`${s}-gap`, 0.35, 0.55),
      litFrac: randRange(`${s}-lit`, 0.35, 0.68),
      period: periods[randInt(`${s}-per`, 0, periods.length - 1)],
      phase: randInt(`${s}-ph`, 0, LOOP_FRAMES - 1),
      id: k,
      sepAmp,
      sepAngle,
    });
  }
  return blocks;
};

const generateOutlines = (v: VariantKey): OutlineSpec[] => {
  const outlines: OutlineSpec[] = [];
  for (let k = 0; k < 9; k++) {
    const s = `${v}-outline-${k}`;
    const kind = rand(`${s}-kind`) < 0.62 ? "rect" : "ellipse";
    const [sepAmp, sepAngle] = sepJitter(s);
    outlines.push({
      x: randRange(`${s}-x`, -DEPTH_HALF + 200, DEPTH_HALF - 200),
      y: randRange(`${s}-y`, 0, BLOCK),
      kind,
      w:
        kind === "rect"
          ? randRange(`${s}-w`, 340, 860)
          : randRange(`${s}-w`, 420, 1050),
      h:
        kind === "rect"
          ? randRange(`${s}-h`, 190, 430)
          : randRange(`${s}-h`, 240, 590),
      lineWidth: randRange(`${s}-lw`, 2.4, 4.2),
      alpha: randRange(`${s}-a`, 0.32, 0.6),
      sepAmp,
      sepAngle,
    });
  }
  return outlines;
};

const generateDashes = (v: VariantKey): DashSpec[] => {
  const dashes: DashSpec[] = [];
  for (let k = 0; k < 36; k++) {
    const s = `${v}-dash-${k}`;
    const [sepAmp, sepAngle] = sepJitter(s);
    dashes.push({
      x: randRange(`${s}-x`, -DEPTH_HALF, DEPTH_HALF),
      y: randRange(`${s}-y`, 0, BLOCK),
      len: randRange(`${s}-len`, 110, 300),
      lineWidth: randRange(`${s}-lw`, 3, 5),
      alpha: randRange(`${s}-a`, 0.3, 0.58),
      dash: randRange(`${s}-d`, 12, 22),
      sepAmp,
      sepAngle,
    });
  }
  return dashes;
};

const generateHighlights = (v: VariantKey): HighlightSpec[] => {
  const pts: HighlightSpec[] = [];
  for (let k = 0; k < 55; k++) {
    const s = `${v}-hl-${k}`;
    const [sepAmp, sepAngle] = sepJitter(s);
    pts.push({
      x: randRange(`${s}-x`, -DEPTH_HALF, DEPTH_HALF),
      y: randRange(`${s}-y`, 0, BLOCK),
      r: randRange(`${s}-r`, 2.4, 5),
      alpha: randRange(`${s}-a`, 0.5, 0.95),
      sepAmp,
      sepAngle,
    });
  }
  return pts;
};

const generateGlitches = (
  v: VariantKey,
  cfg: VariantConfig,
  iconCount: number,
): GlitchEvent[] => {
  if (!cfg.glitch) return [];
  const events: GlitchEvent[] = [];
  let t = randRange(`${v}-glitch-t0`, 12, 42);
  let e = 0;
  while (t < LOOP_FRAMES - 4) {
    const s = `${v}-glitch-${e}`;
    const nSlices = randInt(`${s}-n`, 3, 5);
    const slices: GlitchSlice[] = [];
    for (let i = 0; i < nSlices; i++) {
      slices.push({
        yFrac: rand(`${s}-slice-${i}-y`),
        hFrac: randRange(`${s}-slice-${i}-h`, 0.012, 0.05),
        shift:
          randRange(`${s}-slice-${i}-s`, 30, 140) *
          (rand(`${s}-slice-${i}-dir`) < 0.5 ? -1 : 1),
      });
    }
    const flash: number[] = [];
    const nFlash = randInt(`${s}-nf`, 4, 9);
    for (let i = 0; i < nFlash; i++) {
      flash.push(randInt(`${s}-flash-${i}`, 0, iconCount - 1));
    }
    events.push({ start: t, dur: randInt(`${s}-dur`, 2, 4), slices, flash });
    // Every 40–80 frames, irregular.
    t += randRange(`${s}-gap`, 40, 80);
    e++;
  }
  return events;
};

export const generateLayout = (v: VariantKey, cfg: VariantConfig): Layout => {
  const icons = generateIcons(v, cfg);
  return {
    tiles: generateTiles(v, cfg),
    icons,
    dotBlocks: generateDotBlocks(v),
    outlines: generateOutlines(v),
    dashes: generateDashes(v),
    highlights: generateHighlights(v),
    glitches: generateGlitches(v, cfg, icons.length),
  };
};
