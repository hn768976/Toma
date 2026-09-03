import React, { useLayoutEffect, useMemo } from "react";
import {
  DOF_BANDS,
  makeCanvas,
  type DofBand,
  type DofBuffers,
} from "./dofBuffers";

/**
 * Places arbitrary canvas content on a single receding plane, via ONE affine
 * transform, and composites it through a three-band depth of field.
 *
 * Affine, deliberately: at the shallow tilts this is for, true perspective is
 * invisible, and faking it costs correctness for nothing. Parallel lines stay
 * parallel.
 *
 * Depth here is SCREEN HEIGHT, not a plane axis. A tilted plane's recession
 * direction is a diagonal combination of both plane axes, so the only thing
 * that reliably means "farther away" is "higher in the frame". Content is
 * painted into whichever of the three horizontal bands its screen box
 * overlaps, each clipped to its band; the far and near bands are blurred once
 * per frame on composite. Blurring per element instead means one blur per
 * panel rather than two per frame.
 *
 * Usage:
 *   const buffers = useDofBuffers({ width, height });
 *   <TiltedPlane config={{ width, height, rotationDeg: -22, skewDeg: -7.5,
 *                          scaleX: 0.9 }}
 *                buffers={buffers} target={canvasRef}>
 *     {(plane) => <MyContent plane={plane} />}
 *   </TiltedPlane>
 *
 * Ordering contract: the composite runs in this component's own layout
 * effect, which React runs AFTER every child's. So children paint the bands
 * and the plane lands on the target canvas without any explicit sequencing.
 * Anything that must appear IN FRONT of the plane belongs in a later sibling
 * of <TiltedPlane>, not in its children.
 *
 * The plane's own content is cleared by nobody: give it a first child that
 * clears the band surfaces, or clear them yourself before the frame.
 *
 * @module TiltedPlane
 */

export type TiltedPlaneConfig = {
  width: number;
  height: number;
  /** Rotation in degrees. Negative recedes to the upper-right. */
  rotationDeg: number;
  /** Vertical shear in degrees; same sign as the rotation reads naturally. */
  skewDeg: number;
  /** Horizontal compression, e.g. 0.9 for a ~10% squeeze. */
  scaleX: number;
  /** Plane origin in screen space. Defaults to the frame's centre. */
  origin?: { x: number; y: number };
  /** Per-frame screen-space nudge, e.g. an ambient camera drift. */
  offset?: { x: number; y: number };
  /** Band boundaries as fractions of height. Defaults to 0.34 / 0.68. */
  bandEdges?: [number, number];
};

/** An extra surface to expose in plane space, e.g. a bloom accumulator. */
export type ExtraSurface = { canvas: HTMLCanvasElement; scale: number };

export type Plane = {
  /** Plane-space -> screen-space. */
  matrix: DOMMatrix;
  /** Plane-space rectangle guaranteed to cover the frame. */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  toScreen: (u: number, v: number) => { x: number; y: number };
  /**
   * Paints `draw` into every depth band the plane-space box overlaps, each
   * clipped to its band. Content wholly inside one band is drawn once.
   *
   * `draw` may therefore run up to three times for the same content. That is
   * harmless for the banded surfaces — each call is clipped to its own slice
   * — but NOT for a side effect outside them, such as writing into a bloom
   * accumulator, which would then accumulate two or three times over.
   * `isFirstBand` is true on exactly one of the calls; guard such writes
   * with it.
   */
  paint: (
    box: { u: number; v: number; w: number; h: number },
    draw: (ctx: CanvasRenderingContext2D, isFirstBand: boolean) => void,
  ) => void;
  /** The extra surfaces, transformed into plane space. */
  extra: Record<string, CanvasRenderingContext2D>;
};

/** The plane transform, with no per-frame offset — static for a config. */
export const basePlaneMatrix = (c: TiltedPlaneConfig): DOMMatrix => {
  const ox = c.origin?.x ?? c.width / 2;
  const oy = c.origin?.y ?? c.height / 2;
  return new DOMMatrix()
    .translate(ox, oy)
    .rotate(c.rotationDeg)
    .skewY(c.skewDeg)
    .scale(c.scaleX, 1);
};

const planeMatrix = (c: TiltedPlaneConfig, scale: number): DOMMatrix =>
  new DOMMatrix()
    .scale(scale, scale)
    .translate(c.offset?.x ?? 0, c.offset?.y ?? 0)
    .multiply(basePlaneMatrix(c));

const edges = (c: TiltedPlaneConfig) => {
  const [a, b] = c.bandEdges ?? [0.34, 0.68];
  return [c.height * a, c.height * b] as const;
};

const bandRange = (c: TiltedPlaneConfig, b: DofBand): [number, number] => {
  const [far, near] = edges(c);
  const OUT = 4000;
  return b === "far"
    ? [-OUT, far]
    : b === "mid"
      ? [far, near]
      : [near, c.height + OUT];
};

export const bandsForScreenY = (
  c: TiltedPlaneConfig,
  y0: number,
  y1: number,
): DofBand[] =>
  DOF_BANDS.filter((b) => {
    const [lo, hi] = bandRange(c, b);
    return y1 >= lo && y0 <= hi;
  });

const planeBounds = (m: DOMMatrix, width: number, height: number) => {
  const inv = m.inverse();
  const corners = [
    new DOMPoint(0, 0),
    new DOMPoint(width, 0),
    new DOMPoint(0, height),
    new DOMPoint(width, height),
  ].map((p) => p.matrixTransform(inv));
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
};

/** Clears every band surface plus any extras. Call before painting a frame. */
export const clearPlaneSurfaces = (
  buffers: DofBuffers,
  extra: Record<string, ExtraSurface> = {},
) => {
  const all = [
    ...DOF_BANDS.map((b) => buffers.canvas[b]),
    ...Object.values(extra).map((e) => e.canvas),
  ];
  for (const c of all) {
    const ctx = c.getContext("2d");
    if (!ctx) continue;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
  }
};

export const TiltedPlane: React.FC<{
  config: TiltedPlaneConfig;
  buffers: DofBuffers;
  target: React.RefObject<HTMLCanvasElement | null>;
  extra?: Record<string, ExtraSurface>;
  children: (plane: Plane) => React.ReactNode;
}> = ({ config, buffers, target, extra = {}, children }) => {
  const plane = useMemo<Plane | null>(() => {
    const full = planeMatrix(config, 1);
    const surface = (canvas: HTMLCanvasElement, scale: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const m = planeMatrix(config, scale);
      ctx.setTransform(m);
      return { ctx, scale, m };
    };
    const bands = DOF_BANDS.map((b) =>
      surface(buffers.canvas[b], buffers.scale[b]),
    );
    if (bands.some((b) => b === null)) return null;
    const byBand = Object.fromEntries(
      DOF_BANDS.map((b, i) => [b, bands[i]!]),
    ) as Record<DofBand, NonNullable<(typeof bands)[number]>>;

    const extraCtx: Record<string, CanvasRenderingContext2D> = {};
    for (const [key, e] of Object.entries(extra)) {
      const s = surface(e.canvas, e.scale);
      if (s) extraCtx[key] = s.ctx;
    }

    const toScreen = (u: number, v: number) => {
      const p = new DOMPoint(u, v).matrixTransform(full);
      return { x: p.x, y: p.y };
    };

    return {
      matrix: full,
      bounds: planeBounds(full, config.width, config.height),
      toScreen,
      paint: (box, draw) => {
        // A plane rect is a parallelogram on screen, so all four corners
        // matter when deciding which bands it touches.
        const ys = [
          toScreen(box.u, box.v).y,
          toScreen(box.u + box.w, box.v).y,
          toScreen(box.u, box.v + box.h).y,
          toScreen(box.u + box.w, box.v + box.h).y,
        ];
        const touched = bandsForScreenY(
          config,
          Math.min(...ys),
          Math.max(...ys),
        );
        for (let i = 0; i < touched.length; i++) {
          const s = byBand[touched[i]];
          const [lo, hi] = bandRange(config, touched[i]);
          s.ctx.save();
          // The clip is set in screen space, then the plane transform is
          // restored for the content itself. Clips survive setTransform.
          s.ctx.setTransform(s.scale, 0, 0, s.scale, 0, 0);
          s.ctx.beginPath();
          s.ctx.rect(-200, lo, config.width + 400, hi - lo);
          s.ctx.clip();
          s.ctx.setTransform(s.m);
          draw(s.ctx, i === 0);
          s.ctx.restore();
        }
      },
      extra: extraCtx,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, buffers, extra]);

  useLayoutEffect(() => {
    const ctx = target.current?.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const b of DOF_BANDS) {
      const r = buffers.blur[b];
      ctx.filter = r > 0 ? `blur(${r}px)` : "none";
      ctx.drawImage(buffers.canvas[b], 0, 0, config.width, config.height);
    }
    ctx.filter = "none";
    ctx.restore();
  });

  return <>{plane ? children(plane) : null}</>;
};

export { makeCanvas };
