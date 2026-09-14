import React from "react";
import { AreaChart, BarChart, BarRows, HeatGrid, StepTrace } from "./charts";
import { Grid, Panel, TextRows, TickStrip, Ticker, type Box } from "./primitives";
import { makeRandom } from "./rng";

/**
 * Secondary instruments that tile a rectangle with small panels.
 *
 * The console has to read as wall-to-wall hardware: any patch of bare surface
 * inside the frame looks like a gap in the design rather than breathing room.
 * Rather than hand-placing a panel into every hole - and re-doing it whenever
 * the layout moves - the holes are declared as rectangles and filled
 * procedurally.
 *
 * The mix is weighted towards cheap, static content. These panels are texture,
 * not information, and there are roughly a hundred of them; giving each one a
 * live scrolling plot would cost more render time than the whole foreground.
 */
export const FillerField: React.FC<{
  box: Box;
  seed: string;
  /** Target cell size; the field rounds to a whole number of cells. */
  cellW?: number;
  cellH?: number;
  /** Held below the foreground so the real console still reads as the subject. */
  opacity?: number;
}> = ({ box, seed, cellW = 300, cellH = 175, opacity = 0.62 }) => {
  const cols = Math.max(1, Math.round(box.w / cellW));
  const rows = Math.max(1, Math.round(box.h / cellH));
  const w = box.w / cols;
  const h = box.h / rows;
  const random = makeRandom(seed);

  return (
    <g opacity={opacity}>
      {Array.from({ length: cols * rows }, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cell: Box = {
          x: box.x + col * w + 8,
          y: box.y + row * h + 8,
          w: w - 16,
          h: h - 16,
        };
        const plot: Box = {
          x: cell.x + 10,
          y: cell.y + 24,
          w: cell.w - 20,
          h: cell.h - 34,
        };
        const kind = random();
        const id = `${seed}-${i}`;
        const label = `${String.fromCharCode(65 + Math.floor(random() * 26))}${String(
          Math.floor(random() * 90) + 10,
        )}`;

        return (
          <Panel key={id} box={cell} label={label} corners={false}>
            {kind < 0.3 ? (
              <TextRows box={plot} seed={id} rows={Math.max(3, Math.round(plot.h / 14))} />
            ) : kind < 0.5 ? (
              <BarRows box={plot} seed={id} rows={3} speed={0.6} />
            ) : kind < 0.65 ? (
              <>
                <Grid box={plot} cols={6} rows={3} opacity={0.4} />
                <TickStrip box={plot} count={20} seed={id} />
              </>
            ) : kind < 0.78 ? (
              <BarChart box={plot} seed={id} bars={9} accentEvery={4} />
            ) : kind < 0.88 ? (
              <StepTrace box={plot} seed={id} steps={14} />
            ) : kind < 0.95 ? (
              <AreaChart box={plot} seed={id} samples={18} speed={0.7} />
            ) : (
              <HeatGrid box={plot} seed={id} cols={8} rows={3} speed={0.6} />
            )}
            {random() > 0.55 ? (
              <Ticker
                x={cell.x + cell.w - 10}
                y={cell.y + 15}
                seed={`${id}-n`}
                digits={3}
                anchor="end"
                size={10}
                period={14}
              />
            ) : null}
          </Panel>
        );
      })}
    </g>
  );
};
