import React, { useMemo } from "react";
import type { ElementRenderProps, Measurer } from "../layout";
import { THEME } from "../theme";
import type { StrokeSet } from "../theme";
import {
  circle,
  ctxOf,
  dot,
  line,
  loopPhase,
  makeCanvas,
  rndInt,
  rndRange,
} from "../draw/util";
import { HudCanvas } from "./canvas";
import { monoFont } from "../fonts";

export const RING_BOX = 1240;
/** Sized so the outermost tick band clears the radar dial in the mirrored
 *  layout, where the two sit closest. */
const MAX_R = 570;

export const measureRingAssembly: Measurer = ({ scale }) => ({
  w: Math.round(RING_BOX * scale),
  h: Math.round(RING_BOX * scale),
});

type BandKind = "ticks" | "dashes" | "arcs" | "solid" | "labels";

type Band = {
  kind: BandKind;
  /** Fraction of MAX_R. */
  r: number;
  /** The band's own angular symmetry period, in degrees. */
  symmetry: number;
  /** Whole number of symmetry periods travelled across the 600-frame loop. */
  periods: number;
  dir: 1 | -1;
  colour: string;
  emphasis?: boolean;
  count?: number;
  longEvery?: number;
  duty?: number;
};

/**
 * Radial and ordered, where the node graph is irregular and web-like. Bands
 * alternate direction, and each travels a whole number of its own symmetry
 * periods per loop so frame 600 is identical to frame 0.
 */
const BANDS: Band[] = [
  { kind: "ticks", r: 1.0, symmetry: 30, periods: 9, dir: 1, colour: THEME.mid, count: 120, longEvery: 12 },
  { kind: "dashes", r: 0.913, symmetry: 15, periods: 18, dir: -1, colour: THEME.bright, emphasis: true, count: 24, duty: 0.55 },
  { kind: "arcs", r: 0.82, symmetry: 360, periods: 1, dir: 1, colour: THEME.mid },
  { kind: "solid", r: 0.73, symmetry: 360, periods: 0, dir: 1, colour: THEME.dim },
  { kind: "labels", r: 0.64, symmetry: 360, periods: 1, dir: -1, colour: THEME.mid },
  { kind: "dashes", r: 0.53, symmetry: 10, periods: 30, dir: 1, colour: THEME.mid, count: 36, duty: 0.3 },
  { kind: "ticks", r: 0.42, symmetry: 40, periods: 7, dir: -1, colour: THEME.dim, count: 72, longEvery: 8 },
  { kind: "arcs", r: 0.29, symmetry: 360, periods: 1, dir: 1, colour: THEME.mid },
];

const ARC_SPANS: Record<number, [number, number][]> = {
  // Unequal spans, so the band has no rotational symmetry below a full turn.
  2: [
    [0.02, 0.31],
    [0.38, 0.63],
    [0.71, 0.95],
  ],
  7: [
    [0.05, 0.44],
    [0.56, 0.88],
  ],
};

const drawTicks = (
  ctx: CanvasRenderingContext2D,
  r: number,
  count: number,
  longEvery: number,
) => {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const len = i % longEvery === 0 ? r * 0.055 : r * 0.026;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    line(ctx, cos * r, sin * r, cos * (r + len), sin * (r + len));
  }
};

const drawDashes = (
  ctx: CanvasRenderingContext2D,
  r: number,
  count: number,
  duty: number,
) => {
  const step = (Math.PI * 2) / count;
  for (let i = 0; i < count; i++) {
    const a0 = i * step;
    ctx.beginPath();
    ctx.arc(0, 0, r, a0, a0 + step * duty);
    ctx.stroke();
  }
};

const drawArcs = (
  ctx: CanvasRenderingContext2D,
  r: number,
  spans: [number, number][],
) => {
  spans.forEach(([a, b]) => {
    ctx.beginPath();
    ctx.arc(0, 0, r, a * Math.PI * 2, b * Math.PI * 2);
    ctx.stroke();
  });
};

/** The band's fixed chrome that does not rotate: one continuous thin ring, the
 *  centre mark, and a few faint radial guides. */
const renderStatic = (size: number, scale: number, stroke: StrokeSet, seed: string) => {
  const canvas = makeCanvas(size, size);
  const ctx = ctxOf(canvas);
  const c = size / 2;
  ctx.translate(c, c);

  const solid = BANDS.find((b) => b.kind === "solid") as Band;
  ctx.strokeStyle = solid.colour;
  ctx.lineWidth = stroke.structure;
  circle(ctx, 0, 0, solid.r * MAX_R * scale);

  ctx.strokeStyle = THEME.faint;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rndRange(`${seed}-guide`, 0, 0.2);
    const r0 = 0.33 * MAX_R * scale;
    const r1 = 0.70 * MAX_R * scale;
    line(ctx, Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1);
  }

  ctx.strokeStyle = THEME.mid;
  ctx.lineWidth = stroke.structure;
  const inner = 0.17 * MAX_R * scale;
  circle(ctx, 0, 0, inner);
  const gap = inner * 0.28;
  line(ctx, -inner * 1.5, 0, -gap, 0);
  line(ctx, gap, 0, inner * 1.5, 0);
  line(ctx, 0, -inner * 1.5, 0, -gap);
  line(ctx, 0, gap, 0, inner * 1.5);
  ctx.fillStyle = THEME.bright;
  dot(ctx, 0, 0, 5 * scale);

  return canvas;
};

export const RingAssembly: React.FC<ElementRenderProps> = ({
  frame,
  scale,
  stroke,
  config,
  width,
  height,
  dimmed,
}) => {
  const size = Math.round(RING_BOX * scale);
  const chrome = useMemo(
    () => renderStatic(size, scale, stroke, config.seed),
    [size, scale, stroke, config.seed],
  );

  const labels = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        String(rndInt(`${config.seed}-lab-${i}`, 8, 989)).padStart(3, "0"),
      ),
    [config.seed],
  );

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.globalAlpha = dimmed ? 0.3 : 1;
    ctx.drawImage(chrome, 0, 0);

    const c = size / 2;
    const phase = loopPhase(frame);

    BANDS.forEach((band, index) => {
      if (band.kind === "solid") {
        return;
      }
      const r = band.r * MAX_R * scale;
      const angle =
        band.dir * band.periods * band.symmetry * phase * (Math.PI / 180);

      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(angle);
      ctx.strokeStyle = band.colour;
      ctx.lineWidth = band.emphasis ? stroke.emphasis : stroke.structure;

      if (band.kind === "ticks") {
        drawTicks(ctx, r, band.count ?? 60, band.longEvery ?? 10);
      } else if (band.kind === "dashes") {
        drawDashes(ctx, r, band.count ?? 24, band.duty ?? 0.5);
      } else if (band.kind === "arcs") {
        drawArcs(ctx, r, ARC_SPANS[index] ?? [[0, 0.5]]);
      } else if (band.kind === "labels") {
        ctx.strokeStyle = THEME.dim;
        ctx.lineWidth = stroke.structure;
        circle(ctx, 0, 0, r);
        ctx.fillStyle = THEME.textDim;
        ctx.font = monoFont(Math.round(17 * scale));
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        labels.forEach((text, i) => {
          const a = (i / labels.length) * Math.PI * 2;
          const lx = Math.cos(a) * (r + 22 * scale);
          const ly = Math.sin(a) * (r + 22 * scale);
          ctx.save();
          ctx.translate(lx, ly);
          // Counter-rotate so the labels orbit but always read forwards.
          ctx.rotate(-angle);
          ctx.fillText(text, 0, 0);
          ctx.restore();
          ctx.strokeStyle = THEME.dim;
          line(ctx, Math.cos(a) * r, Math.sin(a) * r, Math.cos(a) * (r + 10 * scale), Math.sin(a) * (r + 10 * scale));
        });
      }

      ctx.restore();
    });

    ctx.globalAlpha = 1;
  };

  return <HudCanvas width={width} height={height} draw={draw} />;
};
