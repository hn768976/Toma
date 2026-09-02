import React from "react";
import { Panel } from "./Panel";
import type { Rect } from "../layout";
import { PALETTE, PANEL_FILL_ALPHA, withAlpha } from "../palette";
import { monoFont } from "../fonts";
import { pick, rndInt, rndRange } from "@lib/random/seeded";

const GLYPHS = "0123456789ABCDEF".split("");
const WORDS = ["SYS", "NODE", "SEQ", "TRK", "IDX", "REF", "CHN", "VEC", "SRC", "LNK"];

const line = (seed: string, cols: number) => {
  let out = "";
  while (out.length < cols) {
    const kind = rndRange(`${seed}-k-${out.length}`, 0, 1);
    if (kind < 0.18) {
      out += pick(`${seed}-w-${out.length}`, WORDS) + " ";
    } else if (kind < 0.32) {
      out += "  ";
    } else {
      const n = rndInt(`${seed}-n-${out.length}`, 2, 6);
      for (let i = 0; i < n; i++) out += pick(`${seed}-g-${out.length}-${i}`, GLYPHS);
      out += " ";
    }
  }
  return out.slice(0, cols);
};

export type TextPanelProps = {
  rect: Rect;
  index: number;
  panelCount: number;
  frame: number;
  label: string;
  seed: string;
  fontSize?: number;
  /** How often (in frames) the live rows reroll. Must divide the loop length. */
  rerollPeriod?: number;
};

/**
 * Dense, deliberately illegible monospace. The bulk is rasterised once; a
 * couple of rows reroll on a slow cycle and one row carries a highlight, which
 * is enough to read as live telemetry without redrawing hundreds of glyphs a
 * frame.
 */
export const TextPanel: React.FC<TextPanelProps> = ({
  rect,
  index,
  panelCount,
  frame,
  label,
  seed,
  fontSize = 20,
  rerollPeriod = 25,
}) => {
  const lineH = fontSize * 1.5;

  const drawStatic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    ctx.font = monoFont(400, fontSize);
    ctx.textBaseline = "top";
    const cols = Math.floor(inner.w / (fontSize * 0.6));
    const rows = Math.floor(inner.h / lineH);
    for (let r = 0; r < rows; r++) {
      ctx.fillStyle = withAlpha(
        r % 7 === 3 ? PALETTE.elementCyan : PALETTE.textPale,
        rndRange(`${seed}-a-${r}`, 0.3, 0.72),
      );
      ctx.fillText(line(`${seed}-r-${r}`, cols), inner.x, inner.y + r * lineH);
    }
  };

  const drawDynamic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    const cols = Math.floor(inner.w / (fontSize * 0.6));
    const rows = Math.floor(inner.h / lineH);
    if (rows < 3) return;
    const gen = Math.floor(frame / rerollPeriod);

    // Two live rows: clear the strip back to nothing, relay the panel fill at
    // exactly the alpha the sprite used, then redraw. Painting the fill over
    // the sprite instead would double up the alpha and leave a visible band.
    for (let k = 0; k < 2; k++) {
      const r = rndInt(`${seed}-live-${gen}-${k}`, 0, rows - 1);
      const y = inner.y + r * lineH;
      ctx.clearRect(inner.x - 6, y - 2, inner.w + 12, lineH);
      ctx.fillStyle = withAlpha(PALETTE.panelFill, PANEL_FILL_ALPHA);
      ctx.fillRect(inner.x - 6, y - 2, inner.w + 12, lineH);
      ctx.font = monoFont(400, fontSize);
      ctx.textBaseline = "top";
      ctx.fillStyle = withAlpha(PALETTE.elementPale, 0.9);
      ctx.fillText(line(`${seed}-live-${gen}-${k}-txt`, cols), inner.x, y);
    }

    // A single highlighted run, the eye's anchor in the noise.
    const hr = rndInt(`${seed}-hl-${gen}`, 0, rows - 1);
    const hx = inner.x + rndRange(`${seed}-hx-${gen}`, 0, inner.w * 0.55);
    const hw = rndRange(`${seed}-hw-${gen}`, inner.w * 0.12, inner.w * 0.3);
    ctx.fillStyle = withAlpha(PALETTE.elementCyan, 0.22);
    ctx.fillRect(hx, inner.y + hr * lineH - 2, hw, lineH);
  };

  return (
    <Panel
      rect={rect}
      index={index}
      panelCount={panelCount}
      frame={frame}
      label={label}
      drawStatic={drawStatic}
      drawDynamic={drawDynamic}
    />
  );
};
