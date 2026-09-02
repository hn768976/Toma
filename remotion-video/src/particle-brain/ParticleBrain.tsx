/**
 * ParticleBrain — 3840x2160, 600 frames at 30fps, seamless loop.
 *
 * A brain rendered as a field of quantised particles, sampled once from a
 * drawn silhouette and never resampled. Flow ribbons sweep behind and
 * across it, a scatter of interface glyphs frames it, and the title is
 * made of the same particles as the subject.
 *
 * Layer order, back to front:
 *   background wash -> ribbons (behind) -> brain -> title ->
 *   ribbons (in front, low opacity) -> glyph field ->
 *   bloom (tight + wide) -> vignette -> grain
 *
 * Every particle set, ribbon and glyph is built once in useMemo from a
 * stable string seed. Every frame is a pure function of useCurrentFrame()
 * — no Date.now(), no requestAnimationFrame, no CSS animation, no state
 * beyond the font-ready gate, which is always settled before a frame is
 * captured. `npx remotion render` is therefore deterministic, and frame
 * 600 is pixel-identical to frame 0.
 */
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";

import { buildRibbons, drawRibbons, FlowRibbons } from "../lib/FlowRibbons";
import { buildGlyphs, drawGlyphs, UIGlyphField } from "../lib/UIGlyphField";
import { BloomPass, GrainPass, VignettePass } from "../lib/finishPasses";
import { drawParticleField } from "../lib/particleField";
import { loopSine } from "../lib/loopMath";

import { BackgroundWash } from "./components/BackgroundWash";
import { BrainParticles } from "./components/BrainParticles";
import { TitleText } from "./components/TitleText";
import { buildBrainGeometry } from "./brainShape";
import { buildBrainField, makeBrainPulse } from "./brainParticles";
import { buildTitleField } from "./titleParticles";
import { useTitleFontReady } from "./fonts";
import { getTheme } from "./theme";
import {
  BLOOM_SCALE,
  BLOOM_THRESHOLD,
  BLOOM_TIGHT_BLUR,
  BLOOM_TIGHT_OPACITY,
  BLOOM_WIDE_BLUR,
  BLOOM_WIDE_OPACITY,
  BRAIN_CENTER_X,
  BRAIN_CENTER_Y,
  BRAIN_HEIGHT_FRACTION,
  CAMERA_DRIFT_X,
  CAMERA_DRIFT_Y,
  DURATION_IN_FRAMES,
  FPS,
  GLYPH_COUNT,
  GLYPH_EXCLUSION_RADIUS,
  GLYPH_FLICKER_FRAMES,
  GLYPH_FLICKER_RATE,
  GLYPH_MAX_OPACITY,
  GLYPH_MAX_SIZE,
  GLYPH_MIN_OPACITY,
  GLYPH_MIN_SIZE,
  GRAIN_ALPHA,
  GRAIN_TILE_HEIGHT,
  GRAIN_TILE_WIDTH,
  HEIGHT,
  RIBBON_COUNT,
  RIBBON_FRONT_COUNT,
  RIBBON_HIGHLIGHTS_MAX,
  RIBBON_HIGHLIGHTS_MIN,
  RIBBON_HIGHLIGHT_PERIODS,
  RIBBON_HIGHLIGHT_SPAN,
  RIBBON_MAX_WIDTH,
  RIBBON_MIN_WIDTH,
  RIBBON_REGION_RIGHT,
  TITLE_CENTER_Y,
  VIGNETTE_STRENGTH,
  WIDTH,
} from "./config";

export const particleBrainSchema = z.object({
  variant: z.enum(["teal", "ice", "ember"]),
});

export const particleBrainDefaultProps: z.infer<typeof particleBrainSchema> = {
  variant: "teal",
};

/** Root seed. Every sub-seed is derived from it, so one string fixes the set. */
const SEED = "particle-brain/v1";

/** Layers move by slightly different amounts, which reads as depth. */
const PARALLAX = { ribbonsBack: 1.4, brain: 1, title: 0.85, ribbonsFront: 0.55, glyphs: 0.45 };

export type ParticleBrainProps = z.infer<typeof particleBrainSchema>;

export const ParticleBrain: React.FC<ParticleBrainProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const theme = getTheme(variant);
  const fontReady = useTitleFontReady();

  const centerX = WIDTH * BRAIN_CENTER_X;
  const centerY = HEIGHT * BRAIN_CENTER_Y;

  // ---- built once; never a function of `frame` -------------------------
  const geometry = useMemo(
    () => buildBrainGeometry(HEIGHT * BRAIN_HEIGHT_FRACTION, centerX, centerY, SEED),
    [centerX, centerY],
  );

  const brainField = useMemo(() => buildBrainField(geometry, SEED), [geometry]);

  const title = useMemo(
    () =>
      fontReady
        ? buildTitleField(centerX, TITLE_CENTER_Y, SEED)
        : { particles: [], centerX, centerY: 0 },
    [fontReady, centerX],
  );

  const ribbons = useMemo(
    () =>
      buildRibbons({
        width: WIDTH,
        height: HEIGHT,
        count: RIBBON_COUNT,
        seed: SEED,
        frontCount: RIBBON_FRONT_COUNT,
        regionRight: RIBBON_REGION_RIGHT,
        minWidth: RIBBON_MIN_WIDTH,
        maxWidth: RIBBON_MAX_WIDTH,
        highlightsMin: RIBBON_HIGHLIGHTS_MIN,
        highlightsMax: RIBBON_HIGHLIGHTS_MAX,
        highlightSpan: RIBBON_HIGHLIGHT_SPAN,
        highlightPeriods: RIBBON_HIGHLIGHT_PERIODS,
      }),
    [],
  );

  const glyphs = useMemo(
    () =>
      buildGlyphs({
        width: WIDTH,
        height: HEIGHT,
        count: GLYPH_COUNT,
        seed: SEED,
        minSize: GLYPH_MIN_SIZE,
        maxSize: GLYPH_MAX_SIZE,
        minOpacity: GLYPH_MIN_OPACITY,
        maxOpacity: GLYPH_MAX_OPACITY,
        exclusion: { x: centerX, y: centerY, radius: GLYPH_EXCLUSION_RADIUS },
        duration: DURATION_IN_FRAMES,
        flickerRate: GLYPH_FLICKER_RATE,
        fps: FPS,
      }),
    [centerX, centerY],
  );

  // ---- per-frame, all of it periodic in DURATION_IN_FRAMES -------------
  const camX = CAMERA_DRIFT_X * loopSine(frame, DURATION_IN_FRAMES, 0);
  const camY = CAMERA_DRIFT_Y * loopSine(frame, DURATION_IN_FRAMES / 2, 0.13);
  const pulseAt = makeBrainPulse(geometry, frame);

  const particleColors = {
    base: theme.particleTeal,
    bright: theme.particleBright,
    peak: theme.particleWhite,
  };
  const titleColors = {
    base: theme.textPale,
    bright: theme.particleBright,
    peak: theme.particleWhite,
  };

  /**
   * The bloom source: only the brightest particles, the ribbon highlights
   * and whichever glyphs are mid-flicker. Drawn into the reduced buffer
   * the pass provides; particle sizes are inflated a little so the glow
   * survives the downscale.
   */
  const drawBloomSource = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.translate(camX * PARALLAX.brain, camY * PARALLAX.brain);
    drawParticleField(ctx, brainField, {
      frame,
      duration: DURATION_IN_FRAMES,
      colors: particleColors,
      pulseAt,
      minBrightness: BLOOM_THRESHOLD,
      sizeScale: 1.9,
    });
    ctx.restore();

    ctx.save();
    ctx.translate(camX * PARALLAX.title, camY * PARALLAX.title);
    drawParticleField(ctx, title.particles, {
      frame,
      duration: DURATION_IN_FRAMES,
      colors: titleColors,
      minBrightness: BLOOM_THRESHOLD,
      sizeScale: 1.9,
    });
    ctx.restore();

    drawRibbons(ctx, ribbons, {
      frame,
      layer: "all",
      colorDim: theme.ribbonDim,
      colorBright: theme.ribbonBright,
      highlightsOnly: true,
      offsetX: camX * PARALLAX.ribbonsBack,
      offsetY: camY * PARALLAX.ribbonsBack,
    });

    drawGlyphs(ctx, glyphs, {
      frame,
      duration: DURATION_IN_FRAMES,
      color: theme.glyphTeal,
      flickerColor: theme.glyphPale,
      flickerFrames: GLYPH_FLICKER_FRAMES,
      flickeringOnly: true,
      offsetX: camX * PARALLAX.glyphs,
      offsetY: camY * PARALLAX.glyphs,
    });
  };

  return (
    <AbsoluteFill style={{ backgroundColor: theme.backgroundDeep }}>
      <BackgroundWash theme={theme} centerX={centerX} centerY={centerY} />

      <FlowRibbons
        ribbons={ribbons}
        width={WIDTH}
        height={HEIGHT}
        frame={frame}
        layer="back"
        colorDim={theme.ribbonDim}
        colorBright={theme.ribbonBright}
        offsetX={camX * PARALLAX.ribbonsBack}
        offsetY={camY * PARALLAX.ribbonsBack}
      />

      <BrainParticles
        geometry={geometry}
        field={brainField}
        frame={frame}
        theme={theme}
        cameraX={camX * PARALLAX.brain}
        cameraY={camY * PARALLAX.brain}
      />

      <TitleText
        field={title.particles}
        frame={frame}
        theme={theme}
        cameraX={camX * PARALLAX.title}
        cameraY={camY * PARALLAX.title}
      />

      <FlowRibbons
        ribbons={ribbons}
        width={WIDTH}
        height={HEIGHT}
        frame={frame}
        layer="front"
        colorDim={theme.ribbonDim}
        colorBright={theme.ribbonBright}
        offsetX={camX * PARALLAX.ribbonsFront}
        offsetY={camY * PARALLAX.ribbonsFront}
      />

      <UIGlyphField
        glyphs={glyphs}
        width={WIDTH}
        height={HEIGHT}
        frame={frame}
        duration={DURATION_IN_FRAMES}
        color={theme.glyphTeal}
        flickerColor={theme.glyphPale}
        flickerFrames={GLYPH_FLICKER_FRAMES}
        offsetX={camX * PARALLAX.glyphs}
        offsetY={camY * PARALLAX.glyphs}
      />

      <BloomPass
        width={WIDTH}
        height={HEIGHT}
        scale={BLOOM_SCALE}
        blur={BLOOM_TIGHT_BLUR}
        opacity={BLOOM_TIGHT_OPACITY}
        draw={drawBloomSource}
      />
      <BloomPass
        width={WIDTH}
        height={HEIGHT}
        scale={BLOOM_SCALE}
        blur={BLOOM_WIDE_BLUR}
        opacity={BLOOM_WIDE_OPACITY}
        draw={drawBloomSource}
      />

      <VignettePass
        width={WIDTH}
        height={HEIGHT}
        color={theme.vignette}
        strength={VIGNETTE_STRENGTH}
      />

      <GrainPass
        tileWidth={GRAIN_TILE_WIDTH}
        tileHeight={GRAIN_TILE_HEIGHT}
        frame={frame}
        duration={DURATION_IN_FRAMES}
        alpha={GRAIN_ALPHA}
      />
    </AbsoluteFill>
  );
};
