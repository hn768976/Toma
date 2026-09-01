import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import type { Rect } from "../layout";
import { flashAt } from "../lib/anim";
import { alpha } from "../lib/color";
import { panelBody, panelChrome } from "../lib/draw";
import type { PanelSpec, Variant } from "../variants";
import { BarRow } from "./BarRow";
import { DataTable } from "./DataTable";
import { Layer } from "./Layer";
import { MiniChart } from "./MiniChart";
import { PieRow } from "./PieRow";
import { RingPair } from "./RingGauge";

/**
 * A panel: shared chrome (2px border, top label strip, corner ticks) plus one
 * content component. The chrome is rasterised once into an offscreen canvas
 * and blitted; only the seeded border flash and the content redraw per frame.
 */
export const SidePanel: React.FC<{
  rect: Rect;
  spec: PanelSpec;
  variant: Variant;
  /** index within the whole frame, so the flash picker can address it */
  index: number;
  panelCount: number;
}> = ({ rect, spec, variant, index, panelCount }) => {
  const frame = useCurrentFrame();
  const p = variant.palette;
  const scale = variant.panels.textScale;

  const chrome = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = Math.ceil(rect.w);
    c.height = Math.ceil(rect.h);
    const ctx = c.getContext("2d");
    if (ctx) {
      panelChrome(ctx, rect.w, rect.h, spec.label, spec.code, p, scale);
    }
    return c;
  }, [rect.w, rect.h, spec.label, spec.code, p, scale]);

  // 2-3 flashes a second across the frame, seeded, never straddling the seam
  const flash = flashAt(
    frame,
    "panel-flash",
    30,
    (pick) => Math.floor(pick * panelCount) === index,
    6,
  );

  const body = panelBody(rect.w, rect.h, scale);
  const seed = `${variant.name}-${spec.code}`;
  const cx = rect.x + body.x;
  const cy = rect.y + body.y;

  return (
    <>
      <Layer
        x={rect.x}
        y={rect.y}
        w={rect.w}
        h={rect.h}
        draw={(ctx) => {
          ctx.drawImage(chrome, 0, 0);
          if (flash > 0) {
            ctx.save();
            ctx.strokeStyle = alpha(p.accent, flash);
            ctx.lineWidth = 4;
            ctx.strokeRect(2, 2, rect.w - 4, rect.h - 4);
            ctx.fillStyle = alpha(p.accent, flash * 0.1);
            ctx.fillRect(2, 2, rect.w - 4, rect.h - 4);
            ctx.restore();
          }
        }}
      />
      {spec.kind === "areaChart" || spec.kind === "lineSpike" || spec.kind === "miniLines" ? (
        <MiniChart
          x={cx}
          y={cy}
          w={body.w}
          h={body.h}
          kind={spec.kind}
          seed={seed}
          variant={variant}
        />
      ) : null}
      {spec.kind === "pieRow" ? (
        <PieRow x={cx} y={cy} w={body.w} h={body.h} seed={seed} variant={variant} />
      ) : null}
      {spec.kind === "barChart" ? (
        <BarRow
          x={cx}
          y={cy}
          w={body.w}
          h={body.h}
          seed={seed}
          variant={variant}
          orientation="vertical"
          count={variant.name === "amber" ? 16 : 12}
        />
      ) : null}
      {spec.kind === "barRow" ? (
        <BarRow x={cx} y={cy} w={body.w} h={body.h} seed={seed} variant={variant} />
      ) : null}
      {spec.kind === "ringPair" ? (
        <RingPair x={cx} y={cy} w={body.w} h={body.h} seed={seed} variant={variant} />
      ) : null}
      {spec.kind === "dataTable" ? (
        <DataTable x={cx} y={cy} w={body.w} h={body.h} seed={seed} variant={variant} />
      ) : null}
    </>
  );
};
