import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Canvas4K, Ink, InkTexture } from "../lib/Ink";
import { type Drawing, placeDrawing } from "../lib/geometry";
import { type TimedStroke, schedule } from "../lib/pen";
import { boilStep, rngFor } from "../lib/random";
import {
  type Gen,
  check,
  circle,
  cross,
  curlyBrace,
  curvedArrow,
  doubleUnderline,
  loopArrow,
  speechBubble,
  star5Gen,
  straightArrow,
  burst,
  underline,
} from "../lib/shapes";
import { BG, MARKER_SIZE } from "../theme";

type DoodleSlot = { name: string; gen: Gen; S: number; col: number; row: number; r?: number };

/** In order of appearance; grid cells are shuffled so each lands somewhere new. */
const SLOTS: DoodleSlot[] = [
  { name: "curvedArrow", gen: curvedArrow(0.7), S: 330, col: 0, row: 0, r: 0.15 },
  { name: "circle", gen: circle(1, 0.72), S: 340, col: 2, row: 1 },
  { name: "star", gen: star5Gen, S: 200, col: 3, row: 0 },
  { name: "underline", gen: underline(true), S: 400, col: 1, row: 2 },
  { name: "check", gen: check(0, 0.08), S: 190, col: 0, row: 1 },
  { name: "loopArrow", gen: loopArrow(1), S: 320, col: 3, row: 2, r: -0.2 },
  { name: "sparkleBurst", gen: burst(9, 0.42, 1), S: 190, col: 2, row: 0 },
  { name: "straightArrow", gen: straightArrow(0), S: 300, col: 3, row: 1, r: 0.5 },
  { name: "doubleUnderline", gen: doubleUnderline, S: 360, col: 1, row: 0 },
  { name: "speechBubble", gen: speechBubble(-1), S: 290, col: 2, row: 2 },
  { name: "cross", gen: cross(), S: 150, col: 1, row: 1 },
  { name: "bracket", gen: curlyBrace(1), S: 260, col: 0, row: 2 },
];

const COLS = [560, 1450, 2420, 3290];
const ROWS = [440, 1090, 1730];
export const DOODLE_FIRST = 12;
export const DOODLE_EVERY = 24;
export const FADE_START = 300;

const buildDoodles = (compId: string) =>
  SLOTS.map((slot, i) => {
    const rng = rngFor(compId, "doodle", slot.name);
    const x = COLS[slot.col] + (rng() * 2 - 1) * 90;
    const y = ROWS[slot.row] + (rng() * 2 - 1) * 60;
    const raw: Drawing = slot.gen(rngFor("doodle-shape", slot.name), slot.S);
    const drawing = placeDrawing(raw, { x, y, r: slot.r ?? 0 });
    const length = raw.reduce((a, s) => a + s.pts.length * 6, 0);
    // Each doodle draws on in 0.4-1 s (12-30 frames), lifts included.
    const total = Math.min(30, Math.max(12, 10 + raw.length * 2.5 + length / 260));
    const strokes = schedule(drawing, `${compId}:${slot.name}`, DOODLE_FIRST + i * DOODLE_EVERY, { total });
    return { strokes, index: i };
  });

const cache = new Map<string, { strokes: TimedStroke[]; index: number }[]>();

export const DoodlePack: React.FC<{ compId: string; background: string; color: string }> = ({ compId, background, color }) => {
  const frame = useCurrentFrame();
  if (!cache.has(compId)) cache.set(compId, buildDoodles(compId));
  const doodles = cache.get(compId)!;
  // Doodles move on twos.
  const drawFrame = Math.floor(frame / 2) * 2;
  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <Canvas4K>
        {/* Grain in the ink only: alpha grain on black, tone-only on green so the ink stays opaque. */}
        <InkTexture id={`tex-${compId}`} mode={background === BG.green ? "tone" : "alpha"} seed={boilStep(frame)} />
        <g filter={`url(#tex-${compId})`}>
        {doodles.map(({ strokes, index }) => {
          const fadeAt = FADE_START + index * 3.5;
          const opacity = interpolate(drawFrame, [fadeAt, fadeAt + 14], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          if (opacity <= 0) return null;
          return (
            <g key={index} opacity={opacity}>
              <Ink strokes={strokes} frame={frame} drawFrame={drawFrame} color={color} seedKey={compId} style={{ size: MARKER_SIZE, thinning: 0.65, boil: 2.2 }} />
            </g>
          );
        })}
        </g>
      </Canvas4K>
    </AbsoluteFill>
  );
};
