import React, { useLayoutEffect, useRef } from "react";
import type { FlakeSprite } from "./snow";

type Props = {
  sprite: FlakeSprite;
  /** Centre of the flake, in composition px. */
  x: number;
  y: number;
  rotation: number;
  opacity: number;
};

/**
 * One flake. The glyph itself was stroked into `sprite` once; all this does
 * per frame is blit that sprite through a rotation about its centre. The
 * sprite is square and the glyph fits inside its inscribed circle, so it
 * can never clip as it turns.
 */
export const Snowflake: React.FC<Props> = ({
  sprite,
  x,
  y,
  rotation,
  opacity,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const side = sprite.canvas.width;

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, side, side);
    ctx.globalAlpha = opacity;
    ctx.translate(sprite.half, sprite.half);
    ctx.rotate(rotation);
    ctx.drawImage(sprite.canvas, -sprite.half, -sprite.half);
  }, [sprite, rotation, opacity, side]);

  return (
    <canvas
      ref={canvasRef}
      width={side}
      height={side}
      style={{
        position: "absolute",
        left: x - sprite.half,
        top: y - sprite.half,
        width: side,
        height: side,
      }}
    />
  );
};
