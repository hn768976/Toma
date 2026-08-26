import {useMemo, useRef} from 'react';
import {random, useCurrentFrame} from 'remotion';
import {FRAME_HEIGHT, FRAME_WIDTH, LOOP_FRAMES} from '../config';
import {createBuffer, useCanvasDraw} from '../lib/canvas';
import {rgba, THEMES, toRgb} from '../theme';

const GRAIN_TILE = 256;
const GRAIN_TILES = 8;
const GRAIN_ALPHA = 0.04;
const VIGNETTE_STRENGTH = 0.22;

/**
 * Vignette and grain, sitting above every other layer.
 *
 * The grain is a small set of seeded noise tiles built once and re-tiled at a
 * seeded offset chosen from `frame % 600`, so it is deterministic, cheap, and
 * identical at frame 0 and frame 600.
 */
export const FilmFinish: React.FC = () => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);

  const grainTiles = useMemo(() => {
    const neutral = toRgb(THEMES.grainNeutral);
    return Array.from({length: GRAIN_TILES}, (_, tile) => {
      const canvas = createBuffer(GRAIN_TILE, GRAIN_TILE);
      const ctx = canvas.getContext('2d');
      if (!ctx) return canvas;
      const image = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
      for (let i = 0; i < GRAIN_TILE * GRAIN_TILE; i++) {
        const noise = (random(`grain-${tile}-${i}`) - 0.5) * 190;
        image.data[i * 4] = Math.max(0, Math.min(255, neutral.r + noise));
        image.data[i * 4 + 1] = Math.max(0, Math.min(255, neutral.g + noise));
        image.data[i * 4 + 2] = Math.max(0, Math.min(255, neutral.b + noise));
        image.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
      return canvas;
    });
  }, []);

  useCanvasDraw(
    ref,
    (ctx) => {
      // Vignette.
      const cx = FRAME_WIDTH / 2;
      const cy = FRAME_HEIGHT / 2;
      const outer = Math.hypot(cx, cy);
      const vignette = ctx.createRadialGradient(cx, cy, outer * 0.34, cx, cy, outer);
      vignette.addColorStop(0, rgba(THEMES.shadow, 0));
      vignette.addColorStop(0.62, rgba(THEMES.shadow, VIGNETTE_STRENGTH * 0.3));
      vignette.addColorStop(1, rgba(THEMES.shadow, VIGNETTE_STRENGTH));
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);

      // Grain.
      const key = frame % LOOP_FRAMES;
      const tile = grainTiles[Math.floor(random(`grain-tile-${key}`) * GRAIN_TILES)];
      const pattern = ctx.createPattern(tile, 'repeat');
      if (!pattern) return;
      const ox = Math.floor(random(`grain-x-${key}`) * GRAIN_TILE);
      const oy = Math.floor(random(`grain-y-${key}`) * GRAIN_TILE);

      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = GRAIN_ALPHA;
      ctx.translate(-ox, -oy);
      ctx.fillStyle = pattern;
      ctx.fillRect(ox, oy, FRAME_WIDTH, FRAME_HEIGHT);
      ctx.restore();
    },
    [frame, grainTiles],
  );

  return (
    <canvas
      ref={ref}
      width={FRAME_WIDTH}
      height={FRAME_HEIGHT}
      style={{position: 'absolute', inset: 0}}
    />
  );
};
