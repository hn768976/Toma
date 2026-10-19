import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Canvas4K, InkTexture } from "../lib/Ink";
import { type Drawing, type Pt, handLine } from "../lib/geometry";
import { type PenStyle, type TimedStroke, schedule, strokePath } from "../lib/pen";
import { boilStep, range, rngFor, signed } from "../lib/random";
import { BG, HEIGHT, WIDTH } from "../theme";

/** Fat marker: about 520 px wide at 4K. */
const MARKER = 520;
/** Horizontal advance per pass; < half the marker width so passes overlap. */
const ADVANCE = 200;
const OVER_X = 360;
const TOP = -320;
const BOTTOM = HEIGHT + 320;

export const COVER_END = 36; // 1.2 s: frame fully covered
export const ERASE_START = 48; // 1.6 s
export const ERASE_END = 87; // all green again before 3 s

const markerStyle: PenStyle = { size: MARKER, sizeJitter: 0.06, thinning: 0.15, smoothing: 0.5, streamline: 0.1, taper: [60, 60], boil: 2 };
const streakStyle: PenStyle = { size: 7, thinning: 0.6, taper: [500, 700], boil: 2 };

type Pass = { body: TimedStroke; streaks: TimedStroke[]; rim: number };

const buildPasses = (compId: string): Pass[] => {
  const rng = rngFor(compId, "scribble");
  const zig: Pt[] = [];
  let x = -OVER_X;
  let down = true;
  zig.push([x, TOP + signed(rng, 60)]);
  while (x < WIDTH + OVER_X) {
    // Uneven arm swings: the advance and the turning points wander.
    x += ADVANCE * range(rng, 0.78, 1.15);
    down = !down;
    zig.push([x + signed(rng, 40), (down ? TOP - range(rng, 0, 220) : BOTTOM + range(rng, 0, 220))]);
  }
  // One pass per diagonal, each slightly bowed like a real arm swing.
  const drawing: Drawing = [];
  for (let i = 0; i < zig.length - 1; i++) {
    drawing.push({ pts: handLine(rng, zig[i], zig[i + 1], { bow: signed(rng, 0.05), wobble: 10 }) });
  }
  const bodies = schedule(drawing, `${compId}:pass`, 0, { total: COVER_END - 1, lift: [0, 0], minDur: 0.5 });
  return bodies.map((body, i) => {
    // Lengthwise streaks inside the stroke, where the marker felt is uneven.
    const sr = rngFor(compId, "streaks", i);
    const offsets = Array.from({ length: Math.floor(sr() * 3) }, () => range(sr, -0.38, 0.38));
    const streaks = offsets.map((off, k) => {
      const a = body.pts[0];
      const b = body.pts[body.pts.length - 1];
      const nx = -(b[1] - a[1]);
      const ny = b[0] - a[0];
      const nl = Math.hypot(nx, ny) || 1;
      const o: Pt = [(nx / nl) * off * MARKER, (ny / nl) * off * MARKER];
      const pts = body.pts.map((p): Pt => [p[0] + o[0] + Math.sin(p[1] / 300 + k) * 6, p[1] + o[1]]);
      return { ...body, id: `${body.id}:streak${k}`, pts: pts.slice(Math.floor(pts.length * range(sr, 0, 0.35)), Math.ceil(pts.length * range(sr, 0.6, 1))) };
    });
    return { body: { ...body, id: `${body.id}:${i}` }, streaks, rim: range(sr, 5, 14) };
  });
};

const cache = new Map<string, Pass[]>();

export const ScribbleWipe: React.FC<{ compId: string; color: string; streak: string }> = ({ compId, color, streak }) => {
  const frame = useCurrentFrame();
  if (!cache.has(compId)) cache.set(compId, buildPasses(compId));
  const passes = cache.get(compId)!;
  const step = boilStep(frame);
  const n = passes.length;
  // Un-scribble: passes are erased in drawing order, each from its tail.
  const eraseSlot = (ERASE_END - ERASE_START) / n;
  const eraseFrom = (i: number) => {
    const t0 = ERASE_START + i * eraseSlot;
    return Math.min(1, Math.max(0, (frame - t0) / (eraseSlot * 1.15)));
  };
  return (
    <AbsoluteFill style={{ backgroundColor: BG.green }}>
      <Canvas4K>
        {/* Felt streaks: colour-only texture, alpha untouched (keys cleanly on green). */}
        <InkTexture id={`tex-${compId}`} mode="tone" seed={step} freq={0.012} freqY={0.0012} />
        <g filter={`url(#tex-${compId})`}>
        {passes.map((pass, i) => {
          const from = eraseFrom(i);
          const state = { frame, step, seedKey: compId, from };
          const d = strokePath(pass.body, state, markerStyle);
          if (!d) return null;
          return (
            <g key={pass.body.id}>
              <path d={d} fill={color} stroke={streak} strokeWidth={pass.rim} strokeLinejoin="round" />
              {pass.streaks.map((s) => {
                const sd = strokePath(s, { ...state, from: Math.max(from, 0) }, streakStyle);
                return sd ? <path key={s.id} d={sd} fill={streak} /> : null;
              })}
            </g>
          );
        })}
        </g>
      </Canvas4K>
    </AbsoluteFill>
  );
};

