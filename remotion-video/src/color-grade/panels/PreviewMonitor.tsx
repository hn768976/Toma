import React from "react";
import { UI } from "../constants";
import { applyGrade, type Grade } from "../grade";
import { clamp, fbm, mix as lerp } from "../noise";

// The shot being graded, synthesised as a stack of soft gradients.
//
// It never has to survive close inspection — in both layouts it sits well
// behind the focal plane and is rendered as bokeh. What it *does* have to
// do is shift colour when the wheels move, because a bright out-of-focus
// area changing hue in sympathy with the grade is a strong, subconscious
// cue that the panels are actually driving something.

type Rgb = [number, number, number];

const BASE_SWATCHES: { rgb: Rgb; x: number; y: number; r: number }[] = [
  { rgb: [0.98, 0.82, 0.55], x: 26, y: 20, r: 66 }, // window practical
  { rgb: [0.72, 0.34, 0.15], x: 66, y: 31, r: 78 }, // warm key
  { rgb: [0.13, 0.38, 0.29], x: 28, y: 74, r: 92 }, // foliage
  { rgb: [0.08, 0.19, 0.34], x: 84, y: 78, r: 96 }, // cool shadow
  { rgb: [0.04, 0.06, 0.1], x: 50, y: 52, r: 150 }, // base
];

const toCss = (grade: Grade, base: Rgb, amount: number, boost: number, alpha: number) => {
  const g = (c: "r" | "g" | "b", v: number) =>
    lerp(v, applyGrade(grade, c, v), amount) * boost;
  const r = clamp(g("r", base[0]), 0, 1);
  const gr = clamp(g("g", base[1]), 0, 1);
  const b = clamp(g("b", base[2]), 0, 1);
  return `rgba(${Math.round(r * 255)},${Math.round(gr * 255)},${Math.round(
    b * 255,
  )},${alpha})`;
};

// Smaller, more saturated accents. Only the full-size viewer uses these:
// once defocused they break into distinct coloured bokeh instead of
// averaging to a single wash, which is what the corner of the reference
// frame actually looks like.
const DETAIL_SWATCHES: { rgb: Rgb; x: number; y: number; r: number }[] = [
  { rgb: [1, 0.9, 0.66], x: 19, y: 17, r: 7 },
  { rgb: [1, 0.62, 0.26], x: 30, y: 30, r: 5.5 },
  { rgb: [0.36, 0.86, 0.72], x: 44, y: 66, r: 6.5 },
  { rgb: [0.28, 0.6, 1], x: 73, y: 44, r: 6 },
  { rgb: [0.9, 0.36, 0.52], x: 61, y: 21, r: 5 },
  { rgb: [0.5, 0.95, 0.4], x: 22, y: 78, r: 6 },
  { rgb: [1, 0.78, 0.4], x: 52, y: 38, r: 4.5 },
  { rgb: [0.4, 0.9, 1], x: 86, y: 63, r: 5 },
  { rgb: [1, 0.5, 0.3], x: 12, y: 52, r: 5.5 },
];

/**
 * CSS `background` for a thumbnail of the shot under `grade`.
 * `amount` blends between ungraded (0) and fully graded (1).
 */
export const gradedSwatch = (
  grade: Grade,
  frame: number,
  amount: number,
  detailed = false,
) => {
  // A slow luminance breathe so the "footage" is never frozen.
  const boost = 0.92 + 0.12 * fbm(frame * 0.012, 5, 2);
  const set = detailed ? [...DETAIL_SWATCHES, ...BASE_SWATCHES] : BASE_SWATCHES;
  const layers = set.map((s) => {
    const solid = toCss(grade, s.rgb, amount, boost, 1);
    const clear = toCss(grade, s.rgb, amount, boost, 0);
    const drift = (fbm(frame * 0.01 + s.x, s.y, 2) - 0.5) * 5;
    return `radial-gradient(circle at ${s.x + drift}% ${
      s.y - drift * 0.6
    }%, ${solid} 0%, ${clear} ${s.r}%)`;
  });
  return `${layers.join(",")}, #06090d`;
};

type Props = {
  width: number;
  height: number;
  grade: Grade;
  frame: number;
  label?: string;
};

export const PreviewMonitor: React.FC<Props> = ({
  width,
  height,
  grade,
  frame,
  label,
}) => (
  <div
    style={{
      width,
      height,
      position: "relative",
      background: "#05080c",
      border: `1px solid ${UI.edgeLine}`,
      overflow: "hidden",
    }}
  >
    {/* The viewer is emissive — it is the brightest thing in the room,
        and in the reference it is what blooms into the defocused corner. */}
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: gradedSwatch(grade, frame, 1, true),
        filter: "brightness(1.32) saturate(1.15)",
      }}
    />
    {/* Letterbox bars — a grading viewer is almost always masked. */}
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: height * 0.085,
        background: "#04060a",
      }}
    />
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: height * 0.085,
        background: "#04060a",
      }}
    />
    {label ? (
      <div
        style={{
          position: "absolute",
          left: width * 0.02,
          bottom: height * 0.1,
          fontSize: height * 0.06,
          color: "rgba(226,238,247,0.75)",
          letterSpacing: height * 0.004,
        }}
      >
        {label}
      </div>
    ) : null}
  </div>
);
