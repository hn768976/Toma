import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { WordMark, WordRow } from "../data/words";
import { Canvas4K, Ink, InkTexture } from "../lib/Ink";
import { type Drawing, type Pt, handLine } from "../lib/geometry";
import { schedule } from "../lib/pen";
import { boilStep, rngFor } from "../lib/random";
import { arrowHead, heartLine, sketch } from "../lib/shapes";
import { BG, HEIGHT, INK, WIDTH } from "../theme";
import { TegakiWord, wordMetrics } from "./TegakiWord";

/** Timings in seconds, from the brief. */
const WRITE_START = 0.5;
const WRITE_END = 3.5;
const MARK_END = 4.5;
/** Cap height = 22% of frame height. */
const CAP_HEIGHT = 0.22 * HEIGHT;

type Layout = ReturnType<typeof layoutFor>;

const layoutFor = (text: string) => {
  const m = wordMetrics(text);
  const fontSize = CAP_HEIGHT / m.capHeight;
  // Centre the ink horizontally; centre the cap band vertically.
  const inkW = (m.inkRight - m.inkLeft) * fontSize;
  const left = (WIDTH - inkW) / 2 - m.inkLeft * fontSize;
  const baseline = HEIGHT / 2 + CAP_HEIGHT / 2;
  return { m, fontSize, left, baseline };
};

/** The extra pen mark, in 4K px. */
const markDrawing = (mark: WordMark, L: Layout, seed: number): Drawing => {
  const { m, fontSize: fs, left, baseline } = L;
  const rng = rngFor("mark", mark, seed);
  const X = (em: number) => left + em * fs;
  const Y = (em: number) => baseline + em * fs;
  const ink = { l: m.inkLeft, r: m.inkRight, b: Math.max(m.inkBottom, 0.05), cap: m.capHeight };
  switch (mark) {
    case "underline": {
      const y = Y(ink.b + 0.13);
      const pts = handLine(rng, [X(ink.l - 0.04), y + 6], [X(ink.r + 0.06), y - 14], { bow: -0.012 });
      pts.push([pts[pts.length - 1][0] + 0.05 * fs, pts[pts.length - 1][1] - 0.07 * fs]);
      return [{ pts }];
    }
    case "heart": {
      const S = 0.3 * fs;
      const c: Pt = [X(ink.r + 0.12) + S, Y(-ink.cap * 0.5)];
      return [{ pts: heartLine(rng, S, 1.05, c) }];
    }
    case "flourish": {
      const r = ink.r;
      const l = ink.l;
      const ctrl: Pt[] = [
        [X(r - 0.22), Y(0.14)],
        [X(r + 0.04), Y(0.1)],
        [X(r + 0.16), Y(0.26)],
        [X(r - 0.02), Y(0.4)],
        [X(r - 0.16), Y(0.27)],
        [X(r - 0.02), Y(0.17)],
        [X(r - 0.3), Y(0.36)],
        [X((r + l) / 2), Y(0.43)],
        [X(l + 0.25), Y(0.37)],
        [X(l - 0.08), Y(0.24)],
      ];
      return [{ pts: sketch(rng, ctrl, fs, 0.006, 0.002) }];
    }
    case "arrow": {
      const a: Pt = [X(ink.r + 0.06), Y(-ink.cap * 0.55)];
      const b: Pt = [X(ink.r + 0.55), Y(0.42)];
      const shaft = sketch(rng, [a, [a[0] + 0.32 * fs, a[1] + 0.04 * fs], [b[0] - 0.05 * fs, b[1] - 0.3 * fs], b], fs, 0.004, 0.002);
      const p = shaft[shaft.length - 6];
      const ang = Math.atan2(b[1] - p[1], b[0] - p[0]);
      return [{ pts: shaft }, ...arrowHead(rng, b, ang, 0.2 * fs, "v")];
    }
    default:
      return [];
  }
};

export const Handwritten: React.FC<{ row: WordRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useMemo(() => layoutFor(row.text), [row.text]);
  const strokes = useMemo(
    () => schedule(markDrawing(row.mark, L, row.seed), `${row.id}:mark`, WRITE_END * fps, { total: (MARK_END - WRITE_END) * fps - 4 }),
    [row, L, fps],
  );
  return (
    <AbsoluteFill style={{ backgroundColor: BG.black }}>
      <Canvas4K>
        <InkTexture id="tex-word" mode="alpha" seed={boilStep(frame)} freq={0.03} />
      </Canvas4K>
      {/* The same ink grain on Tegaki's canvas (CSS filter) and on the pen mark. */}
      <AbsoluteFill style={{ filter: "url(#tex-word)" }}>
      <TegakiWord
        text={row.text}
        fontSize={L.fontSize}
        left={L.left}
        baseline={L.baseline}
        color={INK.white}
        frame={frame}
        fps={fps}
        writeStart={WRITE_START * fps}
        writeEnd={WRITE_END * fps}
        seed={row.seed}
      />
      </AbsoluteFill>
      <Canvas4K>
        <g filter="url(#tex-word)">
        <Ink strokes={strokes} frame={frame} color={INK.white} seedKey={row.id} style={{ size: 0.05 * L.fontSize, thinning: 0.6, boil: 2.5 }} />
        </g>
      </Canvas4K>
    </AbsoluteFill>
  );
};
