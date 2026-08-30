import React, { createContext, useContext, useLayoutEffect } from "react";
import type { PanelSpec } from "../layout";
import type { Variant } from "../theme";
import {
  applyMatrix,
  bucketForPanel,
  type DepthBucket,
  type Matrix,
} from "../plane";
import type { Ctx } from "../draw/primitives";

export type PlaneApi = {
  variant: Variant;
  matrix: Matrix;
  /** The one shared, eased timeline every panel on the sheet reads from. */
  t: number;
  /** The same timeline one frame earlier, used to detect label changes. */
  tPrev: number;
  frame: number;
  fps: number;
  buffers: Record<DepthBucket, Ctx>;
};

export const PlaneContext = createContext<PlaneApi | null>(null);

export const usePlane = () => {
  const api = useContext(PlaneContext);
  if (!api) {
    throw new Error("Chart components must live inside <SheetPlane>");
  }
  return api;
};

/**
 * Every chart component funnels through here. It picks the offscreen buffer for
 * the panel's depth bucket, lays the plane transform down once, moves to the
 * panel's origin, and hands the painter a plain top-left-origin panel space.
 *
 * The paint happens in a layout effect, which React commits in tree order, so
 * panels stack in array order and the parent's compositing effect runs last.
 */
export const usePanelPainter = (
  panel: PanelSpec,
  paint: (ctx: Ctx, api: PlaneApi) => void,
) => {
  const api = usePlane();
  const bucket = bucketForPanel(panel, api.variant.depth, api.variant.tilt);
  const ctx = api.buffers[bucket];

  useLayoutEffect(() => {
    ctx.save();
    applyMatrix(ctx, api.matrix);
    ctx.translate(panel.x, panel.y);
    paint(ctx, api);
    ctx.restore();
  });
};

/** Chart components draw to canvas, so they render no DOM of their own. */
export const NoDom: React.FC = () => null;
