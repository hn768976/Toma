/**
 * ArrowField — a 4K abstract field of translucent arrows and shards drifting
 * on a shared axis, concentrated in one diagonal half of the frame so the
 * opposite corner stays dark and open for copy.
 *
 * One implementation, two clips. Everything that differs between "red" and
 * "green" — palette, arrow direction, drift axis, which corner is dense, and
 * whether outline-only arrows appear — is a signed value in VARIANTS. Flipping
 * the sign of `drift` flips the arrows, the drift, the wrap direction and the
 * shard alignment together, because all four read the same vector.
 *
 * Determinism: every quantity below is a pure function of
 * `frame % LOOP_FRAMES` and Remotion's seeded `random()`. No clock, no rAF,
 * no CSS animation, no component state. Frames render identically in any
 * order and on any machine, and frame 0 equals frame 330.
 *
 * Frame pipeline, in layout-effect order:
 *   background -> shards -> arrows -> depth composite -> sparks -> bloom -> grain
 */

import React, { useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import {
  ARROW_COUNT,
  ARROW_TILT_DEG,
  BLOOM_H,
  BLOOM_W,
  BUILD_OPTIONS,
  CAMERA_DRIFT_PX,
  GRAIN_H,
  GRAIN_W,
  GRAIN_ALPHA,
  HEIGHT,
  LOOP_FRAMES,
  OUTLINE_ARROW_SIZE_BOOST,
  SHARD_COUNT,
  SHARD_TILT_DEG,
  SPARK_COUNT,
  VIEWPORT,
  VIGNETTE_STRENGTH,
  WIDTH,
} from "./constants";
import { useDepthBuffers } from "./depth";
import { TAU } from "../lib/random";
import { axisFrame, buildElements } from "../lib/drift";
import { ShardField } from "../lib/ShardField";
import { DepthComposite } from "../lib/depthBuffers";
import { BloomPass, bloomLayerStyle } from "../lib/passes/bloomPass";
import { GrainPass, grainLayerStyle } from "../lib/passes/grainPass";
import { VignettePass } from "../lib/passes/vignettePass";
import {
  ARROW_BASE_HALF_EXTENT,
  SHARD_SPRITE_COUNT,
  SPARK_SPRITE_RADIUS,
  buildArrowSprites,
  buildShardSprites,
  buildSparkSprite,
  shardBaseHalfExtent,
} from "./sprites";
import { ArrowShape } from "./ArrowShape";
import { BackgroundGradient } from "./BackgroundGradient";
import { SparkLayer } from "./SparkLayer";
import { VARIANTS, VariantName } from "./variants";

export const arrowFieldSchema = z.object({
  variant: z.enum(["red", "green"]),
});

export type ArrowFieldProps = { variant: VariantName };

const fullSize: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  display: "block",
};

export const ArrowField: React.FC<ArrowFieldProps> = ({ variant }) => {
  const rawFrame = useCurrentFrame();
  // Everything downstream sees the looped frame, which is what makes frame 0
  // and frame LOOP_FRAMES identical rather than merely continuous.
  const frame = rawFrame % LOOP_FRAMES;
  const t = frame / LOOP_FRAMES;

  const config = VARIANTS[variant];
  const { palette, densityCorner: corner, drift, outlineArrowCount } = config;

  const axis = useMemo(() => axisFrame(drift, VIEWPORT), [drift]);

  const shardElements = useMemo(
    () =>
      buildElements(
        {
          key: `shard:${variant}`,
          count: SHARD_COUNT,
          baseHalfExtent: shardBaseHalfExtent,
          spriteCount: SHARD_SPRITE_COUNT,
          tiltDeg: SHARD_TILT_DEG,
          widthJitter: { min: 0.7, max: 1.4 },
        },
        axis,
        corner,
        BUILD_OPTIONS,
      ),
    [variant, axis, corner],
  );

  const arrowElements = useMemo(
    () =>
      buildElements(
        {
          key: `arrow:${variant}`,
          count: ARROW_COUNT,
          baseHalfExtent: () => ARROW_BASE_HALF_EXTENT,
          spriteCount: 1,
          tiltDeg: ARROW_TILT_DEG,
        },
        axis,
        corner,
        BUILD_OPTIONS,
      ),
    [variant, axis, corner],
  );

  const outlineArrowElements = useMemo(
    () =>
      buildElements(
        {
          key: `arrow-outline:${variant}`,
          count: outlineArrowCount,
          baseHalfExtent: () => ARROW_BASE_HALF_EXTENT,
          spriteCount: 1,
          tiltDeg: ARROW_TILT_DEG,
          sizeBoost: OUTLINE_ARROW_SIZE_BOOST,
        },
        axis,
        corner,
        BUILD_OPTIONS,
      ),
    [variant, axis, corner, outlineArrowCount],
  );

  const sparkElements = useMemo(
    () =>
      buildElements(
        {
          key: `spark:${variant}`,
          count: SPARK_COUNT,
          baseHalfExtent: () => SPARK_SPRITE_RADIUS,
          spriteCount: 1,
          tiltDeg: 0,
          sizeBoost: 0.6,
        },
        axis,
        corner,
        BUILD_OPTIONS,
      ),
    [variant, axis, corner],
  );

  const sprites = useMemo(() => {
    if (typeof document === "undefined") return null;
    return {
      shards: buildShardSprites(palette),
      arrows: buildArrowSprites(palette),
      spark: buildSparkSprite(palette),
    };
  }, [palette]);

  const buffers = useDepthBuffers();
  const fieldRef = useRef<HTMLCanvasElement>(null);
  const bloomRef = useRef<HTMLCanvasElement>(null);
  const grainRef = useRef<HTMLCanvasElement>(null);

  // Ambient camera drift: one turn of a small circle per loop. No cuts, no
  // zoom — just enough motion that the frame is never perfectly still.
  const camX = CAMERA_DRIFT_PX * Math.sin(TAU * t);
  const camY = CAMERA_DRIFT_PX * Math.cos(TAU * t);
  const camera = `translate(${camX.toFixed(3)}px, ${camY.toFixed(3)}px)`;

  return (
    <AbsoluteFill style={{ backgroundColor: palette.bgDeep, overflow: "hidden" }}>
      <BackgroundGradient variant={variant} frame={frame} />

      <canvas
        ref={fieldRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ ...fullSize, transform: camera }}
      />
      <canvas
        ref={bloomRef}
        width={BLOOM_W}
        height={BLOOM_H}
        style={bloomLayerStyle({ blur: 26, opacity: 0.42, transform: camera })}
      />

      <VignettePass color={palette.bgDeep} strength={VIGNETTE_STRENGTH} />

      <canvas
        ref={grainRef}
        width={GRAIN_W}
        height={GRAIN_H}
        style={grainLayerStyle(GRAIN_ALPHA)}
      />

      {/* Draw passes. These render no DOM; their order is the frame pipeline. */}
      {sprites ? (
        <>
          <ShardField
            buffers={buffers}
            frame={frame}
            loopFrames={LOOP_FRAMES}
            elements={shardElements}
            sprites={sprites.shards}
            axis={axis}
            corner={corner}
            viewport={VIEWPORT}
            falloff={BUILD_OPTIONS.falloff}
          />
          <ArrowShape
            buffers={buffers}
            frame={frame}
            filled={arrowElements}
            outlined={outlineArrowElements}
            filledSprite={sprites.arrows.filled}
            outlineSprite={sprites.arrows.outline}
            axis={axis}
            corner={corner}
          />
          <DepthComposite buffers={buffers} targetRef={fieldRef} frame={frame} />
          <SparkLayer
            targetRef={fieldRef}
            frame={frame}
            elements={sparkElements}
            sprite={sprites.spark}
            axis={axis}
            corner={corner}
          />
          <BloomPass
            sourceRef={fieldRef}
            targetRef={bloomRef}
            width={BLOOM_W}
            height={BLOOM_H}
          />
          <GrainPass
            targetRef={grainRef}
            frame={frame}
            width={GRAIN_W}
            height={GRAIN_H}
          />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
