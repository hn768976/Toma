import { useLayoutEffect } from "react";
import {
  blurred,
  context2d,
  makeCanvas,
  placeLayer,
  tinted,
} from "./lib/canvas";
import { BinaryField } from "./elements/BinaryField";
import { CandleSeries } from "./elements/CandleSeries";
import { CodeBlock } from "./elements/CodeBlock";
import { CurveLayer } from "./elements/CurveLayer";
import { DotMatrix } from "./elements/DotMatrix";
import { GridLayer } from "./elements/GridLayer";
import { NumericField } from "./elements/NumericField";
import type { LayerRender, Scene } from "./scene";
import type { Palette } from "./palettes";

const Element: React.FC<{ layer: LayerRender; palette: Palette }> = ({
  layer,
  palette,
}) => {
  const base = {
    ctx: layer.ctx,
    width: layer.width,
    height: layer.height,
    palette,
    rng: layer.rng,
    seriesRng: layer.seriesRng,
  };
  const spec = layer.spec.content;
  switch (spec.kind) {
    case "candles":
      return <CandleSeries {...base} spec={spec} />;
    case "curves":
      return <CurveLayer {...base} spec={spec} />;
    case "binary":
      return <BinaryField {...base} spec={spec} />;
    case "numeric":
      return <NumericField {...base} spec={spec} />;
    case "code":
      return <CodeBlock {...base} spec={spec} />;
    case "grid":
      return <GridLayer {...base} spec={spec} />;
    case "dots":
      return <DotMatrix {...base} spec={spec} />;
  }
};

/**
 * One depth plane.
 *
 * The element paints into this layer's own buffer; this component's layout
 * effect — which React runs after its child's — then glows, tints and places
 * that buffer into the blur bracket the layer's depth falls in.
 */
export const LayerView: React.FC<{
  scene: Scene;
  layer: LayerRender;
  palette: Palette;
}> = ({ scene, layer, palette }) => {
  useLayoutEffect(() => {
    let src = layer.canvas;

    if (layer.glowPx > 1) {
      const halo = blurred(src, layer.glowPx, 1.2);
      const merged = makeCanvas(src.width, src.height);
      const mctx = context2d(merged);
      mctx.globalAlpha = 0.45;
      mctx.drawImage(halo, 0, 0, merged.width, merged.height);
      mctx.globalAlpha = 1;
      mctx.globalCompositeOperation = "lighter";
      mctx.drawImage(src, 0, 0);
      src = merged;
    }

    if (layer.spec.warmth) {
      src = tinted(src, layer.spec.warmth);
    }

    placeLayer(scene.brackets[layer.bracket].ctx, src, layer.placement);
  }, [scene, layer, palette]);

  return <Element layer={layer} palette={palette} />;
};
