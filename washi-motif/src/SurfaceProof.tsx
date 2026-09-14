import React, { useMemo } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { HEIGHT, WIDTH } from "./constants";
import { SURFACES, type SurfaceName } from "./surfaces";
import { PALETTES, type PaletteName } from "./palettes";
import { drawSurface } from "./render/surface";
import { CanvasStage, useStageLayer } from "./components/CanvasStage";

export type SurfaceProofProps = {
  surface: SurfaceName;
  palette?: PaletteName;
  /** Top-left of the crop, as a fraction of the full-size surface. */
  originX: number;
  originY: number;
};

/**
 * A 1:1 crop of a surface at full-size resolution.
 *
 * The companion to <PaperProof>. Surfaces live or die on their texture, and a
 * contact-sheet tile 245px wide cannot show a fibre — judge them here.
 */
const ProofLayer: React.FC<SurfaceProofProps & { width: number; height: number }> = ({
  surface,
  palette,
  originX,
  originY,
  width,
  height,
}) => {
  const spec = SURFACES[surface] ?? SURFACES.s01;
  const colours = (palette && PALETTES[palette]) ?? PALETTES[spec.palette];

  const full = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("2d context unavailable for the proof");
    drawSurface(ctx, {
      surface: spec,
      palette: colours,
      width: WIDTH,
      height: HEIGHT,
    });
    return canvas;
  }, [spec, colours]);

  useStageLayer("surface-proof", 0, (ctx) => {
    const sx = Math.min(originX * WIDTH, WIDTH - width);
    const sy = Math.min(originY * HEIGHT, HEIGHT - height);
    ctx.drawImage(full, sx, sy, width, height, 0, 0, width, height);
  });

  return null;
};

export const SurfaceProof: React.FC<SurfaceProofProps> = (props) => {
  const { width, height } = useVideoConfig();
  const spec = SURFACES[props.surface] ?? SURFACES.s01;
  const colours =
    (props.palette && PALETTES[props.palette]) ?? PALETTES[spec.palette];

  return (
    <AbsoluteFill style={{ backgroundColor: colours.paper }}>
      <CanvasStage width={width} height={height} background={colours.paper}>
        <ProofLayer {...props} width={width} height={height} />
      </CanvasStage>
    </AbsoluteFill>
  );
};

export const surfaceProofDefaultProps: SurfaceProofProps = {
  surface: "s03",
  originX: 0.36,
  originY: 0.38,
};
