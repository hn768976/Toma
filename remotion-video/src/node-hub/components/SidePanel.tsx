/**
 * One panel of side chrome.
 *
 * A panel's static chrome — thin border, small corner ticks, tiny label strip
 * and any fixed row labels — never changes, so it is rasterised ONCE into an
 * offscreen canvas and blitted each frame; only the values are redrawn. Each
 * panel owns its own small canvas, which is what lets the chrome bloom barely
 * while the hub blooms generously.
 *
 * All content is fictional (see lexicon.ts). Values reroll on a period that
 * divides the loop, indexed by `frame % LOOP_FRAMES`, so the whole wall of
 * chrome returns to its frame-0 state at frame 450.
 */
import { useMemo } from "react";
import { bucket } from "../constants";
import { withAlpha } from "../color";
import { FONT_CONDENSED, FONT_MONO } from "../fonts";
import { bitRun, hexRun, numeric, state, twoDigit, unit } from "../lexicon";
import { makeBloom, makeOffscreen } from "../passes";
import { rand, randRange } from "../seed";
import { Layer } from "./Layer";
import type { PanelSpec } from "../panels";
import type { Palette } from "../variants";

/** Room for the (slight) glow to fall off inside the panel canvas. */
const PAD = 26;
const HEADER = 44;
const BODY_PAD = 18;
const TICK = 14;

const drawChrome = (
  ctx: CanvasRenderingContext2D,
  panel: PanelSpec,
  palette: Palette,
) => {
  const x = PAD;
  const y = PAD;
  const { w, h } = panel;

  if (panel.chrome) {
    ctx.strokeStyle = withAlpha(palette.panelBorder, 0.9);
    ctx.lineWidth = 1.8;
    ctx.strokeRect(x, y, w, h);

    // Corner ticks: short brighter marks just inside each corner.
    ctx.strokeStyle = withAlpha(palette.textPale, 0.85);
    ctx.lineWidth = 2.6;
    const corners: [number, number, number, number][] = [
      [x, y, 1, 1],
      [x + w, y, -1, 1],
      [x, y + h, 1, -1],
      [x + w, y + h, -1, -1],
    ];
    for (const [cx, cy, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx + sx * TICK, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + sy * TICK);
      ctx.stroke();
    }

    // Label strip along the top edge.
    ctx.fillStyle = withAlpha(palette.panelBorder, 0.35);
    ctx.fillRect(x + 1, y + 1, w - 2, HEADER - 8);
    ctx.strokeStyle = withAlpha(palette.panelBorder, 0.8);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y + HEADER - 7);
    ctx.lineTo(x + w, y + HEADER - 7);
    ctx.stroke();

    ctx.fillStyle = withAlpha(palette.textPale, 0.95);
    ctx.font = `500 22px "${FONT_CONDENSED}"`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(panel.label, x + 12, y + HEADER / 2 - 3);
  }

  // Static row labels for the kinds that have them.
  if (panel.kind === "table" || panel.kind === "bars") {
    ctx.fillStyle = withAlpha(palette.textPale, 0.62);
    ctx.font = `400 22px "${FONT_CONDENSED}"`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const rowHeight = panel.kind === "table" ? 36 : 34;
    for (let r = 0; r < panel.rows; r++) {
      const ry = y + HEADER + BODY_PAD + r * rowHeight + rowHeight / 2;
      ctx.fillText(panel.rowLabels[r] ?? "", x + 12, ry);
    }
  }

  if (panel.kind === "bigReadout") {
    ctx.strokeStyle = withAlpha(palette.panelBorder, 0.75);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + panel.h - 52);
    ctx.lineTo(x + panel.w * 0.62, y + panel.h - 52);
    ctx.stroke();
    ctx.fillStyle = withAlpha(palette.textPale, 0.9);
    ctx.font = `400 24px "${FONT_CONDENSED}"`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(panel.rowLabels[0] ?? "", x, y + panel.h - 42);
  }

  if (panel.kind === "strip") {
    ctx.strokeStyle = withAlpha(palette.panelBorder, 0.8);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + panel.w, y);
    ctx.stroke();
  }
};

const drawValues = (
  ctx: CanvasRenderingContext2D,
  panel: PanelSpec,
  palette: Palette,
  roll: number,
) => {
  const x = PAD;
  const y = PAD;
  const { w, h } = panel;
  const seed = `${panel.seed}/${roll}`;

  ctx.textBaseline = "middle";

  switch (panel.kind) {
    case "table": {
      ctx.font = `400 24px "${FONT_CONDENSED}"`;
      ctx.textAlign = "right";
      for (let r = 0; r < panel.rows; r++) {
        const ry = y + HEADER + BODY_PAD + r * 36 + 18;
        ctx.fillStyle = withAlpha(palette.textBright, 0.9);
        ctx.fillText(numeric(`${seed}/v/${r}`, 3, 2), x + w - 62, ry);
        ctx.fillStyle = withAlpha(palette.textPale, 0.7);
        ctx.textAlign = "left";
        ctx.fillText(unit(`${panel.seed}/u/${r}`), x + w - 54, ry);
        ctx.textAlign = "right";
      }
      break;
    }

    case "bars": {
      const barLeft = x + w * 0.44;
      const barWidth = w * 0.42;
      for (let r = 0; r < panel.rows; r++) {
        const ry = y + HEADER + BODY_PAD + r * 34 + 17;
        const fill = randRange(`${seed}/bar/${r}`, 0.12, 1);
        ctx.fillStyle = withAlpha(palette.panelBorder, 0.45);
        ctx.fillRect(barLeft, ry - 6, barWidth, 12);
        ctx.fillStyle = withAlpha(palette.textBright, 0.82);
        ctx.fillRect(barLeft, ry - 6, barWidth * fill, 12);
        ctx.fillStyle = withAlpha(palette.textPale, 0.8);
        ctx.font = `400 20px "${FONT_MONO}"`;
        ctx.textAlign = "right";
        ctx.fillText(
          Math.round(fill * 100)
            .toString()
            .padStart(2, "0"),
          x + w - 12,
          ry,
        );
      }
      break;
    }

    case "readout": {
      for (let r = 0; r < panel.rows; r++) {
        const ry = y + HEADER + BODY_PAD + r * 58 + 29;
        ctx.fillStyle = withAlpha(palette.textBright, 0.95);
        ctx.font = `600 42px "${FONT_CONDENSED}"`;
        ctx.textAlign = "left";
        ctx.fillText(numeric(`${seed}/r/${r}`, 2, 1), x + 12, ry);
        ctx.fillStyle = withAlpha(palette.textPale, 0.8);
        ctx.font = `400 22px "${FONT_CONDENSED}"`;
        ctx.textAlign = "right";
        ctx.fillText(
          `${state(`${seed}/s/${r}`)} ${unit(`${panel.seed}/ru/${r}`)}`,
          x + w - 12,
          ry,
        );
      }
      break;
    }

    case "mono": {
      // Dense illegible monospace: alternating hex and binary runs.
      ctx.font = `400 21px "${FONT_MONO}"`;
      ctx.textAlign = "left";
      const chars = Math.max(6, Math.floor((w - 24) / 12.6));
      for (let r = 0; r < panel.rows; r++) {
        const ry = y + HEADER + BODY_PAD + r * 28 + 14;
        ctx.fillStyle = withAlpha(
          palette.textPale,
          0.42 + rand(`${panel.seed}/mo/${r}`) * 0.4,
        );
        const text =
          rand(`${panel.seed}/kind/${r}`) < 0.45
            ? bitRun(`${seed}/b/${r}`, chars)
            : hexRun(`${seed}/h/${r}`, chars);
        ctx.fillText(text, x + 12, ry);
      }
      break;
    }

    case "bigReadout": {
      ctx.fillStyle = withAlpha(palette.textBright, 0.96);
      ctx.font = `600 156px "${FONT_CONDENSED}"`;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(twoDigit(seed), x, y + h - 78);
      ctx.textBaseline = "middle";
      break;
    }

    case "strip": {
      // A dense row of small values and short bar groups, full width.
      const groups = Math.floor(w / 168);
      for (let g = 0; g < groups; g++) {
        const gx = x + 6 + g * (w / groups);
        ctx.fillStyle = withAlpha(palette.textPale, 0.8);
        ctx.font = `400 20px "${FONT_MONO}"`;
        ctx.textAlign = "left";
        ctx.fillText(hexRun(`${seed}/g/${g}`, 4), gx, y + 30);
        for (let b = 0; b < 4; b++) {
          const level = randRange(`${seed}/gb/${g}/${b}`, 0.16, 1);
          const bx = gx + b * 15;
          ctx.fillStyle = withAlpha(palette.textBright, 0.28 + level * 0.5);
          ctx.fillRect(bx, y + 84 - level * 36, 9, level * 36);
        }
        ctx.fillStyle = withAlpha(palette.textPale, 0.62);
        ctx.font = `400 19px "${FONT_CONDENSED}"`;
        ctx.fillText(numeric(`${seed}/gv/${g}`, 2, 1), gx + 74, y + 76);
      }
      break;
    }
  }
};

export type SidePanelProps = {
  panel: PanelSpec;
  palette: Palette;
  frame: number;
};

export const SidePanel: React.FC<SidePanelProps> = ({
  panel,
  palette,
  frame,
}) => {
  const boxWidth = Math.ceil(panel.w + PAD * 2);
  const boxHeight = Math.ceil(panel.h + PAD * 2);

  const chrome = useMemo(() => {
    const { canvas, ctx } = makeOffscreen(boxWidth, boxHeight);
    drawChrome(ctx, panel, palette);
    return canvas;
  }, [panel, palette, boxWidth, boxHeight]);

  const work = useMemo(
    () => makeOffscreen(boxWidth, boxHeight),
    [boxWidth, boxHeight],
  );
  const bloom = useMemo(
    () => makeBloom(boxWidth, boxHeight, 2),
    [boxWidth, boxHeight],
  );

  const draw = (ctx: CanvasRenderingContext2D) => {
    const { ctx: wctx } = work;
    wctx.setTransform(1, 0, 0, 1, 0, 0);
    wctx.clearRect(0, 0, boxWidth, boxHeight);
    wctx.drawImage(chrome, 0, 0);
    drawValues(wctx, panel, palette, bucket(frame, panel.rerollPeriod));

    ctx.drawImage(work.canvas, 0, 0);
    // Panels barely bloom: enough to sit in the same light as the rest of the
    // frame, not enough to compete with the hub.
    bloom(ctx, work.canvas, { radii: [14], alpha: 0.14 });
  };

  return (
    <Layer
      draw={draw}
      width={boxWidth}
      height={boxHeight}
      left={Math.round(panel.x - PAD)}
      top={Math.round(panel.y - PAD)}
    />
  );
};
