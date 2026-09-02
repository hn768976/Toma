/**
 * Hazard symbol — a 4K, 20-second, seamlessly looping warning mark.
 *
 * One component drives both variants. Everything it needs to tell them apart
 * lives in VARIANTS: a palette, which symbol to draw, and how the energy
 * inside that symbol behaves. The layers below it are variant-agnostic.
 *
 * Rendering model
 * ---------------
 * A single 3840x2160 canvas is created once and mounted by ref. This component
 * clears it during its own render; the layer components then draw into it
 * during theirs, in JSX order, which is the paint order. The finishing passes
 * — bloom, vignette, grain — need the finished composite, so they run in this
 * component's layout effect, which React fires after every child has rendered.
 * There is no requestAnimationFrame and no state: each frame is drawn exactly
 * once, and the frame number is the only input, so `remotion render` is
 * deterministic and frames may be produced in any order across workers.
 *
 * Loop closure
 * ------------
 * Every animated quantity is a function of t = (frame mod 600) / 600 with a
 * whole number of cycles: the noise bands, the ring's breathing, the rim
 * glow's pulse, the assembly's drift, the plate's light and the grain. Frame 0
 * and frame 600 are therefore pixel-identical.
 */

import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import {
  CENTER_X,
  CENTER_Y,
  DISC_RADIUS,
  DRIFT_AMPLITUDE,
  DRIFT_CYCLES_X,
  DRIFT_CYCLES_Y,
  GRAIN_ALPHA,
  GRAIN_TILE_COUNT,
  GRAIN_TILE_SIZE,
  HEIGHT,
  LOOP_FRAMES,
  RING_BREATHE_CYCLES,
  RING_BREATHE_DEPTH,
  RING_RADIUS,
  RING_WIDTH,
  RIM_GLOW_CYCLES,
  RIM_GLOW_BASE,
  RIM_GLOW_DEPTH,
  TAU,
  VIGNETTE_STRENGTH,
  WIDTH,
  WISP_REACH,
} from "./constants";
import { VARIANTS } from "./variants";
import { EnergyFill } from "./EnergyFill";
import { OuterRing } from "./OuterRing";
import { PerforatedPlate } from "./PerforatedPlate";
import { RimGlow } from "./RimGlow";
import { SymbolShape, getSymbolGeometry } from "./SymbolShape";
import { createLayer } from "./lib/canvas";
import { bloomPass, createBloomBuffers } from "./lib/bloomPass";
import { buildGrainTiles, grainPass } from "./lib/grainPass";
import { vignettePass } from "./lib/vignettePass";

const BLOOM_SCALE = 0.25;

export const hazardSymbolSchema = z.object({
  variant: z.enum(["radiation", "biohazard"]),
});

export type HazardSymbolProps = z.infer<typeof hazardSymbolSchema>;

export const HazardSymbol: React.FC<HazardSymbolProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { palette, symbol, shimmer } = VARIANTS[variant];

  const frameInLoop = ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
  const t = frameInLoop / LOOP_FRAMES;

  // The canvas is ours rather than React's, so a drawing context exists during
  // render — before any ref would have been attached.
  const stage = useMemo(() => createLayer(WIDTH, HEIGHT), []);
  const bloom = useMemo(() => createBloomBuffers(WIDTH, HEIGHT, BLOOM_SCALE), []);
  const grain = useMemo(
    () => buildGrainTiles("hazard-grain", GRAIN_TILE_COUNT, GRAIN_TILE_SIZE),
    [],
  );
  const geometry = useMemo(() => getSymbolGeometry(symbol), [symbol]);

  const energyMask = useMemo(
    () => ({
      size: geometry.size,
      noiseSize: geometry.noiseSize,
      clip: geometry.eroded,
      coverage: geometry.coverage,
      edge: geometry.edge,
      wisp: geometry.wisp,
    }),
    [geometry],
  );

  const energyLook = useMemo(
    () => ({
      dark: palette.symbolDark,
      mid: palette.symbol,
      bright: palette.symbolBright,
      lowWeight: shimmer.lowWeight,
      highWeight: shimmer.highWeight,
      lowCycles: shimmer.lowCycles,
      highCycles: shimmer.highCycles,
      contrast: shimmer.contrast,
      edgeBoost: shimmer.edgeBoost,
      wispGain: shimmer.wispGain,
      wispBlur: shimmer.wispBlur,
      flareGap: shimmer.flareGap,
      flareDuration: shimmer.flareDuration,
      flareOnset: shimmer.flareOnset,
    }),
    [palette, shimmer],
  );

  const plateLook = useMemo(
    () => ({ base: palette.plateDark, patch: palette.plateMid, hole: palette.plateHole }),
    [palette],
  );

  // The whole assembly drifts on a closed Lissajous path — a slow settling,
  // never a rotation. A spinning hazard mark reads as decoration.
  const driftX = Math.sin(TAU * DRIFT_CYCLES_X * t) * DRIFT_AMPLITUDE;
  const driftY =
    Math.sin(TAU * DRIFT_CYCLES_Y * t + Math.PI / 3) * DRIFT_AMPLITUDE * 0.7;
  const centerX = CENTER_X + driftX;
  const centerY = CENTER_Y + driftY;

  const ringGlow = 1 + RING_BREATHE_DEPTH * Math.sin(TAU * RING_BREATHE_CYCLES * t);
  const rimGlow =
    RIM_GLOW_BASE *
    (1 + RIM_GLOW_DEPTH * Math.sin(TAU * RIM_GLOW_CYCLES * t + Math.PI / 5));

  const { ctx } = stage;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  useLayoutEffect(() => {
    bloomPass(ctx, bloom, {
      // Above the accent's own luminance, so only the ring and the shimmer's
      // hottest regions bloom — not the whole symbol.
      threshold: 0.74,
      radii: [5, 20],
      strengths: [0.55, 0.42],
      scale: BLOOM_SCALE,
    });
    vignettePass(ctx, VIGNETTE_STRENGTH);
    grainPass(ctx, grain, frameInLoop, GRAIN_ALPHA);
  });

  const mount = (element: HTMLDivElement | null) => {
    if (element && stage.canvas.parentNode !== element) {
      element.appendChild(stage.canvas);
    }
  };

  return (
    <AbsoluteFill style={{ backgroundColor: palette.plateDark }}>
      <div ref={mount} style={{ width: WIDTH, height: HEIGHT }} />
      <PerforatedPlate
        ctx={ctx}
        look={plateLook}
        seed="hazard-plate"
        width={WIDTH}
        height={HEIGHT}
        t={t}
      />
      <OuterRing
        ctx={ctx}
        centerX={centerX}
        centerY={centerY}
        discRadius={DISC_RADIUS}
        ringRadius={RING_RADIUS}
        ringWidth={RING_WIDTH}
        discColor={palette.discBlack}
        ringColor={palette.ring}
        glowColor={palette.ringGlow}
        glow={ringGlow}
      />
      <SymbolShape
        ctx={ctx}
        geometry={geometry}
        palette={palette}
        centerX={centerX}
        centerY={centerY}
      />
      <EnergyFill
        ctx={ctx}
        mask={energyMask}
        look={energyLook}
        seed={`hazard-energy-${variant}`}
        frame={frame}
        centerX={centerX}
        centerY={centerY}
      />
      <RimGlow
        ctx={ctx}
        mask={geometry.dilated}
        color={palette.ringGlow}
        blur={WISP_REACH * 0.55}
        intensity={rimGlow}
        centerX={centerX}
        centerY={centerY}
      />
    </AbsoluteFill>
  );
};
