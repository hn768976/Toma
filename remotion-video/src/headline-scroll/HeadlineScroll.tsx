import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  random,
  useCurrentFrame,
} from "remotion";
import { z } from "zod";
import {
  BLOOM_PASSES,
  CENTER_X,
  CENTER_Y,
  CHROMATIC_OFFSET,
  DURATION_IN_FRAMES,
  GLITCH_CHROMATIC_OFFSET,
  GLOW_ALPHA,
  GLOW_PULSE_AMOUNT,
  GLOW_PULSE_PERIOD,
  GLOW_RADIUS_RATIO,
  GLOW_STRENGTH,
  GRAIN_ALPHA,
  GRAIN_TILE_COUNT,
  GRAIN_TILE_SIZE,
  HEIGHT,
  SCRIM_ALPHA,
  SCRIM_RADIUS_SCALE,
  WIDTH,
} from "./constants";
import {
  buildGlitches,
  buildGrainTiles,
  buildVignette,
  buildWordSprite,
  glitchAt,
} from "./effects";
import { areFontsReady, fontsReady } from "./fonts";
import { buildLineBuffer, buildLineSpecs, createCanvas } from "./lines";
import { THEMES, THEME_NAMES, withAlpha } from "./theme";

export const headlineScrollSchema = z.object({
  /** Picks a palette out of THEMES. A second palette is a data change here. */
  variant: z.enum(THEME_NAMES),
  /** The one sharp thing in the frame. */
  word: z.string().min(1),
});

export type HeadlineScrollProps = z.infer<typeof headlineScrollSchema>;

export const headlineScrollDefaults: HeadlineScrollProps = {
  variant: "dark",
  word: "AI",
};

/** Every random() in this composition hangs off this, so the loop is stable. */
const SEED = "headline-scroll";

const TAU = Math.PI * 2;

/**
 * A 4K montage of blurred, drifting newsprint with one pin-sharp word held dead
 * centre. Drawn entirely into a single canvas: the scrolling layer is a set of
 * pre-blurred tile buffers that only get blitted with an x offset each frame,
 * which is the difference between a render that finishes and one that does not.
 *
 * All motion is a pure function of useCurrentFrame(); nothing here reads a
 * clock, schedules a frame, or animates through CSS.
 */
export const HeadlineScroll: React.FC<HeadlineScrollProps> = ({
  variant,
  word,
}) => {
  const frame = useCurrentFrame();
  const theme = THEMES[variant];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Font readiness is the one piece of state here, and it is asset loading, not
  // animation: tile widths come from measureText(), so measuring against a
  // fallback face would quietly change every line's scroll speed.
  const [fontsLoaded, setFontsLoaded] = useState(areFontsReady);

  useEffect(() => {
    if (fontsLoaded) return;
    const handle = delayRender("Loading headline fonts");
    let live = true;
    fontsReady.then(() => {
      if (live) setFontsLoaded(true);
      continueRender(handle);
    });
    return () => {
      live = false;
    };
  }, [fontsLoaded]);

  // Everything expensive happens exactly once.
  const scene = useMemo(() => {
    if (!fontsLoaded) return null;
    return {
      lines: buildLineSpecs(theme, SEED).map((spec) =>
        buildLineBuffer(spec, theme),
      ),
      wordSprite: buildWordSprite(word, theme),
      vignette: buildVignette(theme),
      grain: buildGrainTiles(theme, SEED),
      glitches: buildGlitches(SEED),
      // Reused scratch copy for tearing slices sideways during a glitch.
      scratch: createCanvas(WIDTH, HEIGHT),
    };
  }, [fontsLoaded, theme, word]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scene) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loopFrame = ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) %
      DURATION_IN_FRAMES;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // ------------------------------------------------ the scrolling layer ---
    ctx.globalCompositeOperation = theme.blend.lines;
    for (const line of scene.lines) {
      const { spec } = line;
      // Written as cycles * tileWidth * frame / DURATION rather than
      // speed * frame so that at frame 210 the shift is exactly a whole number
      // of tiles, with no floating-point drift to break the loop.
      const shift =
        (spec.direction * spec.cycles * spec.tileWidth * loopFrame) /
        DURATION_IN_FRAMES;
      const base = (((shift % spec.tileWidth) + spec.tileWidth) %
        spec.tileWidth) - spec.tileWidth;
      const drift =
        spec.driftAmplitude *
        Math.sin((TAU * loopFrame) / spec.driftPeriod + spec.driftPhase);
      const y = spec.y + drift - line.offsetY;

      ctx.globalAlpha = spec.alpha;
      for (let k = 0; k <= line.repeats; k++) {
        ctx.drawImage(line.canvas, base + k * spec.tileWidth, y);
      }
    }
    ctx.globalAlpha = 1;

    // ------------------------------------------------------ the halo ------
    const pulse =
      1 + GLOW_PULSE_AMOUNT * Math.sin((TAU * loopFrame) / GLOW_PULSE_PERIOD);
    const glowRadius = GLOW_RADIUS_RATIO * HEIGHT * pulse;
    const scrimRadius = GLOW_RADIUS_RATIO * HEIGHT * SCRIM_RADIUS_SCALE;

    const radialFill = (
      radius: number,
      color: string,
      peak: number,
      falloff: number,
      blend: GlobalCompositeOperation,
    ) => {
      const gradient = ctx.createRadialGradient(
        CENTER_X,
        CENTER_Y,
        0,
        CENTER_X,
        CENTER_Y,
        radius,
      );
      const stops = 10;
      for (let i = 0; i <= stops; i++) {
        const t = i / stops;
        gradient.addColorStop(t, withAlpha(color, peak * (1 - t) ** falloff));
      }
      ctx.globalCompositeOperation = blend;
      ctx.fillStyle = gradient;
      ctx.fillRect(
        CENTER_X - radius,
        CENTER_Y - radius,
        radius * 2,
        radius * 2,
      );
    };

    // Scrim first, and wider than the halo: it is what visibly knocks the
    // blurred text down underneath the word instead of letting the glow just
    // pile brightness on top of it.
    radialFill(scrimRadius, theme.scrim, SCRIM_ALPHA, 1.8, "source-over");
    radialFill(
      glowRadius,
      theme.glow,
      GLOW_ALPHA * GLOW_STRENGTH * pulse,
      2.2,
      theme.blend.glow,
    );

    // ------------------------------------------------- the sharp word -----
    const glitch = glitchAt(scene.glitches, loopFrame);
    const sprite = scene.wordSprite;

    // Bloom, on the word only. The blurred text never blooms.
    ctx.globalCompositeOperation = theme.blend.glow;
    for (const pass of BLOOM_PASSES) {
      ctx.filter = `blur(${pass.blur}px)`;
      ctx.globalAlpha = pass.alpha * GLOW_STRENGTH;
      ctx.drawImage(sprite.white, sprite.x, sprite.y);
    }
    ctx.filter = "none";
    ctx.globalAlpha = 1;

    const offset = glitch ? GLITCH_CHROMATIC_OFFSET : CHROMATIC_OFFSET;
    ctx.drawImage(sprite.red, sprite.x - offset, sprite.y);
    ctx.drawImage(sprite.cyan, sprite.x + offset, sprite.y);
    ctx.drawImage(sprite.white, sprite.x, sprite.y);

    // ----------------------------------------------------- glitch tear ----
    ctx.globalCompositeOperation = "source-over";
    if (glitch) {
      const scratchCtx = scene.scratch.getContext("2d");
      if (scratchCtx) {
        scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
        scratchCtx.globalCompositeOperation = "copy";
        scratchCtx.drawImage(canvas, 0, 0);
        for (const slice of glitch.slices) {
          ctx.fillStyle = theme.background;
          ctx.fillRect(0, slice.y, WIDTH, slice.height);
          ctx.drawImage(
            scene.scratch,
            0,
            slice.y,
            WIDTH,
            slice.height,
            slice.shift,
            slice.y,
            WIDTH,
            slice.height,
          );
        }
      }
    }

    // --------------------------------------------------------- finish -----
    ctx.drawImage(scene.vignette, 0, 0);

    const tile = scene.grain[loopFrame % GRAIN_TILE_COUNT];
    const pattern = ctx.createPattern(tile, "repeat");
    if (pattern) {
      ctx.save();
      ctx.globalCompositeOperation = theme.blend.grain;
      ctx.globalAlpha = GRAIN_ALPHA;
      ctx.translate(
        -Math.floor(random(`${SEED}-grain-x-${loopFrame}`) * GRAIN_TILE_SIZE),
        -Math.floor(random(`${SEED}-grain-y-${loopFrame}`) * GRAIN_TILE_SIZE),
      );
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, WIDTH + GRAIN_TILE_SIZE, HEIGHT + GRAIN_TILE_SIZE);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }, [frame, scene, theme]);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
