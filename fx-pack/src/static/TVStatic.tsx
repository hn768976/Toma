import React from "react";
import { AbsoluteFill } from "remotion";
import { GLShader, Uniforms } from "../lib/GLShader";
import { MAX_BURSTS, STATIC_FRAG } from "./shader";

const STATIC_SOFT: [number, number] = [2.2, 1.6]; // slight analogue softness on the grain

type Burst = {
  cx: number; cy: number; radius: number; start: number;
  grow: number; hold: number; angle: number; yScale: number;
};

const packBursts = (bursts: Burst[]): Uniforms => {
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < MAX_BURSTS; i++) {
    const u = bursts[i] ?? { cx: 0, cy: 0, radius: 0, start: -1e6, grow: 1, hold: 0, angle: 0, yScale: 1 };
    a.push(u.cx, u.cy, u.radius, u.start);
    b.push(u.grow, u.hold, u.angle, u.yScale);
  }
  return { "v4:uBurstA": a, "v4:uBurstB": b, uBurstCount: bursts.length };
};

// Clip 4: three bursts, the first large and bottom-left as in the reference.
const DATAMOSH_BURSTS: Burst[] = [
  { cx: 0.45, cy: 1.15, radius: 1.1, start: 24, grow: 26, hold: 66, angle: -0.25, yScale: 2.3 },
  { cx: 0.78, cy: 0.22, radius: 0.24, start: 150, grow: 12, hold: 34, angle: 3.0, yScale: 1.2 },
  { cx: 0.58, cy: 0.66, radius: 0.40, start: 212, grow: 18, hold: 48, angle: 1.4, yScale: 1.5 },
];
const datamoshUniforms = (() => {
  const packed = packBursts(DATAMOSH_BURSTS);
  return (_frame: number): Uniforms => ({ ...packed, uBars: 0, uSquash: 1, uBlack: 0 });
})();

export const TVStatic_Datamosh: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <GLShader body={STATIC_FRAG} uniforms={datamoshUniforms} soft={STATIC_SOFT} />
  </AbsoluteFill>
);

// Clip 5: 2s cut transition (60 frames).
const TRANSITION_BURST: Burst[] = [
  { cx: 0.45, cy: 0.62, radius: 0.75, start: 12, grow: 12, hold: 20, angle: 0.15, yScale: 1.3 },
];
const transitionUniforms = (() => {
  const packed = packBursts(TRANSITION_BURST);
  return (f: number): Uniforms => {
    // 0-0.2s (frames 0-5): black, then 2 frames of rolling bars as static snaps in
    const black = f < 4 ? 1 : 0;
    const bars = f === 4 ? 1 : f === 5 ? 0.6 : 0;
    // 1.6-2s (frames 48-59): collapse to a line, then snap to black
    let squash = 1;
    if (f >= 48) squash = Math.max(0, 1 - Math.pow((f - 47) / 7, 1.6));
    const out = f >= 57 ? 1 : black;
    return { ...packed, uBars: bars, uSquash: squash, uBlack: out };
  };
})();

export const TVStatic_Transition: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <GLShader body={STATIC_FRAG} uniforms={transitionUniforms} soft={STATIC_SOFT} />
  </AbsoluteFill>
);
