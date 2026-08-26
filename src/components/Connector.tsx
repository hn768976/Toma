import {useLayoutEffect} from 'react';
import {lighten, pointAt, rgba, strokePolyline, travelPhase} from '../lib/draw';
import {setMat} from '../lib/mat';
import {resetCtx, type LayersRef} from '../layers';
import {frameMatrix, type PanelLayout, type Scene} from '../scene';
import {THEMES} from '../theme';

/**
 * One chip-to-panel trace. The route itself is generated once in `buildScene`
 * as an axis-aligned, round-cornered polyline in plane space — never a
 * diagonal. Only the travelling dots move per frame.
 */
export const Connector: React.FC<{
  layers: LayersRef;
  scene: Scene;
  panel: PanelLayout;
  frame: number;
}> = ({layers, scene, panel, frame}) => {
  const theme = THEMES[scene.variant];

  // No dependency array: the draw must run on EVERY render so that the layer
  // order described in layers.ts holds. See ChipDashboard for the full pass.
  useLayoutEffect(() => {
    const L = layers.current;
    if (!L) return;
    const ctx = L.dof[panel.spec.depth];
    resetCtx(ctx);
    setMat(ctx, frameMatrix(scene.base, frame));

    const route = panel.route;

    // Trace: a soft halo under a thin bright core.
    strokePolyline(ctx, route);
    ctx.strokeStyle = rgba(theme.panelBorder, 0.16);
    ctx.lineWidth = 12;
    ctx.stroke();

    strokePolyline(ctx, route);
    ctx.strokeStyle = rgba(theme.panelBorder, 0.72);
    ctx.lineWidth = 3;
    ctx.stroke();

    // Junction pads at both ends.
    for (const t of [0, 1]) {
      const p = pointAt(route, t);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = rgba(theme.panelBorder, 0.85);
      ctx.fill();
    }

    /* ---- travelling dots --------------------------------------------- */
    // The route runs chip (t=0) -> panel (t=1). v1 is the chip emitting, so the
    // dots run 0 -> 1; v2 is the chip ingesting, so they run 1 -> 0. The sign
    // of flowDirection is the only thing that decides it.
    ctx.globalCompositeOperation = 'lighter';
    for (const offset of [panel.routeOffset, panel.routeOffset2]) {
      const phase = travelPhase(frame, panel.routePeriod, offset);
      const t = scene.flowDirection > 0 ? phase : 1 - phase;
      const p = pointAt(route, t);

      // Fade the dot in and out at the ends so it does not pop.
      const edge = Math.min(1, Math.min(t, 1 - t) * 9);

      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = rgba(theme.panelBorder, 0.16 * edge);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = lighten(theme.panelBorder, 0.7, 0.95 * edge);
      ctx.fill();
    }

    resetCtx(ctx);
  });

  return null;
};
