import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Canvas4K, Ink, InkTexture } from "../lib/Ink";
import { type Pt, pointAt } from "../lib/geometry";
import { type PressureFn, type TimedStroke } from "../lib/pen";
import { boilStep, rngFor } from "../lib/random";
import { sketch } from "../lib/shapes";
import { BG, INK } from "../theme";

/**
 * One continuous abstract flourish: a wide outward volute (spiral) on the
 * left, a long S-swash, and an inward volute on the right, then an ink
 * dot. Multi-turn spirals and open swashes only, with no small single
 * loops, so nothing reads as a letter.
 */
const LEFT: Pt = [1060, 1000];
const RIGHT: Pt = [2830, 1010];
const spiralPts = (c: Pt, a0: number, a1: number, r0: number, r1: number, n: number, squash: number): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const a = a0 + (a1 - a0) * t;
    // Uneven coil growth and a drifting centre: a hand, not a compass.
    const r = (r0 + (r1 - r0) * Math.pow(t, 0.9)) * (1 + 0.07 * Math.sin(a * 0.6 + r0));
    return [c[0] + Math.cos(a) * r + 30 * t, c[1] + Math.sin(a) * r * squash - 20 * t];
  });
const SWASH: Pt[] = [
  [1450, 1330],
  [1780, 1230],
  [2030, 1030],
  [2250, 900],
  [2480, 845],
];

const DRAW_START = 8;
const DRAW_END = 104;
const DOT_START = 112;

/** Broad nib held at -35deg: down-strokes thick, up-right hairlines thin. */
const NIB = (-35 * Math.PI) / 180;
const nibPressure: PressureFn = (speed, pts, cum, s) => {
  const a = pointAt(pts, cum, s - 4);
  const b = pointAt(pts, cum, s + 4);
  const theta = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const nib = Math.pow(Math.abs(Math.sin(theta - NIB)), 1.3);
  return 0.1 + 0.8 * nib + 0.15 * (speed - 0.5);
};

const build = (compId: string): TimedStroke[] => {
  const rng = rngFor(compId, "flourish");
  // Left volute: 1.6 turns outwards, leaving at the bottom heading right.
  const inner = spiralPts(LEFT, Math.PI / 2 + Math.PI * 2 * 1.6, Math.PI / 2, 45, 330, 220, 0.88);
  // Right volute: enters at the top heading right, 1.5 turns inwards.
  const outer = spiralPts(RIGHT, -Math.PI / 2 - 0.35, -Math.PI / 2 - 0.35 + Math.PI * 2 * 1.2, 250, 95, 170, 0.72);
  const swash = sketch(rng, [inner[inner.length - 1], ...SWASH, outer[0]], 1000, 0.003, 0.001);
  const pts = [...inner, ...swash.slice(1, -1), ...outer];
  const dotC: Pt = [3260, 1240];
  return [
    { pts, id: `${compId}:flourish`, start: DRAW_START, dur: DRAW_END - DRAW_START },
    // The dot: a short pressed dab with a tail, not a circle.
    { pts: [dotC, [dotC[0] + 9, dotC[1] + 4], [dotC[0] + 20, dotC[1] + 14]], id: `${compId}:dot`, start: DOT_START, dur: 5, weight: 0.75 },
  ];
};

const cache = new Map<string, TimedStroke[]>();

export const InkFlourish: React.FC<{ compId: string }> = ({ compId }) => {
  const frame = useCurrentFrame();
  if (!cache.has(compId)) cache.set(compId, build(compId));
  const [flourish, dot] = cache.get(compId)!;
  return (
    <AbsoluteFill style={{ backgroundColor: BG.black }}>
      <Canvas4K>
        <InkTexture id="tex-flourish" mode="alpha" seed={boilStep(frame)} freq={0.02} />
        <g filter="url(#tex-flourish)">
        <Ink
          strokes={[flourish]}
          frame={frame}
          color={INK.white}
          seedKey={compId}
          style={{ size: 50, thinning: 0.92, smoothing: 0.7, streamline: 0.15, taper: [140, 260], boil: 2.5, pressure: nibPressure }}
        />
        <Ink strokes={[dot]} frame={frame} color={INK.white} seedKey={compId} style={{ size: 60, thinning: 0.5, taper: [0, 18], boil: 1.5 }} />
        </g>
      </Canvas4K>
    </AbsoluteFill>
  );
};
