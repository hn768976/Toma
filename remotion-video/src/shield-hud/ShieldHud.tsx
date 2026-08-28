import { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import {
  ACCENT_BLOOM,
  BREATH_DEPTH,
  BREATH_PERIOD,
  DEPTH,
  GLYPH_BLOOM,
  HEIGHT,
  WIDTH,
} from "./constants";
import {
  clearLayer,
  compositeLayer,
  createBuffers,
  createGrainTiles,
  drawGrain,
  drawVignette,
} from "./buffers";
import { driftAt } from "./geometry";
import { buildGlyphGeometry } from "./paths";
import { buildReadoutModel } from "./readout-model";
import { buildSweep } from "./sweep";
import { applyTear, buildGlitchSchedule, compositeSplitGlyph, glitchAt } from "./glitch";
import { SceneContext, buildLayout, type Scene } from "./scene";
import { VARIANTS, type VariantKey } from "./variants";
import { BackgroundLayer } from "./components/BackgroundLayer";
import { ReadoutColumn } from "./components/ReadoutColumn";
import { AccentBar } from "./components/AccentBar";
import { BracketMarks } from "./components/BracketMarks";
import { LogStrip } from "./components/LogStrip";
import { CentreGlyph } from "./components/CentreGlyph";
import { SweepHead } from "./components/SweepHead";

export type ShieldHudProps = { variant: VariantKey };

/**
 * Neon shield HUD. Everything is drawn to one 3840x2160 canvas through a ref,
 * once per React render — no requestAnimationFrame, no component state, no
 * CSS animation. Every value below is a pure function of the frame number,
 * so `npx remotion render` is deterministic and the 330-frame loop closes.
 *
 * Elements draw into depth buffers during their own layout effects; this
 * component clears the buffers on the way into the render and composites
 * them on the way out, which is the only ordering the effect phase
 * guarantees.
 */
export const ShieldHud: React.FC<ShieldHudProps> = ({ variant: variantKey }) => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const variant = VARIANTS[variantKey];
  const seed = `shield-hud-${variantKey}`;

  const buffers = useMemo(() => createBuffers(), []);
  const grain = useMemo(() => createGrainTiles(seed), [seed]);
  const layout = useMemo(() => buildLayout(variant), [variant]);

  const geometry = useMemo(() => {
    const { inner } = variant.glyph;
    // The inner shape is built at its own size and dropped into place inside
    // the outline before either is handed over.
    const innerPoints = inner
      ? inner.outline(HEIGHT * inner.heightRatio).map((point) => ({
          x: point.x,
          y: point.y + HEIGHT * inner.offsetYRatio,
        }))
      : undefined;
    return buildGlyphGeometry(
      variant.glyph.outline(HEIGHT * variant.glyph.heightRatio),
      variant.glyph.integrity,
      seed,
      innerPoints,
    );
  }, [seed, variant]);
  const sweep = useMemo(() => buildSweep(variant, geometry, seed), [geometry, seed, variant]);
  const readouts = useMemo(
    () => buildReadoutModel(variant.panelDensity, variant.panelBehaviour, seed),
    [seed, variant],
  );
  const glitchEvents = useMemo(() => buildGlitchSchedule(seed), [seed]);
  const glitch = variant.glitch
    ? glitchAt(glitchEvents, frame, seed)
    : { active: false, slices: [], split: 0 };

  const scene: Scene = {
    frame,
    variant,
    palette: variant.palette,
    buffers,
    drift: driftAt(frame),
    geometry,
    sweep,
    readouts,
    layout,
    seed,
    breath: 1 + BREATH_DEPTH * Math.sin((2 * Math.PI * frame) / BREATH_PERIOD),
  };

  // Cleared here, in the render pass, because every child's layout effect
  // runs after this and before the composite below.
  clearLayer(buffers.far);
  clearLayer(buffers.mid);
  clearLayer(buffers.near);
  clearLayer(buffers.accent);
  clearLayer(buffers.glyph);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Three depth buckets, each blurred exactly once on its way onto frame.
    compositeLayer(ctx, buffers.far, { mode: "source-over", blur: DEPTH.far.blur });
    compositeLayer(ctx, buffers.mid, { blur: DEPTH.mid.blur });
    compositeLayer(ctx, buffers.near, { blur: DEPTH.near.blur });

    // Accent bars: their depth blur, then a moderate bloom.
    compositeLayer(ctx, buffers.accent, { blur: DEPTH.accent.blur });
    compositeLayer(ctx, buffers.accent, {
      blur: ACCENT_BLOOM.blur,
      alpha: ACCENT_BLOOM.alpha,
    });

    // Generous bloom under the glyph, then the sharp copy on top — the glyph
    // is the only element in frame that is in focus.
    for (const bloom of GLYPH_BLOOM) {
      compositeLayer(ctx, buffers.glyph, { blur: bloom.blur, alpha: bloom.alpha });
    }
    if (glitch.active) {
      compositeSplitGlyph(ctx, buffers.glyph, buffers.scratch, glitch.split, 1);
    } else {
      compositeLayer(ctx, buffers.glyph, { blur: 0 });
    }

    drawVignette(ctx);
    drawGrain(ctx, grain, frame, seed);

    // The tear runs last, so it displaces the finished frame.
    if (glitch.active) applyTear(ctx, buffers.scratch, glitch.slices);
  });

  return (
    <AbsoluteFill style={{ backgroundColor: variant.palette.backgroundDeep }}>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <SceneContext.Provider value={scene}>
        <BackgroundLayer />
        <BracketMarks />
        {variant.panelDensity.columns.map((_, index) => (
          <ReadoutColumn key={index} index={index} />
        ))}
        {variant.panelDensity.logStrip ? <LogStrip /> : null}
        {layout.accentBars.map((_, index) => (
          <AccentBar key={index} index={index} />
        ))}
        <CentreGlyph path={geometry} integrity={variant.glyph.integrity} />
        <SweepHead />
      </SceneContext.Provider>
    </AbsoluteFill>
  );
};
