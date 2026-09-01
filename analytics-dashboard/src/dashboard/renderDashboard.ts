/**
 * The dashboard renderer.
 *
 * This is the seam the whole project turns on: `renderDashboard` draws the
 * COMPLETE dashboard into a caller-supplied canvas of known dimensions, purely
 * as a function of the frame number. It touches no React state, no clock and no
 * DOM outside the canvas it is given.
 *
 * The flat variant blits the result to the screen. The tilted variant hands the
 * very same buffer to a THREE.CanvasTexture. That is why v2 is a texture swap
 * and not a rebuild.
 */

import { DESIGN_WIDTH } from "./layout";
import { getAnimation } from "./timeline";
import type { Variant } from "../variants";
import { ScreenChrome } from "./paint/ScreenChrome";
import { LineChartPanel } from "./paint/LineChartPanel";
import { CounterBlock } from "./paint/CounterBlock";
import { DonutPanel } from "./paint/DonutPanel";
import { SidePanel } from "./paint/SidePanel";
import { TickerStrip } from "./paint/TickerStrip";
import { applyBloom, applyGrain, applyVignette } from "./paint/finish";
import type { DashboardLayer, PaintEnv } from "./paint/utils";

/**
 * Paint order, back to front. An explicit ordered list rather than React
 * children: the composite has to be identical whether it is driving a screen or
 * a texture, and that rules out anything that depends on commit or effect
 * ordering.
 */
export const DASHBOARD_LAYERS: DashboardLayer[] = [
  ScreenChrome,
  LineChartPanel,
  CounterBlock,
  DonutPanel,
  SidePanel,
  TickerStrip,
];

const glowBuffers = new Map<string, HTMLCanvasElement>();

const getGlowBuffer = (width: number, height: number): HTMLCanvasElement => {
  const key = `${width}x${height}`;
  const existing = glowBuffers.get(key);
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  glowBuffers.set(key, canvas);
  return canvas;
};

export type RenderArgs = {
  /** The dashboard's own buffer. Resized to the variant's buffer size if needed. */
  canvas: HTMLCanvasElement;
  frame: number;
  variant: Variant;
  fontFamily: string;
};

export const renderDashboard = ({ canvas, frame, variant, fontFamily }: RenderArgs): void => {
  const { width, height } = variant.buffer;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Could not acquire a 2D context for the dashboard buffer");

  const glowCanvas = getGlowBuffer(width, height);
  const glow = glowCanvas.getContext("2d");
  if (!glow) throw new Error("Could not acquire a 2D context for the bloom buffer");

  const scale = width / DESIGN_WIDTH;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  glow.setTransform(1, 0, 0, 1, 0, 0);
  glow.clearRect(0, 0, width, height);

  ctx.scale(scale, scale);
  glow.scale(scale, scale);

  const env: PaintEnv = {
    ctx,
    glow,
    palette: variant.palette,
    anim: getAnimation(frame),
    fontFamily,
    scale,
    bufferWidth: width,
    bufferHeight: height,
  };

  for (const layer of DASHBOARD_LAYERS) {
    ctx.save();
    glow.save();
    layer.paint(env);
    glow.restore();
    ctx.restore();
  }

  applyBloom(ctx, glowCanvas, scale);
  applyVignette(ctx, width, height);
  applyGrain(ctx, width, height, frame);
};
