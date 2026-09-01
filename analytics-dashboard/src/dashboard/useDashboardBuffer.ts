/**
 * Owns the dashboard's offscreen canvas and keeps it in sync with the frame.
 *
 * The canvas is created once per buffer size and never attached to the DOM. It
 * is repainted from scratch for the current frame during render — the paint is
 * a pure function of (frame, variant, font), so running it more than once for a
 * frame produces the identical buffer and there is no commit-order or
 * effect-order hazard between the paint and whatever consumes it. That matters
 * most for the tilted variant, where a texture upload one frame stale would be
 * visible.
 */

import { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import type { Variant } from "../variants";
import { renderDashboard } from "./renderDashboard";
import { FONT_FAMILY, useFontsReady } from "./fonts";

export const useDashboardBuffer = (variant: Variant): HTMLCanvasElement => {
  const frame = useCurrentFrame();
  const fontsReady = useFontsReady();

  const canvas = useMemo(() => {
    const created = document.createElement("canvas");
    created.width = variant.buffer.width;
    created.height = variant.buffer.height;
    return created;
  }, [variant.buffer.width, variant.buffer.height]);

  // `fontsReady` is read so the buffer repaints the moment the real face lands.
  void fontsReady;
  renderDashboard({ canvas, frame, variant, fontFamily: FONT_FAMILY });

  return canvas;
};
