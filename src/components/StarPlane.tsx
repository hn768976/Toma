import React, {useEffect, useMemo, useRef} from 'react';
import {random} from 'remotion';
import {HEIGHT, PLANE, WIDTH, toScreen} from '../geometry';
import {THEMES, withAlpha, type Variant} from '../theme';

/** Extra sprite margin so the camera drift never exposes an edge. */
const OVER = 320;
const SPRITE_W = WIDTH + OVER * 2;
const SPRITE_H = HEIGHT + OVER * 2;

const ROWS = 150;
const NEAR_Y = 1900;
const FAR_Y = -1900;
const X_MIN = -3400;
const X_MAX = 3400;
const BASE_DX = 33;

/**
 * The static half of the frame: background gradient, the soft glow behind the
 * node cluster, and the receding dot field.
 *
 * The dot field is rasterised ONCE into an offscreen canvas (useMemo) and then
 * blitted with the camera offset — no per-frame dot work.
 */
export const StarPlane: React.FC<{
  variant: Variant;
  camX: number;
  camY: number;
}> = ({variant, camX, camY}) => {
  const theme = THEMES[variant];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sprite = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = SPRITE_W;
    c.height = SPRITE_H;
    const ctx = c.getContext('2d');
    if (!ctx) return c;

    // Sprite-space origin: the frame centre, shifted by the overscan margin.
    const origin = {x: SPRITE_W / 2, y: SPRITE_H / 2};

    // Large soft glow sitting behind the node cluster.
    const glow = ctx.createRadialGradient(
      origin.x - 60,
      origin.y + 40,
      0,
      origin.x - 60,
      origin.y + 40,
      2100,
    );
    glow.addColorStop(0, withAlpha(theme.clusterGlow, 0.78));
    glow.addColorStop(0.45, withAlpha(theme.clusterGlow, 0.34));
    glow.addColorStop(1, withAlpha(theme.clusterGlow, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, SPRITE_W, SPRITE_H);

    // Receding dot grid: a regular lattice whose rows bunch toward the far
    // (upper-right) edge, brightest and densest at the near lower-left corner.
    for (let k = 0; k <= ROWS; k++) {
      const depth = Math.pow(1 - k / ROWS, 1.55); // 1 = near, 0 = far
      const y = FAR_Y + (NEAR_Y - FAR_Y) * depth;
      const near = Math.pow(1 - k / ROWS, 1.3);
      const dx = BASE_DX * (0.36 + 0.64 * near);

      let j = 0;
      for (let x = X_MIN; x <= X_MAX; x += dx, j++) {
        const lx = 1 - (x - X_MIN) / (X_MAX - X_MIN); // 1 at the left
        const jitter = 0.42 + 1.05 * random(`dot-${variant}-${k}-${j}`);
        const alpha = Math.min(
          0.95,
          0.74 * jitter * Math.pow(0.14 + 0.86 * near, 1.3) * (0.22 + 0.78 * lx),
        );
        if (alpha < 0.022) continue;

        const p = toScreen({x, y}, origin, PLANE);
        if (p.x < -8 || p.x > SPRITE_W + 8 || p.y < -8 || p.y > SPRITE_H + 8) continue;

        const r = 1.0 + 1.9 * near;
        ctx.beginPath();
        ctx.fillStyle = withAlpha(theme.dotPale, alpha);
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    return c;
  }, [variant, theme.clusterGlow, theme.dotPale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Cool grey-white upper-left falling to deep blue lower-right.
    const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    bg.addColorStop(0, theme.backgroundLight);
    bg.addColorStop(0.26, withAlpha(theme.backgroundDeep, 0.55));
    bg.addColorStop(0.62, withAlpha(theme.backgroundDeep, 0.95));
    bg.addColorStop(1, theme.backgroundDeep);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.drawImage(sprite, -OVER + camX, -OVER + camY);
  });

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      style={{position: 'absolute', inset: 0, width: WIDTH, height: HEIGHT}}
    />
  );
};
