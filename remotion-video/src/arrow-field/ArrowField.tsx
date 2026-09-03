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
  CAMERA_DRIFT_PX,
  GRAIN_ALPHA,
  HEIGHT,
  LOOP_FRAMES,
  OUTLINE_ARROW_SIZE_BOOST,
  SHARD_COUNT,
  SHARD_TILT_DEG,
  SPARK_COUNT,
  WIDTH,
} from "./constants";
import { useDepthBuffers } from "./depth";
import { TAU, axisFrame, buildElements } from "./geometry";
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
import { ShardField } from "./ShardField";
import { SparkLayer } from "./SparkLayer";
import {
  BLOOM_H,
  BLOOM_W,
  BloomPass,
  DepthComposite,
  GRAIN_H,
  GRAIN_W,
  GrainLayer,
  Vignette,
} from "./finish";
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

  const axis = useMemo(() => axisFrame(drift), [drift]);

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
        style={{
          ...fullSize,
          transform: camera,
          filter: "blur(26px) brightness(1.5) contrast(1.35)",
          mixBlendMode: "screen",
          opacity: 0.42,
        }}
      />

      <Vignette deep={palette.bgDeep} />

      <canvas
        ref={grainRef}
        width={GRAIN_W}
        height={GRAIN_H}
        style={{
          ...fullSize,
          mixBlendMode: "overlay",
          opacity: GRAIN_ALPHA,
        }}
      />

      {/* Draw passes. These render no DOM; their order is the frame pipeline. */}
      {sprites ? (
        <>
          <ShardField
            buffers={buffers}
            frame={frame}
            elements={shardElements}
            sprites={sprites.shards}
            axis={axis}
            corner={corner}
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
          <BloomPass sourceRef={fieldRef} targetRef={bloomRef} />
          <GrainLayer targetRef={grainRef} frame={frame} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
