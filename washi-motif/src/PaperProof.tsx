import React, { useMemo } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { HEIGHT, WIDTH } from "./constants";
import { COMPOSITIONS, type CompositionName } from "./compositions";
import { PALETTES, type PaletteName } from "./palettes";
import { createPaperCanvas } from "./paper";
import { CanvasStage, useStageLayer } from "./components/CanvasStage";

export type PaperProofProps = {
  composition: CompositionName;
  palette: PaletteName;
  /** Top-left of the crop, as a fraction of the full sheet. */
  originX: number;
  originY: number;
};

/**
 * A 1:1 crop of the washi sheet at full-size resolution.
 *
 * The fibre texture is the half of this product that a downscaled preview
 * hides: judge it here, at actual pixels, not on a quarter-scale still.
 */
const ProofLayer: React.FC<PaperProofProps & { width: number; height: number }> = ({
  composition,
  palette,
  originX,
  originY,
  width,
  height,
}) => {
  const spec = COMPOSITIONS[composition] ?? COMPOSITIONS.w01;
  const colours = PALETTES[palette] ?? PALETTES.goldWhite;

  const sheet = useMemo(
    () =>
      createPaperCanvas({
        width: WIDTH,
        height: HEIGHT,
        palette: colours,
        tone: spec.tone,
        seed: spec.id,
        fibreDensity: spec.fibreDensity,
      }),
    [colours, spec],
  );

  useStageLayer("proof", 0, (ctx) => {
    const sx = Math.min(originX * WIDTH, WIDTH - width);
    const sy = Math.min(originY * HEIGHT, HEIGHT - height);
    ctx.drawImage(sheet, sx, sy, width, height, 0, 0, width, height);
  });

  return null;
};

export const PaperProof: React.FC<PaperProofProps> = (props) => {
  const { width, height } = useVideoConfig();
  const colours = PALETTES[props.palette] ?? PALETTES.goldWhite;

  return (
    <AbsoluteFill style={{ backgroundColor: colours.paper }}>
      <CanvasStage width={width} height={height} background={colours.paper}>
        <ProofLayer {...props} width={width} height={height} />
      </CanvasStage>
    </AbsoluteFill>
  );
};

export const paperProofDefaultProps: PaperProofProps = {
  composition: "w01",
  palette: "goldWhite",
  originX: 0.34,
  originY: 0.38,
};
