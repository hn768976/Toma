/**
 * <Corridor> — the composition root shared by all three variants.
 *
 * Picks a variant from VARIANTS, builds the corridor geometry for it, and
 * stacks the layers onto one canvas. The only thing that differs between the
 * three videos is which element components are handed to <PerspectiveCorridor>
 * as children; the engine, the depth mechanics, the bokeh, the horizon glow,
 * the finish and the loop are identical.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "./components/Backdrop";
import { BokehLayer } from "./components/BokehLayer";
import { CorridorEdgeLines } from "./components/CorridorEdgeLines";
import { FibreStrand } from "./components/FibreStrand";
import { FinishPass } from "./components/FinishPass";
import { HorizonGlow } from "./components/HorizonGlow";
import { SlabPanel } from "./components/SlabPanel";
import { PerspectiveCorridor } from "./components/PerspectiveCorridor";
import { CanvasStage } from "./lib/canvasLayers";
import { TAU } from "./lib/math";
import { CorridorGeometry } from "./lib/perspective";
import { EXTRA_COUNTS, LOOP_FRAMES, VARIANTS, VariantId } from "./variants";

const ORDER = {
  backdrop: 10,
  glow: 20,
  bokehBack: 30,
  corridor: 40,
  bokehFront: 50,
  finish: 60,
} as const;

export type CorridorProps = {
  variant: VariantId;
};

export const Corridor: React.FC<CorridorProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const v = VARIANTS[variant];
  const loop = LOOP_FRAMES;

  // Ambient camera drift: a closed circular path, so it returns to its start
  // on frame `loop`. Nothing else moves the camera.
  const t = frame / loop;
  const driftX = Math.cos(t * TAU) * v.drift;
  const driftY = Math.sin(t * TAU) * v.drift;

  const horizonY = height * v.horizon + driftY;
  const geo: CorridorGeometry = {
    width,
    height,
    horizonY,
    vanishX: width / 2 + driftX,
    spread: width * v.spread,
    floorEdgeY: height * v.floorEdge,
    ceilEdgeY: height * v.ceilEdge,
    bandCenterY: horizonY + height * v.openBand.offset,
    bandHalf: (height * v.openBand.height) / 2,
    bandResidual: v.openBand.residual,
  };

  const backCount = Math.round(v.bokeh.count * (1 - v.bokeh.frontShare));

  return (
    <AbsoluteFill style={{ backgroundColor: v.palette.backgroundDeep }}>
      <CanvasStage width={width} height={height}>
        <Backdrop order={ORDER.backdrop} geo={geo} palette={v.palette} />

        <HorizonGlow
          order={ORDER.glow}
          geo={geo}
          palette={v.palette}
          frame={frame}
          loop={loop}
          radius={v.horizonGlow.radius}
          intensity={v.horizonGlow.intensity}
          stretch={v.horizonGlow.stretch}
        />

        <BokehLayer
          id="bokeh-back"
          order={ORDER.bokehBack}
          geo={geo}
          palette={v.palette}
          frame={frame}
          loop={loop}
          seed={v.id}
          from={0}
          to={backCount}
          count={v.bokeh.count}
          minR={v.bokeh.minR}
          maxR={v.bokeh.maxR}
          alpha={v.bokeh.alpha}
        />

        <PerspectiveCorridor
          order={ORDER.corridor}
          geo={geo}
          frame={frame}
          loop={loop}
          palette={v.palette}
          blend={v.blend}
          dof={v.dof}
        >
          {v.elementType === "fibre" ? (
            <FibreStrand order={10} count={v.density} seed={v.id} />
          ) : null}

          {v.elementType === "slab" ? (
            <>
              <SlabPanel order={10} count={v.density} seed={v.id} />
              <CorridorEdgeLines
                order={20}
                count={EXTRA_COUNTS.slabDepthLines}
                seed={v.id}
              />
            </>
          ) : null}
        </PerspectiveCorridor>

        <BokehLayer
          id="bokeh-front"
          order={ORDER.bokehFront}
          geo={geo}
          palette={v.palette}
          frame={frame}
          loop={loop}
          seed={v.id}
          from={backCount}
          to={v.bokeh.count}
          count={v.bokeh.count}
          minR={v.bokeh.minR}
          maxR={v.bokeh.maxR}
          alpha={v.bokeh.alpha}
          front
        />

        <FinishPass
          order={ORDER.finish}
          width={width}
          height={height}
          frame={frame}
          loop={loop}
          seed={v.id}
          palette={v.palette}
          bloom={v.bloom}
          vignette={v.vignette}
          grainAlpha={v.grainAlpha}
        />
      </CanvasStage>
    </AbsoluteFill>
  );
};
