import React, { useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import { HEIGHT, LOOP_FRAMES, WIDTH } from "./constants";
import { activeLeaks, buildLeakEvents } from "./lib/leak";
import { BaseFill } from "./layers/BaseFill";
import { BlotchLayer } from "./layers/BlotchLayer";
import { DustField } from "./layers/DustField";
import { EdgeVignette } from "./layers/EdgeVignette";
import { FilmGrain } from "./layers/FilmGrain";
import { HairLayer } from "./layers/HairLayer";
import { LightLeak } from "./layers/LightLeak";
import { ScratchLayer } from "./layers/ScratchLayer";
import type { LayerMode } from "./layers/types";
import { VARIANTS } from "./variants";

export const grungeOverlaySchema = z.object({
  variant: z.enum(["dust"]),
  /**
   * Renders the overlay on transparency instead of on its near-black base:
   * light layers contribute alpha, darkening layers take it away. Needs a
   * codec that carries alpha (ProRes 4444 or VP9/WebM).
   */
  alpha: z.boolean().optional(),
  /** QA only: used by the loop-check composition, where grain would mask a
   *  genuine mismatch between frame 0 and frame 900. */
  debugDisableGrain: z.boolean().optional(),
});

export type GrungeOverlayProps = z.infer<typeof grungeOverlaySchema>;

/**
 * A 4K grunge overlay: dust, scratches, blotches, hairs, light leaks, grain
 * and an edge vignette, composited onto a near-black ground.
 *
 * ARCHITECTURE
 *
 * Every layer is a separate component taking an `intensity`, and a variant is
 * nothing more than a palette plus a set of intensities (see variants.ts). A
 * variant that does not want a layer sets its intensity to zero rather than
 * omitting the component, so all three overlays run the same code path.
 *
 * All the layers draw into this one 4K canvas rather than each owning their
 * own. That is deliberate: eight full-size canvases would cost a quarter of a
 * gigabyte per render worker, and canvas-native composite operations give far
 * more control than CSS blend modes — in particular they are what makes the
 * transparent alpha build possible at all.
 *
 * Draw order is React tree order. Layout effects fire depth-first in the order
 * children appear and all of them before the parent's, so <BaseFill> clearing
 * first and <EdgeVignette> darkening last is simply their position below. The
 * layers must not be memoised or their effect would be skipped on a frame
 * where their props happened not to change.
 *
 * Nothing here reads Date.now(), requestAnimationFrame or component state:
 * every pixel is a pure function of the frame number, which is what makes a
 * distributed `npx remotion render` deterministic.
 */
export const GrungeOverlay: React.FC<GrungeOverlayProps> = ({
  variant,
  alpha,
  debugDisableGrain,
}) => {
  const rawFrame = useCurrentFrame();
  // Everything except grain is scheduled from the frame's position in the
  // loop, so frame 900 reproduces frame 0 exactly.
  const frame = ((rawFrame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;

  const config = VARIANTS[variant];
  const { palette, layers, motion } = config;
  const mode: LayerMode = alpha ? "alpha" : "screen";
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const leakEvents = useMemo(
    () => buildLeakEvents(layers.leak, LOOP_FRAMES),
    [layers.leak],
  );
  // Resolved here rather than inside <LightLeak> because <FilmGrain> needs it
  // too, to raise grain amplitude inside the lit region.
  const leaks = useMemo(() => activeLeaks(leakEvents, frame), [leakEvents, frame]);

  const base = {
    canvasRef,
    frame,
    width: WIDTH,
    height: HEIGHT,
    mode,
    palette,
  };

  return (
    <AbsoluteFill
      style={{ backgroundColor: mode === "alpha" ? "transparent" : palette.base }}
    >
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <BaseFill
        canvasRef={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        mode={mode}
        palette={palette}
      />
      <BlotchLayer {...base} intensity={layers.blotches.intensity} settings={layers.blotches} motion={motion} />
      <LightLeak
        {...base}
        intensity={layers.leak.intensity}
        settings={layers.leak}
        loopFrames={LOOP_FRAMES}
        leaks={leaks}
      />
      <DustField {...base} intensity={layers.dust.intensity} settings={layers.dust} motion={motion} />
      <ScratchLayer
        {...base}
        intensity={layers.scratches.intensity}
        settings={layers.scratches}
        loopFrames={LOOP_FRAMES}
      />
      <HairLayer
        {...base}
        intensity={layers.hairs.intensity}
        settings={layers.hairs}
        loopFrames={LOOP_FRAMES}
      />
      <FilmGrain
        {...base}
        intensity={debugDisableGrain ? 0 : layers.grain.intensity}
        settings={layers.grain}
        motion={motion}
        loopFrames={LOOP_FRAMES}
        leaks={leaks}
      />
      <EdgeVignette {...base} intensity={layers.vignette.intensity} />
    </AbsoluteFill>
  );
};
