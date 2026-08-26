import {useMemo, useRef} from 'react';
import {useCurrentFrame} from 'remotion';
import {FRAME_HEIGHT, FRAME_WIDTH, type VariantConfig} from '../config';
import {createBuffer, useCanvasDraw} from '../lib/canvas';
import type {DotMapData} from '../lib/dot-map';
import type {Projection} from '../lib/projection';
import {cameraDrift} from '../lib/timing';
import {mixRgba, THEMES} from '../theme';

/** Slack around the map so the camera drift never exposes a buffer edge. */
const BUFFER_PAD = 40;

/**
 * The land dots. The map itself never changes, so it is rasterised once into an
 * offscreen buffer and blitted every frame at the camera's drift offset.
 * Regenerating the dot set per frame is the expensive mistake here.
 */
export const DotMap: React.FC<{
  config: VariantConfig;
  projection: Projection;
  dotMap: DotMapData;
}> = ({config, projection, dotMap}) => {
  const frame = useCurrentFrame();

  const buffer = useMemo(() => {
    const originX = projection.originX - BUFFER_PAD;
    const originY = projection.originY - BUFFER_PAD;
    const canvas = createBuffer(
      projection.mapWidth + BUFFER_PAD * 2,
      projection.mapHeight + BUFFER_PAD * 2,
    );
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const radius = config.dotSize / 2;
      for (const dot of dotMap.dots) {
        ctx.beginPath();
        ctx.arc(dot.x - originX, dot.y - originY, radius, 0, Math.PI * 2);
        // Tone slides the dot between the dim edge colour and the pale land
        // colour, and takes a little opacity with it for extra texture.
        ctx.fillStyle = mixRgba(
          THEMES.dotDim,
          THEMES.dotPale,
          dot.tone,
          0.46 + 0.54 * dot.tone,
        );
        ctx.fill();
      }
    }
    return {canvas, originX, originY};
  }, [config.dotSize, dotMap, projection]);

  const ref = useRef<HTMLCanvasElement>(null);

  useCanvasDraw(
    ref,
    (ctx) => {
      const drift = cameraDrift(frame);
      ctx.drawImage(
        buffer.canvas,
        buffer.originX + drift.x,
        buffer.originY + drift.y,
      );
    },
    [frame, buffer],
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
