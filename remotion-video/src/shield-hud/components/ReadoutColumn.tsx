import { useLayoutEffect, useMemo } from "react";
import { random } from "remotion";
import { DURATION_IN_FRAMES } from "../constants";
import { READOUT_FONT, useFontReady } from "../font";
import { onPlane, rgba, useScene } from "../scene";

const CHROME_PAD = 120;
const LABELS = ["IDX", "CHN", "SYN", "REF", "BUS", "SEG", "KEY", "VLT", "TRC", "AMP"];

/**
 * A vertical stack of right-aligned numeric cells with its own tick scale,
 * rules and boxes. Values are texture, not information: legible as shapes,
 * unreadable as numbers.
 *
 * The chrome around the values never changes, so it is rendered once to an
 * offscreen canvas; only the values, the highlight boxes, the tick marker
 * and the meter are redrawn each frame.
 */
export const ReadoutColumn: React.FC<{ index: number }> = ({ index }) => {
  const { buffers, palette, variant, layout, readouts, drift, frame, seed } = useScene();
  const fontReady = useFontReady();
  const density = variant.panelDensity;
  const column = density.columns[index];
  const layer = buffers[column.depth];

  const rows = density.rows;
  const gap = density.rowGap;
  const boxWidth = 520;
  const boxHeight = (rows - 1) * gap + CHROME_PAD * 2;
  const originX = column.x - boxWidth + 90;
  const originY = layout.columnTop - CHROME_PAD;

  const chrome = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = boxWidth;
    canvas.height = boxHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not acquire a 2D context for column chrome");
    const scaleRuleX = 118;
    const valueRight = boxWidth - 90;

    // Tick scale: a thin vertical rule with small perpendicular ticks.
    ctx.strokeStyle = rgba(palette.tickPale, 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scaleRuleX, CHROME_PAD * 0.45);
    ctx.lineTo(scaleRuleX, boxHeight - CHROME_PAD * 0.45);
    ctx.stroke();

    const tickCount = rows * 3;
    for (let t = 0; t <= tickCount; t++) {
      const y = CHROME_PAD * 0.45 + (t / tickCount) * (boxHeight - CHROME_PAD * 0.9);
      const long = t % 3 === 0;
      ctx.strokeStyle = rgba(palette.tickPale, long ? 0.62 : 0.3);
      ctx.lineWidth = long ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(scaleRuleX, y);
      ctx.lineTo(scaleRuleX + (long ? 26 : 14), y);
      ctx.stroke();
    }

    // A second, closer rule just past the values.
    ctx.strokeStyle = rgba(palette.tickPale, 0.28);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(valueRight + 34, CHROME_PAD * 0.7);
    ctx.lineTo(valueRight + 34, boxHeight - CHROME_PAD * 0.7);
    ctx.stroke();

    // Group separators every few rows, plus a header rule.
    for (let r = 0; r < rows; r += 3) {
      const y = CHROME_PAD + r * gap - gap * 0.55;
      ctx.strokeStyle = rgba(palette.tickPale, 0.16);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(scaleRuleX + 40, y);
      ctx.lineTo(valueRight + 20, y);
      ctx.stroke();
    }

    ctx.fillStyle = rgba(palette.tickPale, 0.34);
    ctx.fillRect(scaleRuleX + 40, CHROME_PAD - gap * 0.95, 150, 8);
    ctx.fillRect(valueRight - 60, CHROME_PAD - gap * 0.95, 80, 8);

    // Small empty boxes, the sort that carry a status glyph on a real panel.
    for (let i = 0; i < 3; i++) {
      const y = CHROME_PAD + (rows - 1) * gap + 34 + i * 0;
      ctx.strokeStyle = rgba(palette.tickPale, 0.3);
      ctx.lineWidth = 2;
      ctx.strokeRect(scaleRuleX + 40 + i * 58, y, 44, 30);
    }

    return canvas;
  }, [boxHeight, boxWidth, gap, palette, rows]);

  useLayoutEffect(() => {
    // Canvas text takes no part in font swapping, so the column waits for
    // the face rather than baking a fallback into the frame.
    if (!fontReady) return;
    const loopFrame = frame % DURATION_IN_FRAMES;
    const columnAlpha = readouts.columnAlpha(index, frame);
    if (columnAlpha <= 0) return;

    onPlane(layer, drift, (ctx) => {
      ctx.globalAlpha = columnAlpha;
      ctx.drawImage(chrome, originX, originY);

      const valueRight = originX + boxWidth - 90;
      const scaleRuleX = originX + 118;
      ctx.font = `500 ${density.fontSize}px ${READOUT_FONT}, monospace`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";

      for (let r = 0; r < rows; r++) {
        const cell = readouts.cell(index, r, frame);
        if (cell.dark) continue;
        const y = layout.columnTop + r * gap;

        if (cell.highlighted) {
          const width = density.fontSize * 3.1;
          ctx.fillStyle = rgba(palette.readoutWhite, 0.22);
          ctx.fillRect(valueRight - width, y - density.fontSize * 0.72, width + 16, density.fontSize * 1.44);
          ctx.strokeStyle = rgba(palette.readoutWhite, 0.5);
          ctx.lineWidth = 2;
          ctx.strokeRect(valueRight - width, y - density.fontSize * 0.72, width + 16, density.fontSize * 1.44);
        }

        ctx.fillStyle = cell.dim
          ? rgba(palette.readoutDim, 0.85)
          : rgba(palette.readoutWhite, cell.highlighted ? 1 : 0.88);
        ctx.fillText(cell.text, valueRight, y);

        // A tiny label to the left of every other value.
        if (r % 2 === 0) {
          ctx.font = `400 ${density.fontSize * 0.52}px ${READOUT_FONT}, monospace`;
          ctx.fillStyle = rgba(palette.readoutDim, 0.7);
          ctx.textAlign = "left";
          ctx.fillText(
            LABELS[Math.floor(random(`${seed}-label-${index}-${r}`) * LABELS.length)],
            scaleRuleX + 44,
            y,
          );
          ctx.textAlign = "right";
          ctx.font = `500 ${density.fontSize}px ${READOUT_FONT}, monospace`;
        }
      }

      // The tick scale's marker, sliding up and down over the loop.
      const t = loopFrame / DURATION_IN_FRAMES;
      const travel = Math.abs(((t * 2 + index * 0.23) % 2) - 1);
      const markerY = originY + CHROME_PAD * 0.45 + travel * (boxHeight - CHROME_PAD * 0.9);
      ctx.fillStyle = rgba(palette.tickPale, 0.95);
      ctx.beginPath();
      ctx.moveTo(scaleRuleX - 26, markerY);
      ctx.lineTo(scaleRuleX - 4, markerY - 12);
      ctx.lineTo(scaleRuleX - 4, markerY + 12);
      ctx.closePath();
      ctx.fill();

      // Bar meter beside the column, filling and draining on a seeded sine.
      if (column.meter) {
        const meterX = originX + boxWidth + 2;
        const meterTop = originY + CHROME_PAD * 0.7;
        const meterHeight = boxHeight - CHROME_PAD * 1.4;
        ctx.strokeStyle = rgba(palette.tickPale, 0.35);
        ctx.lineWidth = 2;
        ctx.strokeRect(meterX, meterTop, 26, meterHeight);
        const fill = readouts.meter(index, frame) * meterHeight;
        ctx.fillStyle = rgba(palette.tickPale, 0.42);
        ctx.fillRect(meterX + 4, meterTop + meterHeight - fill + 4, 18, Math.max(fill - 8, 0));
      }
    });
  });

  return null;
};
