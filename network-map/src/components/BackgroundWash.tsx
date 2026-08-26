import {useRef} from 'react';
import {useCurrentFrame} from 'remotion';
import {FRAME_HEIGHT, FRAME_WIDTH, LOOP_FRAMES} from '../config';
import {useCanvasDraw} from '../lib/canvas';
import type {Projection} from '../lib/projection';
import {rgba} from '../theme';

/**
 * The soft lighter wash behind the map. Gradients need no resolution, so this
 * layer is drawn small and stretched by CSS - it costs almost nothing per frame.
 */
const WASH_WIDTH = 960;
const WASH_HEIGHT = 540;

export const BackgroundWash: React.FC<{
  background: {deep: string; glow: string};
  projection: Projection | null;
}> = ({background, projection}) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);

  useCanvasDraw(
    ref,
    (ctx) => {
      const t = (2 * Math.PI * (frame % LOOP_FRAMES)) / LOOP_FRAMES;
      const sx = WASH_WIDTH / FRAME_WIDTH;
      const sy = WASH_HEIGHT / FRAME_HEIGHT;

      ctx.fillStyle = background.deep;
      ctx.fillRect(0, 0, WASH_WIDTH, WASH_HEIGHT);

      const centreX =
        (projection
          ? projection.originX + projection.mapWidth / 2
          : FRAME_WIDTH / 2) * sx;
      const centreY =
        (projection
          ? projection.originY + projection.mapHeight / 2
          : FRAME_HEIGHT / 2) * sy;

      // Two lobes on closed elliptical paths, one wide and one tighter, so the
      // wash breathes without ever reading as a moving object.
      const lobes = [
        {
          x: centreX + Math.cos(t) * 26 * sx * 4,
          y: centreY + Math.sin(t) * 18 * sy * 4,
          r: WASH_WIDTH * 0.58,
          a: 0.3,
        },
        {
          x: centreX + Math.cos(t + Math.PI * 0.7) * 40 * sx * 4,
          y: centreY + Math.sin(2 * t + 0.6) * 12 * sy * 4,
          r: WASH_WIDTH * 0.32,
          a: 0.16,
        },
      ];

      ctx.globalCompositeOperation = 'lighter';
      for (const lobe of lobes) {
        const gradient = ctx.createRadialGradient(
          lobe.x,
          lobe.y,
          0,
          lobe.x,
          lobe.y,
          lobe.r,
        );
        gradient.addColorStop(0, rgba(background.glow, lobe.a));
        gradient.addColorStop(0.55, rgba(background.glow, lobe.a * 0.34));
        gradient.addColorStop(1, rgba(background.glow, 0));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, WASH_WIDTH, WASH_HEIGHT);
      }
      ctx.globalCompositeOperation = 'source-over';
    },
    [frame, projection, background],
  );

  return (
    <canvas
      ref={ref}
      width={WASH_WIDTH}
      height={WASH_HEIGHT}
      style={{
        position: 'absolute',
        inset: 0,
        width: FRAME_WIDTH,
        height: FRAME_HEIGHT,
      }}
    />
  );
};
