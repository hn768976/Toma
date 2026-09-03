import React, { useLayoutEffect, useMemo, useRef } from "react";
import { rgba } from "../lib/color";
import { rnd, rndInt, rndPick, rndRange } from "../lib/rng";
import type { LabelSet, Palette } from "../variants";

export interface LabelFieldProps {
  width: number;
  height: number;
  frame: number;
  duration: number;
  palette: Palette;
  labelSet: LabelSet;
  count: number;
}

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
// Second term of the R2 low-discrepancy sequence, used for the radial
// coordinate so it does not correlate with the golden-angle spacing.
const R2_ALPHA = 0.7548776662466927;

// Generic technical vocabulary only — nothing that reads as a real product.
const WORDS = [
  "SERVER", "NODE", "LED", "NAT", "OCR", "SYNC", "LINK", "PORT", "HOST",
  "GRID", "RELAY", "CACHE", "PING", "HASH", "QUEUE", "PROXY", "ROUTE",
  "TRACE", "POOL", "EDGE", "FRAME", "BUS", "GATE", "MESH", "PATH", "SLOT",
  "TICK", "WAVE", "CHAN", "STACK", "FIELD", "BUFFER",
] as const;

const FRAGMENTS = [
  "[OK]", "[ACK]", "[RX]", "[TX]", "[SYN]", "[EOF]", "[RDY]", "[IDLE]",
  "[SET]", "[REF]", "[SEQ]",
] as const;

// Reroll periods all divide 450, so every label's text cycle closes on the loop.
const REROLL_PERIODS = [90, 150, 225] as const;

interface LabelSpec {
  angle: number;
  radial: number;
  size: number;
  alpha: number;
  ax: number;
  ay: number;
  phase: number;
  k2: number;
  period: number;
  offset: number;
  /** Above this, the label draws a number instead of a word. */
  numericBias: number;
  seed: string;
}

const buildLabels = (
  count: number,
  labelSet: LabelSet,
  width: number,
  height: number,
): LabelSpec[] => {
  const specs: LabelSpec[] = [];
  // v1/v3 lead with numeric readouts; v2 inverts that to mostly words.
  const numericShare = labelSet === "numericDominant" ? 0.76 : 0.28;
  for (let i = 0; i < count; i++) {
    const s = `label-${i}`;
    const period = REROLL_PERIODS[rndInt(`${s}-per`, 0, REROLL_PERIODS.length)];
    specs.push({
      // Golden-angle spacing with a little jitter: labels ring the frame
      // evenly instead of clumping into unreadable overlaps.
      angle: (i * GOLDEN_ANGLE + rndRange(`${s}-ang`, -0.22, 0.22)) % TAU,
      // Pushed out toward the frame edges; the centre is left clear.
      radial:
        0.72 + 0.46 * ((i * R2_ALPHA) % 1) + rndRange(`${s}-rad`, -0.03, 0.03),
      size: rndRange(`${s}-size`, 18, 44),
      alpha: rndRange(`${s}-alpha`, 0.15, 0.42),
      ax: rndRange(`${s}-ax`, 16, 62),
      ay: rndRange(`${s}-ay`, 12, 48),
      phase: rnd(`${s}-ph`) * TAU,
      k2: rnd(`${s}-k2`) < 0.5 ? 2 : 3,
      period,
      offset: rndInt(`${s}-off`, 0, period),
      numericBias: numericShare,
      seed: s,
    });
  }
  return specs;
};

const textFor = (spec: LabelSpec, cycle: number): string => {
  const s = `${spec.seed}-c${cycle}`;
  if (rnd(`${s}-kind`) < spec.numericBias) {
    const digits = rndInt(`${s}-dig`, 2, 5);
    const max = Math.pow(10, digits);
    const value = rndRange(`${s}-val`, Math.pow(10, digits - 1), max - 1);
    return value.toFixed(2);
  }
  // The bracketed fragments are a minority even inside the word pool.
  if (rnd(`${s}-frag`) < 0.22) return rndPick(`${s}-fr`, FRAGMENTS);
  return rndPick(`${s}-w`, WORDS);
};

/**
 * Small uppercase words and numeric readouts scattered around the frame's
 * edges. They drift with the mesh and reroll on periods that divide the loop.
 */
export const LabelField: React.FC<LabelFieldProps> = ({
  width,
  height,
  frame,
  duration,
  palette,
  labelSet,
  count,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labels = useMemo(
    () => buildLabels(count, labelSet, width, height),
    [count, labelSet, width, height],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.textBaseline = "middle";

    const t = (frame / duration) * TAU;
    const cx = width / 2;
    const cy = height / 2;

    for (let i = 0; i < labels.length; i++) {
      const spec = labels[i];
      const local = (frame + spec.offset) % spec.period;
      const cycles = duration / spec.period;
      const cycle =
        Math.floor((frame + spec.offset) / spec.period) % cycles;
      // Fade through the reroll instead of snapping to new text.
      const fade = Math.min(1, Math.min(local, spec.period - local) / 7);
      if (fade <= 0) continue;

      const x =
        cx +
        Math.cos(spec.angle) * spec.radial * cx +
        spec.ax * Math.cos(t + spec.phase);
      const y =
        cy +
        Math.sin(spec.angle) * spec.radial * cy +
        spec.ay * Math.sin(spec.k2 * t + spec.phase);

      ctx.font = `${spec.size}px "DejaVu Sans Mono", monospace`;
      ctx.fillStyle = rgba(palette.labelPale, spec.alpha * fade);
      ctx.fillText(textFor(spec, cycle), x, y);
    }
  });

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
};
