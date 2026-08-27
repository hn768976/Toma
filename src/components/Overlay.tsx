import React, {useEffect, useMemo, useRef} from 'react';
import {DURATION, H, W} from '../lib/layout';
import {offscreen} from '../lib/chrome';
import {rnd} from '../lib/rand';

const TILE = 384;
const TILES = 8;

/**
 * Finish pass: vignette, scanlines and fine grain.
 *
 * The grain tiles are generated once with seeded noise; each frame picks a tile
 * and an offset from frame % 600, so the film grain moves but the loop closes.
 */
export const Overlay: React.FC<{frame: number}> = ({frame}) => {
  const ref = useRef<HTMLCanvasElement>(null);

  const statics = useMemo(() => {
    const c = offscreen(W, H);
    const ctx = c.getContext('2d')!;

    // scanlines every 5px at ~3%
    ctx.fillStyle = 'rgba(0,0,0,0.03)';
    for (let y = 0; y < H; y += 5) ctx.fillRect(0, y, W, 2);

    // ~20% vignette
    const g = ctx.createRadialGradient(
      W / 2,
      H / 2,
      Math.min(W, H) * 0.28,
      W / 2,
      H / 2,
      Math.max(W, H) * 0.72,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.62, 'rgba(0,0,0,0.06)');
    g.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return c;
  }, []);

  const grain = useMemo(() => {
    const out: HTMLCanvasElement[] = [];
    for (let t = 0; t < TILES; t++) {
      const c = offscreen(TILE, TILE);
      const ctx = c.getContext('2d')!;
      const img = ctx.createImageData(TILE, TILE);
      for (let i = 0; i < TILE * TILE; i++) {
        const v = rnd(`grain${t}:${i}`);
        const s = v > 0.86 ? Math.round((v - 0.86) * 1820) : 0;
        img.data[i * 4] = s;
        img.data[i * 4 + 1] = s;
        img.data[i * 4 + 2] = s;
        img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      out.push(c);
    }
    return out;
  }, []);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(statics, 0, 0);

    const f = frame % DURATION;
    const tile = grain[f % TILES];
    const pat = ctx.createPattern(tile, 'repeat')!;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.045;
    ctx.translate(
      -Math.floor(rnd(`gox:${f}`) * TILE),
      -Math.floor(rnd(`goy:${f}`) * TILE),
    );
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W + TILE, H + TILE);
    ctx.restore();
  }, [frame, statics, grain]);

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      style={{position: 'absolute', left: 0, top: 0, width: W, height: H}}
    />
  );
};
