/**
 * Tegaki, driven only by useCurrentFrame().
 *
 * Tegaki's React <TegakiRenderer> creates its engine in useEffect and, in
 * uncontrolled mode, advances time with requestAnimationFrame. For Remotion
 * we instead:
 *  - create the TegakiEngine ourselves in useLayoutEffect, so the canvas is
 *    painted synchronously in the same commit as the frame (no rAF, no
 *    passive-effect race with the screenshot);
 *  - always pass `time: { mode: 'controlled', value: seconds }` computed
 *    from the frame number, so stroke progress depends on the frame only;
 *  - pass a fixed numeric `seed` (Tegaki's 'random' seed uses Math.random);
 *  - load the Caveat font face once, at module level, behind delayRender;
 *  - lay out the word from the bundle's glyph data (advances and cap
 *    height), so placement never depends on whether the browser has
 *    finished loading the font.
 */
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { continueRender, delayRender } from "remotion";
import { TegakiEngine, type TimelineConfig, boilPlugin, variationPlugin } from "tegaki/core";
import caveat from "tegaki/fonts/caveat";
import { handEase } from "../lib/pen";

const fontHandle = delayRender("Tegaki: load the bundled Caveat font face");
TegakiEngine.preload(caveat).then(() => {
  // One animation frame later every engine waiting on the font has redrawn.
  requestAnimationFrame(() => continueRender(fontHandle));
});

/** Line height = the bundle's em box, so there is no half-leading. */
const LINE_HEIGHT = (caveat.ascender - caveat.descender) / caveat.unitsPerEm;

type Glyph = { w: number; s: { p: number[][] }[] };
const glyphs = caveat.glyphData as unknown as Record<string, Glyph>;

/** Ink box of a word in em units (baseline at y = 0, y down), from the bundle's strokes. */
export const wordMetrics = (text: string) => {
  let x = 0;
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const ch of Array.from(text)) {
    const g = glyphs[ch];
    if (!g) {
      x += 250;
      continue;
    }
    for (const s of g.s)
      for (const p of s.p) {
        const half = (p[2] ?? 0) / 2;
        left = Math.min(left, x + p[0] - half);
        right = Math.max(right, x + p[0] + half);
        top = Math.min(top, p[1] - half);
        bottom = Math.max(bottom, p[1] + half);
      }
    x += g.w;
  }
  const H = glyphs.H.s.flatMap((s) => s.p.map((p) => p[1]));
  const em = caveat.unitsPerEm;
  return {
    advance: x / em,
    inkLeft: left / em,
    inkRight: right / em,
    inkTop: top / em,
    inkBottom: bottom / em,
    /** Cap height measured on the H strokes. */
    capHeight: -Math.min(...H) / em,
  };
};

export type TegakiWordProps = {
  text: string;
  /** px */
  fontSize: number;
  /** Left edge of the text box (px). */
  left: number;
  /** Baseline (px). */
  baseline: number;
  color: string;
  frame: number;
  fps: number;
  /** Writing runs from writeStart to writeEnd (frames); after that the boil keeps going. */
  writeStart: number;
  writeEnd: number;
  seed: number;
};

const timing: TimelineConfig = { strokeEasing: handEase, glyphGap: 0.1, wordGap: 0.18 };

export const TegakiWord: React.FC<TegakiWordProps> = ({ text, fontSize, left, baseline, color, frame, fps, writeStart, writeEnd, seed }) => {
  const ref = useRef<HTMLDivElement>(null);
  const engineRef = useRef<TegakiEngine | null>(null);
  // Boil at 10 drawings a second = a new drawing every 3 frames at 30 fps.
  // Variation: each letter leans, drifts off the baseline and changes size a little.
  const plugins = useMemo(() => [variationPlugin({ amount: 1, drift: 0.022, slant: 3, rotation: 2.5 }), boilPlugin({ drawings: 8, fps: fps / 3, amount: 0.004, detail: 0.35, width: 0.05, idle: true })], [fps]);

  useLayoutEffect(() => {
    const engine = new TegakiEngine(ref.current!, {
      text,
      font: caveat,
      seed,
      plugins,
      timing,
      reducedMotion: "never",
      time: { mode: "controlled", value: 0 },
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [text, seed, plugins]);

  useLayoutEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const D = engine.duration;
    // Squeeze Tegaki's natural timeline into the writing window, then keep
    // time running (in real seconds) so the boil continues over the hold.
    const value =
      frame < writeEnd ? (Math.min(1, Math.max(0, (frame - writeStart) / (writeEnd - writeStart))) * D) : D + (frame - writeEnd) / fps;
    engine.update({ time: { mode: "controlled", value } });
  });

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left,
        top: baseline - (caveat.ascender / caveat.unitsPerEm) * fontSize,
        fontSize,
        lineHeight: LINE_HEIGHT,
        color,
        whiteSpace: "nowrap",
        width: wordMetrics(text).advance * fontSize * 1.05,
      }}
    />
  );
};
