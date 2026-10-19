import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { Canvas4K, Ink } from "../lib/Ink";
import { bounds, placeDrawing } from "../lib/geometry";
import { schedule } from "../lib/pen";
import { rngFor } from "../lib/random";
import { HEIGHT, WIDTH } from "../theme";
import { SHEETS } from "./sheets";

const MARGIN = 110;

/** A clip-art sheet: finished elements on a grid, transparent background. */
export const ClipArtSheet: React.FC<{ sheetId: string }> = ({ sheetId }) => {
  const sheet = SHEETS.find((s) => s.id === sheetId)!;
  const strokes = useMemo(() => {
    const cw = (WIDTH - MARGIN * 2) / sheet.cols;
    const ch = (HEIGHT - MARGIN * 2) / sheet.rows;
    return sheet.gens.flatMap((gen, i) => {
      const raw = gen(rngFor(sheet.seedKey, i), sheet.S);
      const b = bounds(raw);
      // Fit inside 84% of the cell and centre it.
      const k = Math.min(1, (cw * 0.84) / b.w, (ch * 0.8) / b.h);
      const cx = MARGIN + cw * ((i % sheet.cols) + 0.5);
      const cy = MARGIN + ch * (Math.floor(i / sheet.cols) + 0.5);
      const placed = placeDrawing(
        raw.map((s) => ({ ...s, pts: s.pts.map(([x, y]): [number, number] => [x - b.cx, y - b.cy]) })),
        { x: cx, y: cy, s: k },
      );
      return schedule(placed, `${sheet.id}:${i}`, -1000);
    });
  }, [sheet]);
  return (
    <AbsoluteFill>
      <Canvas4K>
        <Ink strokes={strokes} frame={0} color={sheet.ink} seedKey={sheet.id} style={{ size: 15, thinning: 0.6 }} />
      </Canvas4K>
    </AbsoluteFill>
  );
};
