import React from "react";
import { type PenStyle, type TimedStroke, strokePath } from "./pen";
import { boilStep } from "./random";

export type InkProps = {
  strokes: TimedStroke[];
  /** Current frame (draw-on uses `drawFrame` if given, e.g. quantized to twos). */
  frame: number;
  drawFrame?: number;
  color: string;
  style: PenStyle;
  /** Composition id: seeds the boil. */
  seedKey: string;
  /** Per-stroke erase progress (0..1) from the tail, by stroke index. */
  erase?: (index: number) => number;
  /** Optional per-path SVG props (e.g. marker streak rims). */
  pathProps?: React.SVGProps<SVGPathElement>;
};

/** Draws timed pen strokes as filled perfect-freehand outlines. */
export const Ink: React.FC<InkProps> = ({ strokes, frame, drawFrame, color, style, seedKey, erase, pathProps }) => {
  const step = boilStep(frame);
  return (
    <>
      {strokes.map((s, i) => {
        const d = strokePath(s, { frame: drawFrame ?? frame, step, seedKey, from: erase?.(i) }, style);
        return d ? <path key={s.id} d={d} fill={color} fillOpacity={s.alpha} {...pathProps} /> : null;
      })}
    </>
  );
};

/** Full-frame SVG in composition (4K) coordinates. */
export const Canvas4K: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <svg
    viewBox="0 0 3840 2160"
    width="100%"
    height="100%"
    style={{ position: "absolute", inset: 0, overflow: "visible", ...style }}
  >
    {children}
  </svg>
);

/**
 * Ink texture as an SVG filter applied to the ink only.
 * - "alpha": the ink's opacity varies ~80-100% (marker/ballpoint grain and
 *   build-up where strokes cross). Transparent pixels stay transparent, so
 *   a pure black background is untouched. Not for green-screen clips.
 * - "tone": the ink's colour varies by up to ~10% while its alpha is kept,
 *   so the ink stays opaque (safe on #00FF00).
 * The noise seed changes with the boil step, so the grain boils too.
 */
export const InkTexture: React.FC<{ id: string; mode: "alpha" | "tone"; seed: number; freq?: number; freqY?: number }> = ({ id, mode, seed, freq = 0.035, freqY }) => (
  <defs>
    <filter id={id} x="0" y="0" width="3840" height="2160" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency={`${freq} ${freqY ?? freq * 0.6}`} numOctaves="3" seed={seed} result="noise" />
      {mode === "alpha" ? (
        <>
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0.64" result="grain" />
          <feComposite in="SourceGraphic" in2="grain" operator="in" />
        </>
      ) : (
        <>
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0.3 0.8  0 0 0 0.3 0.8  0 0 0 0.3 0.8  0 0 0 0 1" result="shade" />
          <feBlend in="SourceGraphic" in2="shade" mode="multiply" result="toned" />
          <feComposite in="toned" in2="SourceGraphic" operator="in" />
        </>
      )}
    </filter>
  </defs>
);
