import {useMemo, useRef} from 'react';
import {useCurrentFrame} from 'remotion';
import {FRAME_HEIGHT, FRAME_WIDTH, LOOP_FRAMES, type VariantConfig} from '../config';
import {bezierPoint, type Arc} from '../lib/arcs';
import {applyBloom, BLOOM_DIVISOR, createBuffer, useCanvasDraw} from '../lib/canvas';
import {arcStateAt, cameraDrift, travelGate} from '../lib/timing';
import {rgba, THEMES} from '../theme';

/** How quickly a travelling dot fades in and out at the ends of its path. */
const TRAVELLER_TAPER = 0.07;

/**
 * The arcs themselves plus the travelling dots that ride them. Both draw on to
 * one canvas which is then bloomed and screened over the map.
 */
export const ArcLayer: React.FC<{config: VariantConfig; arcs: Arc[]}> = ({
  config,
  arcs,
}) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const bloomBuffer = useMemo(
    () => createBuffer(FRAME_WIDTH / BLOOM_DIVISOR, FRAME_HEIGHT / BLOOM_DIVISOR),
    [],
  );

  useCanvasDraw(
    ref,
    (ctx) => {
      const drift = cameraDrift(frame);
      ctx.save();
      ctx.translate(drift.x, drift.y);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      for (const arc of arcs) {
        const state = arcStateAt(arc, frame);
        if (state.alpha <= 0.001) continue;

        // Draw-on is an SVG-style stroke dash: the dash array is the whole path
        // length and the offset walks back to zero.
        ctx.setLineDash([arc.length, arc.length]);
        ctx.lineDashOffset = arc.length * (1 - state.progress);

        ctx.beginPath();
        ctx.moveTo(arc.start.x, arc.start.y);
        ctx.quadraticCurveTo(arc.control.x, arc.control.y, arc.end.x, arc.end.y);

        // Soft halo, mid body, then the sharp core.
        ctx.lineWidth = arc.width * 5;
        ctx.strokeStyle = rgba(arc.color, state.alpha * 0.07);
        ctx.stroke();

        ctx.lineWidth = arc.width * 2.2;
        ctx.strokeStyle = rgba(arc.color, state.alpha * 0.16);
        ctx.stroke();

        ctx.lineWidth = arc.width;
        ctx.strokeStyle = rgba(arc.color, state.alpha * 0.8);
        ctx.stroke();
      }

      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;

      // Travelling dots ride only arcs that have finished drawing.
      for (const arc of arcs) {
        const state = arcStateAt(arc, frame);
        const gate = travelGate(arc, state);
        if (state.alpha <= 0.001 || gate <= 0) continue;

        for (const traveller of arc.travellers) {
          const u =
            (((frame % LOOP_FRAMES) / traveller.period + traveller.phase) % 1 + 1) % 1;
          const taper = Math.min(1, u / TRAVELLER_TAPER, (1 - u) / TRAVELLER_TAPER);
          const alpha = state.alpha * gate * Math.max(0, taper);
          if (alpha <= 0.002) continue;

          const point = bezierPoint(arc, u);
          const radius = config.travellerRadius * traveller.scale;
          const gradient = ctx.createRadialGradient(
            point.x,
            point.y,
            0,
            point.x,
            point.y,
            radius * 5,
          );
          gradient.addColorStop(0, rgba(THEMES.nodeWhite, alpha));
          gradient.addColorStop(0.2, rgba(arc.color, alpha * 0.55));
          gradient.addColorStop(1, rgba(arc.color, 0));
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius * 5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = rgba(THEMES.nodeWhite, alpha);
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      applyBloom(ctx, bloomBuffer, [
        {radius: 14, strength: 0.55},
        {radius: 52, strength: 0.3},
      ]);
    },
    [frame, arcs, config, bloomBuffer],
  );

  return (
    <canvas
      ref={ref}
      width={FRAME_WIDTH}
      height={FRAME_HEIGHT}
      style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}
    />
  );
};
