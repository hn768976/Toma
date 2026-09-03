/**
 * A rotating dot globe with a large punctuation mark held in front of it.
 *
 * Two versions share this one component; `variant` selects a palette, a centre
 * mark, a set of scattered marks and a lattice density from VARIANTS. Nothing
 * else differs between them.
 *
 * The whole piece is a pure function of the frame number — no timers, no rAF,
 * no component state, no Math.random — so any frame can be rendered on any
 * worker in any order and come out identical.
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { CanvasStage } from "./stage/CanvasStage";
import { useLand } from "./lib/useLand";
import { BackgroundWash } from "./components/BackgroundWash";
import { NetworkLines } from "./components/NetworkLines";
import { GlyphField } from "./components/GlyphField";
import { DotGlobe } from "./components/DotGlobe";
import { CentreGlyph } from "./components/CentreGlyph";
import { PostFx } from "./components/PostFx";
import { AMBIENT_DRIFT_PX, DESIGN_HEIGHT } from "./config";
import { VARIANTS, type VariantId } from "./variants";

/** Draw order. The globe sits between the two halves of the glyph field. */
const Z = {
  backgroundWash: 10,
  networkLines: 20,
  glyphFieldFar: 30,
  dotGlobe: 40,
  glyphFieldNear: 50,
  centreGlyph: 60,
  postFx: 100,
} as const;

export type SymbolGlobeProps = {
  variant: VariantId;
  /**
   * Frames in one full loop. Defaults to the composition's own duration, which
   * is what production renders use. Overriding it lets a longer composition
   * render frame 450 of a 450-frame cycle, which is how the loop is verified to
   * close: that frame must be pixel-identical to frame 0.
   */
  loopLength?: number;
};

export const SymbolGlobe: React.FC<SymbolGlobeProps> = ({
  variant,
  loopLength,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  // Loaded here rather than inside <DotGlobe> so that the state update when the
  // polygons arrive re-renders the whole tree, and the stage recomposites.
  const land = useLand();
  const { palette, centreGlyph, centrePulse, fieldSet, networkLineCount, networkOpacity } =
    VARIANTS[variant];

  // A closed figure-of-eight: one cycle horizontally, two vertically, so the
  // camera is exactly where it started at the end of the loop.
  const loop = loopLength ?? durationInFrames;
  const t = frame / loop;
  const amplitude = AMBIENT_DRIFT_PX * (height / DESIGN_HEIGHT);
  const drift = {
    x: Math.sin(Math.PI * 2 * t) * amplitude,
    y: Math.sin(Math.PI * 4 * t) * amplitude,
  };

  return (
    <CanvasStage
      width={width}
      height={height}
      backgroundColor={palette.backgroundDeep}
      drift={drift}
    >
      <BackgroundWash palette={palette} loopLength={loop} z={Z.backgroundWash} />
      <NetworkLines
        palette={palette}
        count={networkLineCount}
        opacity={networkOpacity}
        loopLength={loop}
        z={Z.networkLines}
      />
      <GlyphField
        id="glyph-field-far"
        palette={palette}
        fieldSet={fieldSet}
        depthRange={[0, 0.5]}
        loopLength={loop}
        z={Z.glyphFieldFar}
      />
      <DotGlobe palette={palette} land={land} loopLength={loop} z={Z.dotGlobe} />
      <GlyphField
        id="glyph-field-near"
        palette={palette}
        fieldSet={fieldSet}
        depthRange={[0.5, 1.01]}
        loopLength={loop}
        z={Z.glyphFieldNear}
      />
      <CentreGlyph
        palette={palette}
        kind={centreGlyph}
        pulse={centrePulse}
        z={Z.centreGlyph}
      />
      <PostFx palette={palette} loopLength={loop} z={Z.postFx} />
    </CanvasStage>
  );
};
