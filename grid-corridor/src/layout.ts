import { DURATION_IN_FRAMES } from "./constants";
import type { Plane } from "./geometry";
import { chance, pick, rndInt, rndRange } from "./seed";
import type { TextLayerMode, VariantConfig } from "./variants";

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
  kind: "code" | "equation";
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

    for (let i = 0; i < config.perPlane.glyphs; i++) {
      const s = `${base}:glyph:${i}`;
      const { u, v } = spread(s, plane);
      glyphs.push({
        id: s,
        plane: pi,
        u,
        v,
        // Schematics are orthogonal, so they sit on quarter turns with only a
        // hand-drawn wobble. Molecules are radial and rotate freely.
        rotation:
          config.diagrams === "circuits"
            ? (Math.PI / 2) * rndInt(s + "q", 0, 4) + rndRange(s + "j", -0.05, 0.05)
            : rndRange(s + "rot", -Math.PI, Math.PI),
        size: rndRange(s + "sz", 62, 132) * config.diagramScale,
        speed: pick(s + "sp", SPEEDS),
      });
    }

    const addBlock = (i: number, kind: BlockSpec["kind"]) => {
      const s = `${base}:${kind}:${i}`;
      const { u, v } = spread(s, plane);
      const dense = chance(s + "d", 0.55);
      blocks.push({
        id: s,
        plane: pi,
        u,
        v,
        rotation: rndRange(s + "rot", -0.05, 0.05),
        kind,
        fontSize: Math.round(rndRange(s + "fs", 19, 27)),
        lineCount:
          kind === "equation"
            ? rndInt(s + "lc", 2, 5)
            : dense
              ? rndInt(s + "lc", 11, 21)
              : rndInt(s + "lc", 6, 12),
        dense,
        speed: pick(s + "sp", SPEEDS),
      });
    };
    for (let i = 0; i < config.perPlane.codeBlocks; i++) addBlock(i, "code");
    for (let i = 0; i < config.perPlane.equations; i++) addBlock(i, "equation");

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
        if (!best || bestDist > 620 || bestDist < 40) continue;
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

/** The offset the grid itself rides on: one whole tile over the loop. */
export const gridDrift = (
  plane: Plane,
  frame: number,
  rollDirection: number,
): { u: number; v: number } => {
  const t = (frame / DURATION_IN_FRAMES) * -rollDirection;
  return {
    u: wrap(t * plane.tileU, plane.tileU),
    v: wrap(t * plane.tileV, plane.tileV),
  };
};

export const textLayerHasBlocks = (mode: TextLayerMode): boolean =>
  mode === "blocks" || mode === "equations";
