import React, { useLayoutEffect, useMemo, useRef } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  ASPECT,
  Field,
  FieldOptions,
  MotionOptions,
  TAN_HALF_FOV_Y,
  generateField,
  positionsAt,
} from "./engine/field";
import { BlobRenderer, Look, samplePalette } from "./engine/renderer";

export type CoralBlobsProps = {
  field: FieldOptions;
  motion: MotionOptions;
  look: Look;
};

// Field generation takes ~1s, so keep one per seed/shape for the lifetime
// of the render tab instead of rebuilding it every frame.
const fieldCache = new Map<string, Field>();
const getField = (opts: FieldOptions, sweep: [number, number, number]) => {
  const key = JSON.stringify([opts, sweep]);
  let f = fieldCache.get(key);
  if (!f) {
    f = generateField(opts, sweep);
    fieldCache.set(key, f);
  }
  return f;
};

export const CoralBlobs: React.FC<CoralBlobsProps> = ({ field: fieldOpts, motion, look }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BlobRenderer | null>(null);

  const duration = durationInFrames / fps;
  const field = useMemo(
    () =>
      getField(fieldOpts, [
        motion.drift[0] * duration,
        motion.drift[1] * duration,
        motion.drift[2] * duration,
      ]),
    [fieldOpts, motion.drift, duration],
  );

  // Per-particle base colour: palette position x baked blob-scale light.
  const colors = useMemo(() => {
    const c = new Float32Array(field.count * 3);
    for (let i = 0; i < field.count; i++) {
      // Shadowed particles shift toward the deeper palette tones (keeps them
      // saturated) and are only mildly darkened.
      const l = field.light[i];
      const rgb = samplePalette(look.palette, field.tone[i] + (l - 0.9) * 1.5);
      const m = 0.9 + 0.1 * l;
      c[i * 3] = Math.min(1, (rgb[0] / 255) * m);
      c[i * 3 + 1] = Math.min(1, (rgb[1] / 255) * m);
      c[i * 3 + 2] = Math.min(1, (rgb[2] / 255) * m);
    }
    return c;
  }, [field, look.palette]);

  const scratch = useMemo(
    () => ({
      pos: new Float32Array(field.count * 3),
      keys: new Float64Array(field.count),
      instances: new Float32Array(field.count * 8),
    }),
    [field],
  );

  useLayoutEffect(() => {
    const handle = delayRender(`Drawing frame ${frame}`);
    const canvas = canvasRef.current!;
    if (!rendererRef.current) rendererRef.current = new BlobRenderer(canvas);

    const t = frame / fps;
    const progress = frame / Math.max(1, durationInFrames - 1);
    positionsAt(field, t, progress, motion, scratch.pos);

    // Cull to a slightly enlarged frustum, then sort far -> near so the
    // alpha-blended (depth-of-field) spheres composite correctly.
    const { pos, keys, instances } = scratch;
    const tx = TAN_HALF_FOV_Y * ASPECT * 1.08;
    const ty = TAN_HALF_FOV_Y * 1.12;
    let n = 0;
    for (let i = 0; i < field.count; i++) {
      const z = pos[i * 3 + 2];
      if (z < 0.9 || z > 30) continue;
      if (Math.abs(pos[i * 3]) > z * tx + 0.3 || Math.abs(pos[i * 3 + 1]) > z * ty + 0.3) continue;
      const zq = Math.floor((30 - z) * 30000);
      keys[n++] = zq * 2097152 + i;
    }
    const sorted = keys.subarray(0, n).sort();
    for (let k = 0; k < n; k++) {
      const i = sorted[k] % 2097152;
      const o = k * 8;
      instances[o] = pos[i * 3];
      instances[o + 1] = pos[i * 3 + 1];
      instances[o + 2] = pos[i * 3 + 2];
      instances[o + 3] = field.radius[i];
      instances[o + 4] = colors[i * 3];
      instances[o + 5] = colors[i * 3 + 1];
      instances[o + 6] = colors[i * 3 + 2];
      instances[o + 7] = 1;
    }
    rendererRef.current.draw(instances, n, look);
    continueRender(handle);
  }, [frame, fps, durationInFrames, field, colors, scratch, motion, look]);

  return (
    <AbsoluteFill>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
