import { DURATION_IN_FRAMES, GRID_PITCH, WALL_BLOCK_HEIGHT } from "./constants";
import { formulaExtent, makeCodeLines, pickFormula } from "./content";
import type { Plane } from "./geometry";
import { chance, pick, rndInt, rndRange } from "./seed";
import type { StructureMode, VariantConfig } from "./variants";

/** Parallax classes. Whole tiles per loop, so every element still closes. */
const SPEEDS = [1, 1, 1, 2] as const;

export type DotSpec = {
  id: string;
  plane: number;
  u: number;
  v: number;
  radius: number;
  halo: boolean;
  tone: "white" | "accent" | "contrast";
  /** Pulse period is DURATION_IN_FRAMES / pulseK, so it divides the loop. */
  pulseK: number;
  pulsePhase: number;
  speed: number;
};

export type GlyphSpec = {
  id: string;
  plane: number;
  u: number;
  v: number;
  rotation: number;
  size: number;
  speed: number;
};

export type BlockSpec = {
  id: string;
  plane: number;
  u: number;
  v: number;
  rotation: number;
  kind: "code" | "formula";
  /** Seed of the surface this block sits on, shared by its formula run. */
  surfaceSeed: string;
  /** Position of this block's first formula in that run. */
  formulaIndex: number;
  /** Half-extents the placement pass reserved for this block's sprite. */
  extent: { hw: number; hh: number };
  fontSize: number;
  lineCount: number;
  dense: boolean;
  speed: number;
};

export type ConnectorSpec = {
  id: string;
  plane: number;
  u: number;
  v: number;
  /** Offset to the far end, so both ends wrap together. */
  du: number;
  dv: number;
  speed: number;
};

export type FlareSpec = {
  id: string;
  plane: number;
  u: number;
  v: number;
  size: number;
  startFrame: number;
  duration: number;
};

export type CodeEvent = {
  blockId: string;
  line: number;
  startFrame: number;
  duration: number;
  seed: string;
};

export type Layout = {
  dots: DotSpec[];
  glyphs: GlyphSpec[];
  blocks: BlockSpec[];
  connectors: ConnectorSpec[];
  flares: FlareSpec[];
  codeEvents: CodeEvent[];
};

const spread = (seed: string, plane: Plane): { u: number; v: number } => ({
  u: rndRange(seed + "u", 0, plane.tileU),
  v: rndRange(seed + "v", 0, plane.tileV),
});

/**
 * A placed sprite-bearing element. Sprites are rectangles, so the separation
 * test is a rectangle test — a circle around a wide, short block would reserve
 * far more of the surface than the block actually uses.
 */
type Claim = { u: number; v: number; hw: number; hh: number };

/** Gap left between two elements on top of their own extents. */
const CLEARANCE = 18;
/** How many seeded candidate positions to try before taking the roomiest. */
const PLACEMENT_TRIES = 3000;

/** How far apart two claims are, negative when they overlap. */
const separation = (a: Claim, b: Claim, plane: Plane): number =>
  Math.max(
    Math.abs(wrapDelta(a.u - b.u, plane.tileU)) - a.hw - b.hw,
    Math.abs(wrapDelta(a.v - b.v, plane.tileV)) - a.hh - b.hh,
  );

/**
 * Finds a spot for an element that clears everything already placed.
 * Deterministic: the candidates come from the seed and the first that clears
 * wins. If nothing clears after PLACEMENT_TRIES the roomiest candidate is
 * used, so a crowded surface degrades gracefully instead of failing.
 */
const placeClear = (
  seed: string,
  plane: Plane,
  hw: number,
  hh: number,
  claims: Claim[],
): { u: number; v: number } => {
  let best: Claim = { u: 0, v: 0, hw, hh };
  let bestSlack = -Infinity;
  for (let i = 0; i < PLACEMENT_TRIES; i++) {
    const { u, v } = spread(`${seed}:try${i}`, plane);
    const candidate: Claim = { u, v, hw, hh };
    let slack = Infinity;
    for (const claim of claims) {
      slack = Math.min(slack, separation(claim, candidate, plane) - CLEARANCE);
      if (slack < bestSlack) break;
    }
    if (slack >= 0) {
      claims.push(candidate);
      return { u, v };
    }
    if (slack > bestSlack) {
      bestSlack = slack;
      best = candidate;
    }
  }
  claims.push(best);
  return { u: best.u, v: best.v };
};

/**
 * The sprite's half-extents. Code is generated here and measured from its own
 * longest line, and formulas report their own extent, so the separation test
 * reserves what the sprite actually occupies instead of a generous guess. A
 * guess costs density: every unit of slack is surface no element can use.
 */
const blockExtent = (
  surfaceSeed: string,
  formulaIndex: number,
  kind: BlockSpec["kind"],
  fontSize: number,
  lineCount: number,
  dense: boolean,
  seed: string,
): { hw: number; hh: number } => {
  if (kind === "formula") {
    let w = 0;
    let h = 0;
    for (let r = 0; r < lineCount; r++) {
      const e = formulaExtent(pickFormula(surfaceSeed, formulaIndex + r));
      w = Math.max(w, e.w);
      h += e.h;
    }
    return {
      hw: (w * fontSize + fontSize * 1.4) / 2,
      hh: ((h + (lineCount - 1) * 0.85) * fontSize + fontSize * 1.4) / 2,
    };
  }
  let columns = 1;
  for (const line of makeCodeLines(seed, lineCount, dense)) {
    columns = Math.max(columns, line.length);
  }
  return {
    hw: Math.min(880, columns * fontSize * 0.6 + fontSize * 1.8) / 2,
    hh: (lineCount * fontSize * 1.42 + fontSize * 1.8) / 2,
  };
};

export const buildLayout = (
  variantName: string,
  config: VariantConfig,
  planes: Plane[],
): Layout => {
  const root = `layout:${variantName}`;
  const dots: DotSpec[] = [];
  const glyphs: GlyphSpec[] = [];
  const blocks: BlockSpec[] = [];
  const connectors: ConnectorSpec[] = [];
  const flares: FlareSpec[] = [];

  planes.forEach((plane, pi) => {
    const base = `${root}:${plane.key}`;
    // Everything that draws a sprite shares one placement pass, so code,
    // formulas and diagrams never land on top of each other. Largest first:
    // the big code masses claim their space before the small glyphs fill in
    // around them.
    const claims: Claim[] = [];

    // Measure everything first, place largest first. A big code mass that has
    // to go somewhere should choose before the small glyphs fill the gaps.
    type Pending =
      | {
          kind: "code" | "formula";
          seed: string;
          hw: number;
          hh: number;
          block: Omit<BlockSpec, "u" | "v">;
        }
      | {
          kind: "glyph";
          seed: string;
          hw: number;
          hh: number;
          glyph: Omit<GlyphSpec, "u" | "v">;
        };

    const pending: Pending[] = [];
    let formulaCursor = 0;

    const addBlock = (i: number, kind: BlockSpec["kind"]) => {
      const s = `${base}:${kind}:${i}`;
      const dense = chance(s + "d", 0.55);
      const fontSize =
        kind === "formula"
          ? Math.round(rndRange(s + "fs", 38, 56))
          : Math.round(rndRange(s + "fs", 18, 26));
      const lineCount =
        kind === "formula"
          ? rndInt(s + "lc", 1, 3)
          : dense
            ? rndInt(s + "lc", 10, 22)
            : rndInt(s + "lc", 4, 11);
      const formulaIndex = formulaCursor;
      if (kind === "formula") formulaCursor += lineCount;
      const extent = blockExtent(
        base,
        formulaIndex,
        kind,
        fontSize,
        lineCount,
        dense,
        s,
      );
      pending.push({
        kind,
        seed: s,
        hw: extent.hw,
        hh: extent.hh,
        block: {
          id: s,
          plane: pi,
          rotation: rndRange(s + "rot", -0.04, 0.04),
          kind,
          fontSize,
          lineCount,
          dense,
          speed: pick(s + "sp", SPEEDS),
          surfaceSeed: base,
          formulaIndex,
          extent,
        },
      });
    };
    for (let i = 0; i < config.perPlane.codeBlocks; i++) addBlock(i, "code");
    for (let i = 0; i < config.perPlane.equations; i++) addBlock(i, "formula");

    for (let i = 0; i < config.perPlane.glyphs; i++) {
      const s = `${base}:glyph:${i}`;
      const size = rndRange(s + "sz", 55, 160) * config.diagramScale;
      pending.push({
        kind: "glyph",
        seed: s,
        hw: size * 1.4,
        hh: size * 1.4,
        glyph: {
          id: s,
          plane: pi,
          // Molecules are radial, so they rotate freely; schematics would sit
          // on quarter turns.
          rotation:
            config.diagrams === "circuits"
              ? (Math.PI / 2) * rndInt(s + "q", 0, 4) +
                rndRange(s + "j", -0.05, 0.05)
              : rndRange(s + "rot", -Math.PI, Math.PI),
          size,
          speed: pick(s + "sp", SPEEDS),
        },
      });
    }

    pending.sort(
      (a, b) => b.hw * b.hh - a.hw * a.hh || (a.seed < b.seed ? -1 : 1),
    );
    for (const item of pending) {
      const { u, v } = placeClear(item.seed, plane, item.hw, item.hh, claims);
      if (item.kind === "glyph") glyphs.push({ ...item.glyph, u, v });
      else blocks.push({ ...item.block, u, v });
    }

    for (let i = 0; i < config.perPlane.dots; i++) {
      const s = `${base}:dot:${i}`;
      const { u, v } = spread(s, plane);
      const tone: DotSpec["tone"] = chance(s + "acc", 0.04)
        ? "contrast"
        : chance(s + "tone", 0.62)
          ? "accent"
          : "white";
      dots.push({
        id: s,
        plane: pi,
        u,
        v,
        radius: rndRange(s + "r", 2.2, 9),
        halo: chance(s + "h", 0.55),
        tone,
        pulseK: pick(s + "pk", [1, 2, 3, 4, 6]),
        pulsePhase: rndRange(s + "pp", 0, 1),
        speed: pick(s + "sp", SPEEDS),
      });
    }

    // Connectors: thin faint lines from some dots to a nearby glyph.
    const planeGlyphs = glyphs.filter((g) => g.plane === pi);
    const planeDots = dots.filter((d) => d.plane === pi);
    if (planeGlyphs.length > 0) {
      for (let i = 0; i < planeDots.length; i++) {
        const d = planeDots[i];
        const s = `${base}:conn:${i}`;
        if (!chance(s, 0.3)) continue;
        let best: GlyphSpec | null = null;
        let bestDist = Infinity;
        let bestDu = 0;
        let bestDv = 0;
        for (const g of planeGlyphs) {
          // Compare against the nearest wrapped image of the glyph.
          const du = wrapDelta(g.u - d.u, plane.tileU);
          const dv = wrapDelta(g.v - d.v, plane.tileV);
          const dist = Math.hypot(du, dv);
          if (dist < bestDist) {
            bestDist = dist;
            best = g;
            bestDu = du;
            bestDv = dv;
          }
        }
        if (!best || bestDist > 620 || bestDist < best.size * 1.5) continue;
        connectors.push({
          id: s,
          plane: pi,
          u: d.u,
          v: d.v,
          du: bestDu,
          dv: bestDv,
          speed: d.speed,
        });
      }
    }

    for (let i = 0; i < 3; i++) {
      const s = `${base}:flare:${i}`;
      const { u, v } = spread(s, plane);
      const duration = rndInt(s + "dur", 3, 5);
      flares.push({
        id: s,
        plane: pi,
        u,
        v,
        size: rndRange(s + "sz", 26, 68),
        startFrame: rndInt(s + "f", 0, DURATION_IN_FRAMES - duration),
        duration,
      });
    }
  });

  // Roughly 2.5 live re-renders a second across the whole frame. Each one
  // reverts inside the loop, so frame 0 and frame 360 hold identical text.
  const codeEvents: CodeEvent[] = [];
  const textBlocks = blocks.filter((b) => b.kind === "code");
  if (textBlocks.length > 0) {
    const total = Math.round((DURATION_IN_FRAMES / 30) * 2.5);
    for (let i = 0; i < total; i++) {
      const s = `${root}:event:${i}`;
      const block = textBlocks[rndInt(s + "b", 0, textBlocks.length)];
      const duration = rndInt(s + "d", 20, 46);
      codeEvents.push({
        blockId: block.id,
        line: rndInt(s + "l", 0, block.lineCount),
        startFrame: rndInt(s + "f", 0, DURATION_IN_FRAMES - duration),
        duration,
        seed: s,
      });
    }
  }

  return { dots, glyphs, blocks, connectors, flares, codeEvents };
};

/** Shortest signed distance on a wrapped axis. */
const wrapDelta = (delta: number, period: number): number => {
  let d = ((delta % period) + period) % period;
  if (d > period / 2) d -= period;
  return d;
};

export const wrap = (value: number, period: number): number =>
  ((value % period) + period) % period;

/**
 * Where an element sits at `frame`. The drift covers exactly `speed` whole
 * tiles over the loop, so every element returns to its own start.
 */
export const driftedPosition = (
  plane: Plane,
  u: number,
  v: number,
  speed: number,
  frame: number,
  rollDirection: number,
): { u: number; v: number } => {
  const t = (frame / DURATION_IN_FRAMES) * speed * -rollDirection;
  return {
    u: wrap(u + t * plane.tileU, plane.tileU),
    v: wrap(v + t * plane.tileV, plane.tileV),
  };
};

/**
 * Where the grid itself sits this frame. On a drifting surface it rides one
 * whole tile over the loop, alongside the elements. On the static wall it
 * scrolls upward with the text, by exactly one text block — which is a whole
 * number of grid pitches, so the grid closes the loop too.
 */
export const gridDrift = (
  plane: Plane,
  frame: number,
  rollDirection: number,
  structure: StructureMode,
): { u: number; v: number } => {
  const t = frame / DURATION_IN_FRAMES;
  if (structure === "wall") {
    return { u: 0, v: wrap(-t * WALL_BLOCK_HEIGHT, GRID_PITCH) };
  }
  return {
    u: wrap(t * -rollDirection * plane.tileU, plane.tileU),
    v: wrap(t * -rollDirection * plane.tileV, plane.tileV),
  };
};
