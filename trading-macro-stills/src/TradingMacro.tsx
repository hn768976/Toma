import { useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  staticFile,
  useVideoConfig,
} from "remotion";
import { COMPOSITIONS, isCompositionName } from "./compositions";
import { FocusPass } from "./elements/FocusPass";
import { LensFlare } from "./elements/LensFlare";
import { LayerView } from "./LayerView";
import { PALETTES, isPaletteName } from "./palettes";
import { buildScene } from "./scene";
import type { CompositionSpec } from "./types";

export type TradingMacroProps = {
  composition: string;
  palette: string;
  /** Overrides the composition size — used by the contact sheet's tiles. */
  size?: { width: number; height: number };
};

export const TradingMacro: React.FC<TradingMacroProps> = ({
  composition,
  palette,
  size,
}) => {
  const config = useVideoConfig();
  const width = size?.width ?? config.width;
  const height = size?.height ?? config.height;
  const comp: CompositionSpec = COMPOSITIONS[
    isCompositionName(composition) ? composition : "t01"
  ] as CompositionSpec;
  const colours = PALETTES[isPaletteName(palette) ? palette : "cyanNavy"];

  const [handle] = useState(() => delayRender("trading-macro still"));
  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    // The mono face has to be resolved before anything measures text, or the
    // fields lay out against a fallback and then reflow.
    const face = new FontFace(
      "TradingMono",
      `url(${staticFile("fonts/DejaVuSansMono.ttf")})`,
    );
    face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        return document.fonts.ready;
      })
      .then(() => setFontReady(true))
      .catch(() => setFontReady(true));
  }, []);

  // One scene per (composition, palette, size). Rebuilding it hands every
  // layer a fresh blank buffer, so a re-render can never double-expose.
  const scene = useMemo(
    () => (fontReady ? buildScene(comp, width, height) : null),
    [comp, width, height, fontReady],
  );

  useEffect(() => {
    if (scene) continueRender(handle);
  }, [scene, handle]);

  return (
    <AbsoluteFill>
      <canvas
        ref={(el) => {
          if (scene) scene.output.current = el;
        }}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      {scene ? (
        <>
          {scene.layers.map((layer) => (
            <LayerView
              key={layer.spec.id}
              scene={scene}
              layer={layer}
              palette={colours}
            />
          ))}
          <LensFlare scene={scene} palette={colours} />
          <FocusPass scene={scene} palette={colours} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
