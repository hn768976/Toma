import { useLayoutEffect } from "react";
import type { Ctx } from "../lib/canvas";
import type { Rng } from "../lib/rng";
import type { Palette } from "../palettes";

export type ElementProps<S> = {
  /** The layer's own buffer. Element coordinates are layer coordinates. */
  ctx: Ctx;
  width: number;
  height: number;
  palette: Palette;
  /** Decoration: brightness jitter, row lengths, hotspots. */
  rng: Rng;
  /**
   * The price series. Two layers that name the same `series` tag share this
   * stream, so a curve layer can be the moving average of the candle layer
   * sitting behind it rather than an unrelated wiggle.
   */
  seriesRng: Rng;
  spec: S;
};

export const MONO = '"TradingMono", "DejaVu Sans Mono", monospace';

/**
 * Wrap a drawing routine as a component.
 *
 * Painting happens in a layout effect, so React's own ordering does the
 * compositing for us: siblings paint in document order, and a parent's layout
 * effect runs after its children's. `<LayerView>` relies on that to composite
 * a layer only once its element has finished drawing into it.
 */
export const asElement = <S,>(
  displayName: string,
  draw: (props: ElementProps<S>) => void,
): React.FC<ElementProps<S>> => {
  const Component: React.FC<ElementProps<S>> = (props) => {
    const { ctx, width, height, palette, rng, seriesRng, spec } = props;
    useLayoutEffect(() => {
      ctx.save();
      draw({ ctx, width, height, palette, rng, seriesRng, spec });
      ctx.restore();
    }, [ctx, width, height, palette, rng, seriesRng, spec]);
    return null;
  };
  Component.displayName = displayName;
  return Component;
};

/** Map a value in [lo, hi] onto a layer's vertical extent. */
export const yMapper = (
  height: number,
  lo: number,
  hi: number,
  fill: number,
  offset = 0,
) => {
  const inset = (height * (1 - fill)) / 2;
  const span = height * fill;
  return (v: number) =>
    inset + (1 - (v - lo) / (hi - lo)) * span + offset * height;
};
