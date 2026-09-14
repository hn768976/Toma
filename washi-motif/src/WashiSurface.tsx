import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { SURFACES, type SurfaceName } from "./surfaces";
import { PALETTES, type PaletteName } from "./palettes";
import { CanvasStage } from "./components/CanvasStage";
import { SurfaceGround, SurfaceVignette } from "./components/SurfaceGround";
import { MotifLayout } from "./components/MotifLayout";

export type WashiSurfaceProps = {
  /** Which of the seventeen surfaces. */
  surface: SurfaceName;
  /**
   * Colour variation. Optional: each surface names the palette it was designed
   * for, and that is used unless this overrides it. Defaulting to a fixed
   * palette instead would render every surface in s01's colours.
   */
  palette?: PaletteName;
};

/**
 * A washi SURFACE still: the sheet itself, edge to edge.
 *
 * The companion to <WashiMotif>. That one keeps its centre open because it is
 * made to be typed over; this one is the material — plain paper, a seigaiha
 * field, beaten gold leaf, a watercolour wash — so it is full bleed and the
 * open-centre guard does not apply.
 */
export const WashiSurface: React.FC<WashiSurfaceProps> = ({
  surface,
  palette,
}) => {
  const { width, height } = useVideoConfig();
  const spec = SURFACES[surface] ?? SURFACES.s01;
  const colours = (palette && PALETTES[palette]) ?? PALETTES[spec.palette];

  return (
    <AbsoluteFill style={{ backgroundColor: colours.paper }}>
      <CanvasStage width={width} height={height} background={colours.paper}>
        <SurfaceGround
          order={0}
          width={width}
          height={height}
          palette={colours}
          spec={spec.ground}
          seed={spec.id}
        />
        <MotifLayout
          width={width}
          height={height}
          composition={{
            id: spec.id,
            label: spec.label,
            note: spec.note,
            tone: spec.ground.tone ?? "light",
            openCentre: { w: 0, h: 0 },
            fibreDensity: spec.ground.fibreDensity,
            motifs: spec.motifs,
          }}
          palette={colours}
          guard={false}
        />
        <SurfaceVignette
          order={900}
          width={width}
          height={height}
          palette={colours}
          spec={spec.ground}
          seed={spec.id}
        />
      </CanvasStage>
    </AbsoluteFill>
  );
};

export const washiSurfaceDefaultProps: WashiSurfaceProps = {
  surface: "s01",
};
