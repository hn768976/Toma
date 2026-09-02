import React, { useLayoutEffect, useMemo, useRef } from "react";
import { makeSprite } from "../canvas/canvas";

export type BloomCanvasProps = {
  width: number;
  height: number;
  /** Drawn once per React render into an offscreen buffer. */
  draw: (ctx: CanvasRenderingContext2D) => void;
  /** Blur radius of the glow layer, in px. */
  blurPx?: number;
  /** Opacity of the glow layer. Lower = more restrained bloom. */
  opacity?: number;
  blendMode?: React.CSSProperties["mixBlendMode"];
  /** Applied to both layers — position them with this. */
  style?: React.CSSProperties;
};

/**
 * Draws once, composites twice: a blurred copy screened underneath and a crisp
 * copy on top. That is the whole bloom.
 *
 * The two layers are the SAME pixels — the scene goes into one offscreen
 * buffer and is blitted to both canvases. Running the draw twice would double
 * the cost and let the copies drift apart.
 *
 * Note the glow layer's CSS blur renders slightly OUTSIDE the canvas box, so a
 * bright element near an edge haloes over whatever sits behind it. That is
 * usually what you want from bloom; wrap the component in a clipping container
 * if you need it contained.
 */
export const BloomCanvas: React.FC<BloomCanvasProps> = ({
  width,
  height,
  draw,
  blurPx = 26,
  opacity = 0.62,
  blendMode = "screen",
  style,
}) => {
  const buffer = useMemo(() => makeSprite(width, height, () => undefined), [width, height]);
  const glowRef = useRef<HTMLCanvasElement>(null);
  const sharpRef = useRef<HTMLCanvasElement>(null);

  // No dependency array: one draw per React render, i.e. one per frame.
  useLayoutEffect(() => {
    if (!buffer) return;
    const b = buffer.getContext("2d");
    if (!b) return;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalAlpha = 1;
    b.globalCompositeOperation = "source-over";
    b.clearRect(0, 0, width, height);
    draw(b);

    for (const r of [glowRef, sharpRef]) {
      const ctx = r.current?.getContext("2d");
      if (!ctx) continue;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(buffer, 0, 0);
    }
  });

  return (
    <>
      <canvas
        ref={glowRef}
        width={width}
        height={height}
        style={{ ...style, filter: `blur(${blurPx}px)`, mixBlendMode: blendMode, opacity }}
      />
      <canvas ref={sharpRef} width={width} height={height} style={style} />
    </>
  );
};
