import React, { useMemo } from "react";
import { random, useCurrentFrame } from "remotion";
import { hexToRgb, rgba } from "./color";
import { useCanvasLayer, useMonoFont } from "./hooks";
import { HEIGHT, WIDTH, ambientDrift, type Flow } from "./layout";
import type { VariantConfig } from "./variants";

interface Cell {
  readonly char: string;
  readonly alpha: number;
}

/**
 * Faint bands of illegible monospace characters over a broad radial wash.
 * The bands run across the flow axis and drift with it, tiling exactly so
 * frame 600 lands back on frame 0.
 */
export const CodeBackdrop: React.FC<{
  readonly config: VariantConfig;
  readonly flow: Flow;
}> = ({ config, flow }) => {
  const frame = useCurrentFrame();
  const fontFamily = useMonoFont();
  const backdrop = config.backdrop;
  const vertical = backdrop.orientation === "vertical";

  const lineCount =
    Math.ceil((vertical ? WIDTH : HEIGHT) / backdrop.lineStep) + 2;
  const slotCount =
    Math.ceil((vertical ? HEIGHT : WIDTH) / backdrop.glyphStep) + 3;

  /** Character content is fixed; only the strip's offset changes per frame. */
  const cells = useMemo(() => {
    const grid: Cell[][] = [];
    for (let line = 0; line < lineCount; line++) {
      const row: Cell[] = [];
      for (let slot = 0; slot < backdrop.patternSlots; slot++) {
        const seed = `backdrop-${backdrop.orientation}-${line}-${slot}`;
        row.push({
          char: backdrop.glyphs.charAt(
            Math.floor(random(seed) * backdrop.glyphs.length),
          ),
          alpha: 0.28 + 0.95 * random(`${seed}-a`) ** 1.8,
        });
      }
      grid.push(row);
    }
    return grid;
  }, [backdrop, lineCount]);

  const ref = useCanvasLayer(WIDTH, HEIGHT, (ctx) => {
    const { palette } = config;

    // Deep base, drawn without the ambient drift so no edge is ever exposed.
    ctx.fillStyle = palette.backgroundDeep;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const drift = ambientDrift(frame);
    ctx.translate(drift.dx, drift.dy);

    // Broad soft radial wash behind everything else.
    const washRgb = hexToRgb(palette.backgroundWash);
    const cx = flow.x(0.34);
    const cy = HEIGHT * 0.5;
    const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, WIDTH * 0.66);
    wash.addColorStop(0, rgba(washRgb, 0.8));
    wash.addColorStop(0.45, rgba(washRgb, 0.36));
    wash.addColorStop(1, rgba(washRgb, 0));
    ctx.fillStyle = wash;
    ctx.fillRect(-WIDTH, -HEIGHT, WIDTH * 3, HEIGHT * 3);

    // Character bands.
    const step = backdrop.glyphStep;
    const patternPx = backdrop.patternSlots * step;
    // Drift follows the strands; vertical bands simply fall downward.
    const sign = vertical ? 1 : flow.direction;
    let offset = (((frame % 600) / 600) * backdrop.driftSlots * step * sign) % patternPx;
    if (offset < 0) {
      offset += patternPx;
    }
    const subStep = offset % step;
    const slotShift = Math.floor(offset / step);

    ctx.font = `${backdrop.fontSize}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = palette.backdropText;

    const textRgb = hexToRgb(palette.backdropText);
    for (let line = 0; line < lineCount; line++) {
      if (line % backdrop.bandStride >= backdrop.bandLines) {
        continue;
      }
      const across = line * backdrop.lineStep + backdrop.lineStep * 0.5;
      const row = cells[line];
      for (let j = -1; j < slotCount; j++) {
        const along = j * step + subStep;
        const cell =
          row[
            (((j - slotShift) % backdrop.patternSlots) + backdrop.patternSlots) %
              backdrop.patternSlots
          ];
        ctx.fillStyle = rgba(textRgb, cell.alpha * backdrop.alpha);
        if (vertical) {
          ctx.fillText(cell.char, across, along);
        } else {
          ctx.fillText(cell.char, along, across);
        }
      }
    }
  });

  return (
    <canvas
      ref={ref}
      width={WIDTH}
      height={HEIGHT}
      style={{ position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT }}
    />
  );
};
