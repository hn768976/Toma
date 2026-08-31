import React, { useLayoutEffect, useMemo, useRef } from "react";
import { HEIGHT, WIDTH } from "./layout";

const createCanvas = () => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  return canvas;
};

const fill: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: WIDTH,
  height: HEIGHT,
};

export type CanvasLayerProps = {
  /**
   * Called once per React render — never from requestAnimationFrame — with a
   * cleared 3840x2160 context.
   */
  draw: (ctx: CanvasRenderingContext2D) => void;
  /** Bloom radius in 4K pixels. Omit for a layer that should not bloom. */
  bloom?: number;
  bloomOpacity?: number;
  /** Drawn into the bloom pass only; used to bloom a subset of a layer. */
  drawBloom?: (ctx: CanvasRenderingContext2D) => void;
  opacity?: number;
};

/**
 * One stacked 4K canvas. When a bloom radius is given the content is drawn
 * once into an offscreen canvas and blitted into both a crisp copy and a
 * CSS-blurred copy screened over it, which is far cheaper than asking canvas
 * for a large shadowBlur on every stroke.
 */
export const CanvasLayer: React.FC<CanvasLayerProps> = ({
  draw,
  bloom,
  bloomOpacity = 0.85,
  drawBloom,
  opacity = 1,
}) => {
  const sharpRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);
  const offscreen = useMemo(createCanvas, []);
  const bloomOffscreen = useMemo(
    () => (drawBloom ? createCanvas() : null),
    [drawBloom],
  );

  useLayoutEffect(() => {
    const sharp = sharpRef.current;
    if (!sharp) return;
    const sharpCtx = sharp.getContext("2d");
    if (!sharpCtx) return;

    const glow = glowRef.current;
    const source = bloom && offscreen ? offscreen : sharp;
    const ctx = source === sharp ? sharpCtx : source.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.save();
    draw(ctx);
    ctx.restore();

    if (source !== sharp) {
      sharpCtx.clearRect(0, 0, WIDTH, HEIGHT);
      sharpCtx.drawImage(source, 0, 0);
    }

    if (glow) {
      const glowCtx = glow.getContext("2d");
      if (glowCtx) {
        glowCtx.clearRect(0, 0, WIDTH, HEIGHT);
        if (drawBloom && bloomOffscreen) {
          const bloomCtx = bloomOffscreen.getContext("2d");
          if (bloomCtx) {
            bloomCtx.clearRect(0, 0, WIDTH, HEIGHT);
            bloomCtx.save();
            drawBloom(bloomCtx);
            bloomCtx.restore();
            glowCtx.drawImage(bloomOffscreen, 0, 0);
          }
        } else {
          glowCtx.drawImage(source, 0, 0);
        }
      }
    }
  });

  return (
    <>
      <canvas ref={sharpRef} width={WIDTH} height={HEIGHT} style={{ ...fill, opacity }} />
      {bloom ? (
        <canvas
          ref={glowRef}
          width={WIDTH}
          height={HEIGHT}
          style={{
            ...fill,
            filter: `blur(${bloom}px)`,
            mixBlendMode: "screen",
            opacity: opacity * bloomOpacity,
          }}
        />
      ) : null}
    </>
  );
};
