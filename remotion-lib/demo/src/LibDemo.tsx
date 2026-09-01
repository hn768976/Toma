import React from "react";
import { AbsoluteFill, Series } from "remotion";
import * as P from "./panels";

/**
 * The panel reel. Every entry is also registered as its own Composition
 * in Root.tsx, so any single component can be opened in isolation in the
 * studio — which is the actual test: a component that cannot be shown on
 * its own is not properly parameterised.
 */
export const PANELS: { id: string; component: React.FC }[] = [
  { id: "SeededRandom", component: P.SeededRandomPanel },
  { id: "LoopPhase", component: P.LoopPhasePanel },
  { id: "RadialPlaces", component: P.RadialPlacesPanel },
  { id: "IrregularDashes", component: P.IrregularDashesPanel },
  { id: "Projection", component: P.ProjectionPanel },
  { id: "DotMapFromLand", component: P.DotMapPanel },
  { id: "ThreeBufferDOF", component: P.ThreeBufferDOFPanel },
  { id: "BloomPass", component: P.BloomPassPanel },
  { id: "VignettePass", component: P.VignettePanel },
  { id: "GrainPass", component: P.GrainPanel },
  { id: "LowResUpscale", component: P.LowResUpscalePanel },
  { id: "NeonStroke", component: P.NeonStrokePanel },
  { id: "TaperedStroke", component: P.TaperedStrokePanel },
  { id: "DrawOn", component: P.DrawOnPanel },
  { id: "StrokeFor", component: P.StrokeForPanel },
  { id: "MidpointDisplacement", component: P.MidpointDisplacementPanel },
  { id: "TrendingWalk", component: P.TrendingWalkPanel },
  { id: "NoiseField", component: P.NoiseFieldPanel },
  { id: "ParticleFromMask", component: P.ParticleFromMaskPanel },
  { id: "BlobPath", component: P.BlobPathPanel },
  { id: "TornEdge", component: P.TornEdgePanel },
  { id: "Rings", component: P.RingsPanel },
];

export const PANEL_DURATION = 50;
export const LIB_DEMO_DURATION = PANELS.length * PANEL_DURATION;

export const LibDemo: React.FC = () => (
  <AbsoluteFill>
    <Series>
      {PANELS.map(({ id, component: Component }) => (
        <Series.Sequence key={id} durationInFrames={PANEL_DURATION}>
          <Component />
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
);
