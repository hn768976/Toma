import { useMemo } from "react";
import { interpolate, random } from "remotion";
import type { Buffers } from "../buffers";
import { SOFT_RES, makeCache } from "../buffers";
import { withAlpha } from "../colors";
import { panelRow, panelTitle } from "../content";
import { MONO } from "../fonts";
import type { Layout, PanelSpec } from "../layout";
import { applyMatrix } from "../plane";
import type { Painter } from "../painter";
import { LAYER } from "../painter";
import type { ScreenState } from "../state";
import type { Palette } from "../variants";

/**
 * The small bordered readout panels scattered around the dialog at varied
 * depths. Their chrome never changes, so each one is drawn once into its own
 * cache and afterwards only blitted; the stagger is a wipe over the blit.
 */

const DRAW_ON_FRAMES = 14;

const paintChrome = (
  panel: PanelSpec,
  palette: Palette,
): HTMLCanvasElement => {
  const g = makeCache(panel.w * SOFT_RES, panel.h * SOFT_RES);
  g.setTransform(SOFT_RES, 0, 0, SOFT_RES, 0, 0);

  g.fillStyle = withAlpha(palette.dialogFill, 0.35);
  g.fillRect(0, 0, panel.w, panel.h);

  g.strokeStyle = withAlpha(palette.panelBorder, 0.9);
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, panel.w - 3, panel.h - 3);

  const pad = 18;
  const titleSize = 26;
  g.textBaseline = "top";
  g.font = `500 ${titleSize}px ${MONO}`;
  g.fillStyle = withAlpha(palette.textPale, 0.7);
  g.fillText(panelTitle(panel.seed), pad, pad, panel.w - pad * 2);

  g.strokeStyle = withAlpha(palette.panelBorder, 0.5);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(pad, pad + titleSize + 12);
  g.lineTo(panel.w - pad, pad + titleSize + 12);
  g.stroke();

  let y = pad + titleSize + 26;
  const rowSize = 23;
  g.font = `400 ${rowSize}px ${MONO}`;
  for (let i = 0; i < panel.rows; i++) {
    const { label, value } = panelRow(`${panel.seed}-row-${i}`);
    g.fillStyle = withAlpha(palette.backdropText, 0.95);
    g.textAlign = "left";
    g.fillText(label, pad, y);
    g.fillStyle = withAlpha(palette.textPale, 0.55);
    g.textAlign = "right";
    g.fillText(value, panel.w - pad, y);
    y += rowSize + 12;
  }
  g.textAlign = "left";

  for (let i = 0; i < panel.bars; i++) {
    const barH = 14;
    const w = panel.w - pad * 2;
    g.strokeStyle = withAlpha(palette.panelBorder, 0.6);
    g.lineWidth = 2;
    g.strokeRect(pad, y, w, barH);
    g.fillStyle = withAlpha(palette.panelBorder, 0.45);
    g.fillRect(
      pad + 2,
      y + 2,
      (w - 4) * (0.2 + random(`${panel.seed}-bar-${i}`) * 0.7),
      barH - 4,
    );
    y += barH + 16;
  }

  return g.canvas;
};

export const SidePanel: React.FC<{
  painter: Painter;
  buffers: Buffers;
  layout: Layout;
  palette: Palette;
  state: ScreenState;
}> = ({ painter, buffers, layout, palette, state }) => {
  const chrome = useMemo(
    () => layout.panels.map((panel) => paintChrome(panel, palette)),
    [layout, palette],
  );

  painter.register("panels", LAYER.panels, () => {
    if (state.backdropAlpha <= 0) return;
    const dx = state.frame * 0.1;
    const dy = state.frame * -0.14;

    layout.panels.forEach((panel, i) => {
      const reveal = interpolate(
        state.frame,
        [panel.drawAt, panel.drawAt + DRAW_ON_FRAMES],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );
      if (reveal <= 0) return;

      const dead = state.deadPanels.includes(i);
      const buffer = panel.depth === "far" ? buffers.far : buffers.mid;
      const ctx = buffer.ctx;
      applyMatrix(ctx, buffer.matrix);
      ctx.globalAlpha = state.backdropAlpha * (dead ? 0.1 : 1);
      ctx.save();
      ctx.beginPath();
      ctx.rect(panel.x + dx, panel.y + dy, panel.w * reveal, panel.h);
      ctx.clip();
      ctx.drawImage(chrome[i], panel.x + dx, panel.y + dy, panel.w, panel.h);
      ctx.restore();
      ctx.globalAlpha = 1;
    });
  });

  return null;
};
