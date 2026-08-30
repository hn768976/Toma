import { HEIGHT, WIDTH } from "./constants";
import {
  compositeBloom,
  createFinishBuffers,
  drawGrain,
  drawScanlines,
  drawVignette,
  makeScanlinePattern,
  resetGlow,
  type FinishBuffers,
} from "./finish";
import { buildLayout, type Layout, type PanelSpec } from "./layout";
import { projectWorld, type CountryFeature, type ProjectedMap } from "./map/geo";
import { alpha, type Ctx2D, type DrawArgs, type Fonts, type Painter } from "./paint";
import { drawBarChart, drawBarChartStatic } from "./panels/BarChart";
import { drawLineTrace, drawLineTraceStatic } from "./panels/LineTrace";
import { drawPanelChrome, drawPanelFlash } from "./panels/PanelChrome";
import { drawProgressStrip, drawProgressStripStatic } from "./panels/ProgressStrip";
import { drawReadoutBlock, drawReadoutBlockStatic } from "./panels/ReadoutBlock";
import { drawRingGauge, drawRingGaugeStatic } from "./panels/RingGauge";
import { drawTextPanel, drawTextPanelStatic } from "./panels/TextPanel";
import { drawTitlePlate } from "./panels/TitlePlate";
import { drawToggleRow, drawToggleRowStatic } from "./panels/ToggleRow";
import { drawWorldMap, drawWorldMapStatic, mapExtent } from "./panels/WorldMapPanel";
import { loopFrame } from "./rand";
import type { Variant } from "./variants";

/**
 * The self-contained dashboard renderer.
 *
 * It draws a complete 3840x2160 frame into ANY 2D context - the composition's
 * canvas in v1/v2, or an offscreen buffer that v3 uploads as a THREE texture.
 * Nothing here knows which. That is the whole reason v3 is a re-render of v1
 * rather than a rebuild of it.
 *
 * Performance: all static chrome (panel borders, label strips, corner ticks,
 * grid lines, the projected map, the illegible log text) is drawn ONCE into an
 * offscreen layer and blitted each frame. Only values, traces, gauges,
 * highlights and the finishing pass are redrawn.
 */

export type DashboardRenderer = {
  width: number;
  height: number;
  /** Draws the complete frame. `frame` is wrapped into the 900-frame loop. */
  render: (ctx: Ctx2D, frame: number) => void;
};

const makeCanvas = (w: number, h: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
};

const drawStaticContent = (a: DrawArgs, spec: PanelSpec, map: ProjectedMap) => {
  drawPanelChrome(a, spec);
  switch (spec.kind) {
    case "readout":
      return drawReadoutBlockStatic(a, spec);
    case "bars":
      return drawBarChartStatic(a, spec);
    case "trace":
      return drawLineTraceStatic(a, spec);
    case "gauges":
      return drawRingGaugeStatic(a, spec);
    case "text":
      return drawTextPanelStatic(a, spec);
    case "progress":
      return drawProgressStripStatic(a, spec);
    case "toggles":
      return drawToggleRowStatic(a, spec);
    case "map":
      return drawWorldMapStatic(a, spec, map);
    default:
      return undefined;
  }
};

const drawDynamicContent = (a: DrawArgs, spec: PanelSpec, map: ProjectedMap) => {
  switch (spec.kind) {
    case "readout":
      return drawReadoutBlock(a, spec);
    case "bars":
      return drawBarChart(a, spec);
    case "trace":
      return drawLineTrace(a, spec);
    case "gauges":
      return drawRingGauge(a, spec);
    case "text":
      return drawTextPanel(a, spec);
    case "progress":
      return drawProgressStrip(a, spec);
    case "toggles":
      return drawToggleRow(a, spec);
    case "map":
      return drawWorldMap(a, spec, map);
    default:
      return undefined;
  }
};

/** Faint dot grid across the background plate. */
const drawBackdrop = (ctx: Ctx2D, variant: Variant) => {
  ctx.fillStyle = variant.palette.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = alpha(variant.palette.panelBorder, 0.16);
  for (let x = 40; x < WIDTH; x += 48) {
    for (let y = 40; y < HEIGHT; y += 48) {
      ctx.fillRect(x, y, 2, 2);
    }
  }
};

export const createDashboardRenderer = (options: {
  variant: Variant;
  world: CountryFeature[];
  fonts: Fonts;
  fps: number;
}): DashboardRenderer => {
  const { variant, world, fonts, fps } = options;

  const layout: Layout = buildLayout(variant.layout);
  // Projected exactly once. Re-projecting per frame is the most expensive
  // mistake available here.
  const map: ProjectedMap = projectWorld(world, mapExtent(layout.map));

  const staticLayer = makeCanvas(WIDTH, HEIGHT);
  const staticCtx = staticLayer.getContext("2d") as Ctx2D;
  const dummyGlow = makeCanvas(2, 2).getContext("2d") as Ctx2D;
  const buffers: FinishBuffers = createFinishBuffers(WIDTH, HEIGHT);
  let scanlines: CanvasPattern | null = null;

  // Build the static layer once.
  {
    const painter: Painter = { ctx: staticCtx, glow: dummyGlow };
    const args: DrawArgs = { p: painter, v: variant, fonts, frame: 0, fps };
    drawBackdrop(staticCtx, variant);
    drawStaticContent(args, layout.map, map);
    for (const spec of layout.panels) {
      drawStaticContent(args, spec, map);
    }
  }

  const allPanels = [layout.map, ...layout.panels];

  const render = (ctx: Ctx2D, rawFrame: number) => {
    const frame = loopFrame(rawFrame);
    if (!scanlines) scanlines = makeScanlinePattern(ctx, variant.palette);

    ctx.drawImage(staticLayer, 0, 0);

    resetGlow(buffers, WIDTH, HEIGHT);
    const painter: Painter = { ctx, glow: buffers.glowCtx };
    const args: DrawArgs = { p: painter, v: variant, fonts, frame, fps };

    for (const spec of allPanels) {
      drawDynamicContent(args, spec, map);
    }
    drawTitlePlate(args, layout.title, variant.title);
    for (const spec of allPanels) {
      drawPanelFlash(args, spec);
    }

    compositeBloom(ctx, buffers, WIDTH, HEIGHT);
    drawVignette(ctx, WIDTH, HEIGHT, variant.palette);
    drawScanlines(ctx, scanlines, WIDTH, HEIGHT);
    drawGrain(ctx, buffers, frame, WIDTH, HEIGHT);
  };

  return { width: WIDTH, height: HEIGHT, render };
};
