import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { COMPOSITIONS, type CompositionName } from "./compositions";
import { PALETTES, type PaletteName } from "./palettes";
import { CanvasStage } from "./components/CanvasStage";
import { PaperGround } from "./components/PaperGround";
import { MotifLayout } from "./components/MotifLayout";

export type WashiMotifProps = {
  /** Which of the eight named setups. */
  composition: CompositionName;
  /** Which colour variation. */
  palette: PaletteName;
};

/**
 * A washi paper motif STILL. There is no animation, no loop and no timing:
 * traditional Japanese motifs printed in gold and colour on a textured
 * handmade sheet, arranged around the frame's edges with the centre left open
 * for copy.
 *
 * Only two props. Everything that varies between images lives in the
 * COMPOSITIONS table and the PALETTES table.
 */
export const WashiMotif: React.FC<WashiMotifProps> = ({
  composition,
  palette,
}) => {
  const { width, height } = useVideoConfig();
  const spec = COMPOSITIONS[composition] ?? COMPOSITIONS.w01;
  const colours = PALETTES[palette] ?? PALETTES.goldWhite;

  return (
    <AbsoluteFill style={{ backgroundColor: colours.paper }}>
      <CanvasStage width={width} height={height} background={colours.paper}>
        <PaperGround
          order={0}
          width={width}
          height={height}
          palette={colours}
          tone={spec.tone}
          seed={spec.id}
          fibreDensity={spec.fibreDensity}
        />
        <MotifLayout
          width={width}
          height={height}
          composition={spec}
          palette={colours}
        />
      </CanvasStage>
    </AbsoluteFill>
  );
};

export const washiMotifDefaultProps: WashiMotifProps = {
  composition: "w01",
  palette: "goldWhite",
};
