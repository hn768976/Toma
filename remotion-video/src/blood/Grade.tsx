import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { mulberry32 } from "./rng";
import type { GradeSpec } from "./looks";

const TILE = 128;

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Film grain.
 *
 * Painted once per browser tab into a canvas one tile larger than the frame,
 * then merely translated each frame. That avoids background-image (which
 * decodes asynchronously and can flicker mid-render), avoids repainting 8.3M
 * pixels per 4K frame, and — being seeded — stays identical across the several
 * tabs Remotion renders a composition on in parallel.
 */
const Grain: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const tile = document.createElement("canvas");
    tile.width = TILE;
    tile.height = TILE;
    const tileCtx = tile.getContext("2d") as CanvasRenderingContext2D;
    const image = tileCtx.createImageData(TILE, TILE);
    const rng = mulberry32(0x6a1a5);
    for (let i = 0; i < image.data.length; i += 4) {
      const value = 110 + rng() * 90;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
    tileCtx.putImageData(image, 0, 0);

    const pattern = ctx.createPattern(tile, "repeat");
    if (!pattern) {
      return;
    }
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [width, height]);

  // A fresh sub-tile offset every frame turns static grain into moving grain.
  const jitter = mulberry32(frame + 1);
  const x = Math.round(jitter() * TILE);
  const y = Math.round(jitter() * TILE);

  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: "overlay", pointerEvents: "none", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        width={width + TILE}
        height={height + TILE}
        style={{ position: "absolute", left: 0, top: 0, transform: `translate(${-x}px, ${-y}px)` }}
      />
    </AbsoluteFill>
  );
};

/**
 * The finishing pass, done in the DOM rather than as a three.js post-processing
 * chain.
 *
 * An EffectComposer bloom would cost several extra full-resolution passes per
 * frame, which at 4K is the difference between a render that finishes and one
 * that doesn't — and these are broad, soft, screen-space effects that composite
 * identically over the canvas.
 */
export const Grade: React.FC<{ spec: GradeSpec }> = ({ spec }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // The references cut straight in and out, so both fades default to 0 — in
  // which case there is no ramp to interpolate at all.
  const fadeIn = spec.fadeIn > 0 ? interpolate(frame, [0, spec.fadeIn], [0, 1], CLAMP) : 1;
  const fadeOut =
    spec.fadeOut > 0
      ? interpolate(frame, [durationInFrames - spec.fadeOut, durationInFrames - 1], [1, 0], CLAMP)
      : 1;
  const fade = Math.min(fadeIn, fadeOut);

  return (
    <>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${spec.bloom.x}% ${spec.bloom.y}%, ${spec.bloom.color} 0%, rgba(0,0,0,0) ${spec.bloom.size * 0.62}%)`,
          opacity: spec.bloom.opacity,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundColor: spec.tint.color,
          opacity: spec.tint.opacity,
          mixBlendMode: spec.tint.blend,
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 72% 72% at 50% 50%, rgba(0,0,0,0) ${spec.vignette.start}%, ${spec.vignette.color} 100%)`,
          opacity: spec.vignette.opacity,
          pointerEvents: "none",
        }}
      />
      {spec.grain > 0 ? <Grain opacity={spec.grain} /> : null}
      {fade < 1 ? (
        <AbsoluteFill style={{ backgroundColor: "#000000", opacity: 1 - fade, pointerEvents: "none" }} />
      ) : null}
    </>
  );
};
