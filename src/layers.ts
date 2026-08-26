/**
 * The scene is composited on a single 3840x2160 backing store. Rather than
 * stacking half a dozen 4K DOM canvases, every element draws into one of a
 * small set of contexts that the parent flattens in a fixed order:
 *
 *   main  -> background plate and the fibre fan
 *   dof   -> [sharp, mid, far] buckets holding the panels and their traces;
 *            each buffer is blurred exactly ONCE at composite time, which is
 *            the only way depth-of-field is affordable at 4K
 *   top   -> the chip, which must sit above the blurred buckets
 *
 * Children draw in their own `useLayoutEffect`. React flushes layout effects in
 * tree order — every child before its parent, siblings in render order — so
 * <StageClear> wipes the buffers first, the element components fill them in
 * declaration order, and <ChipDashboard>'s own effect runs last to flatten and
 * apply the finishing pass. Every child takes `frame`, so a new frame
 * re-renders the whole subtree and the ordering holds.
 */
export type Layers = {
  main: CanvasRenderingContext2D;
  dof: readonly [
    CanvasRenderingContext2D,
    CanvasRenderingContext2D,
    CanvasRenderingContext2D,
  ];
  top: CanvasRenderingContext2D;
};

/**
 * The parent holds the layer set in a ref that its <canvas> ref callback fills
 * during the commit phase. React attaches host refs before it runs any layout
 * effect in the same commit, and the canvas is declared before the element
 * components, so `current` is already populated the first time a child draws.
 */
export type LayersRef = {readonly current: Layers | null};

export const resetCtx = (ctx: CanvasRenderingContext2D): void => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'rgba(0,0,0,0)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
};
