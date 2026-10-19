import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Canvas4K, Ink, InkTexture } from "../lib/Ink";
import { type Drawing, placeDrawing } from "../lib/geometry";
import { type TimedStroke, endOf, schedule } from "../lib/pen";
import { boilStep, rngFor } from "../lib/random";
import {
  type Gen,
  crossHatchBox,
  cube,
  curvedArrow,
  hatchedBox,
  lightbulb,
  scribbleOut,
  sparkleGen,
  spiral,
  star5Gen,
  starOutline,
  straightArrow,
} from "../lib/shapes";
import { INK, PAPER } from "../theme";

export const LOOP = 600;

/** Ruled-paper geometry (4K px). */
const RULE_TOP = 300;
const RULE_GAP = 86;
const MARGIN_X = 520;
const HOLES = [540, 1080, 1620];

type Item = { name: string; gen: Gen; S: number; x: number; y: number; r?: number; start: number };

// Doodles live in the margin, the top and bottom strips and the right
// edge; the centre of the page stays empty for the buyer's content.
const ITEMS: Item[] = [
  { name: "star", gen: star5Gen, S: 90, x: 300, y: 330, start: 20 },
  { name: "spiral", gen: spiral, S: 85, x: 305, y: 720, start: 58 },
  { name: "cube", gen: cube, S: 120, x: 3630, y: 300, start: 96 },
  { name: "bulb", gen: lightbulb, S: 135, x: 300, y: 1120, start: 140 },
  { name: "arrowTop", gen: curvedArrow(0.5), S: 160, x: 1150, y: 150, r: 0.05, start: 185 },
  { name: "hatch", gen: hatchedBox, S: 110, x: 3640, y: 1040, start: 222 },
  { name: "star2", gen: starOutline(5, 0.45), S: 75, x: 3650, y: 1500, start: 262 },
  { name: "arrowBottom", gen: straightArrow(0), S: 170, x: 2600, y: 2040, r: -0.08, start: 296 },
  { name: "crossHatch", gen: crossHatchBox, S: 95, x: 300, y: 1560, start: 330 },
  { name: "sparkle", gen: sparkleGen, S: 80, x: 3000, y: 150, start: 362 },
  { name: "star3", gen: star5Gen, S: 70, x: 300, y: 1930, start: 394 },
];

/** The cube gets scribbled out, then drawn again lower down. */
const SCRIBBLE_START = 430;
const REDRAW = { name: "cubeAgain", gen: cube, S: 115, x: 3630, y: 660, start: 462 };
const FADE_START = 500;

type Built = { strokes: TimedStroke[]; idx: number };

const build = (compId: string): Built[] => {
  const mk = (it: Item, idx: number, total?: number): Built => {
    const raw: Drawing = it.gen(rngFor("nb-shape", it.name), it.S);
    // Nudge every doodle off the tidy margin column, and tilt it a little.
    const j = rngFor("nb-place", it.name);
    const fixed = it.name === "scribble" || it.name === "cube";
    const x = it.x + (fixed ? 0 : (j() * 2 - 1) * 55);
    const y = it.y + (fixed ? 0 : (j() * 2 - 1) * 45);
    const drawing = placeDrawing(raw, { x, y, r: (it.r ?? 0) + (fixed ? 0 : (j() * 2 - 1) * 0.22), s: fixed ? 1 : 0.85 + j() * 0.3 });
    const t = total ?? Math.min(48, Math.max(20, 14 + raw.length * 3.5));
    return { strokes: schedule(drawing, `${compId}:${it.name}`, it.start, { total: t }), idx };
  };
  const out = ITEMS.map((it, i) => mk(it, i));
  const scribble = mk({ name: "scribble", gen: scribbleOut(0.55, 11), S: 150, x: 3630, y: 305, r: -0.15, start: SCRIBBLE_START }, ITEMS.length, 22);
  out.push(scribble, mk(REDRAW, ITEMS.length + 1));
  // Guard: everything finishes drawing before the fade-out begins.
  const last = Math.max(...out.map((b) => endOf(b.strokes)));
  if (last > FADE_START) throw new Error(`Notebook doodles end at ${last}, after the fade at ${FADE_START}`);
  return out;
};

const cache = new Map<string, Built[]>();

const Paper: React.FC = () => (
  <Canvas4K>
    <defs>
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.33  0 0 0 0 0.28  0 0 0 0.9 -0.35" />
      </filter>
      <filter id="mottle" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.0025" numOctaves="3" seed="3" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.46  0 0 0 0 0.36  0 0 0 0.5 -0.18" />
      </filter>
      <linearGradient id="binding" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#3a3226" stopOpacity="0.28" />
        <stop offset="0.35" stopColor="#3a3226" stopOpacity="0.08" />
        <stop offset="1" stopColor="#3a3226" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="hole">
        <stop offset="0.6" stopColor="#d9d4c6" />
        <stop offset="1" stopColor="#bdb6a4" />
      </radialGradient>
    </defs>
    <rect width="3840" height="2160" fill={PAPER.paper} />
    <rect width="3840" height="2160" filter="url(#mottle)" opacity="0.5" />
    {Array.from({ length: Math.floor((2160 - RULE_TOP) / RULE_GAP) + 1 }, (_, i) => (
      <line key={i} x1="0" x2="3840" y1={RULE_TOP + i * RULE_GAP} y2={RULE_TOP + i * RULE_GAP} stroke={PAPER.rule} strokeWidth="3.2" />
    ))}
    <line x1={MARGIN_X} x2={MARGIN_X} y1="0" y2="2160" stroke={PAPER.margin} strokeWidth="4" />
    <line x1={MARGIN_X + 12} x2={MARGIN_X + 12} y1="0" y2="2160" stroke={PAPER.margin} strokeWidth="2" opacity="0.6" />
    {HOLES.map((y) => (
      <circle key={y} cx="95" cy={y} r="38" fill="url(#hole)" />
    ))}
    <rect width="3840" height="2160" filter="url(#grain)" opacity="0.55" />
    <rect width="190" height="2160" fill="url(#binding)" />
  </Canvas4K>
);

export const NotebookPage: React.FC<{ compId: string }> = ({ compId }) => {
  const frame = useCurrentFrame();
  // Loop: frame 600 is frame 0.
  const f = frame % LOOP;
  if (!cache.has(compId)) cache.set(compId, build(compId));
  const items = cache.get(compId)!;
  return (
    <AbsoluteFill style={{ backgroundColor: PAPER.paper }}>
      <Paper />
      <Canvas4K>
        <InkTexture id="tex-ballpoint" mode="alpha" seed={boilStep(f)} freq={0.06} />
        <g filter="url(#tex-ballpoint)">
        {items.map(({ strokes, idx }) => {
          const fadeAt = FADE_START + idx * 5;
          const opacity = interpolate(f, [fadeAt, fadeAt + 30], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          if (opacity <= 0) return null;
          return (
            <g key={idx} opacity={opacity}>
              <Ink strokes={strokes} frame={f} color={INK.ballpoint} seedKey={compId} style={{ size: 6.5, thinning: 0.45, boil: 1.3 }} />
            </g>
          );
        })}
        </g>
      </Canvas4K>
    </AbsoluteFill>
  );
};
