import {useMemo, useRef} from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {FRAME_HEIGHT, FRAME_WIDTH, type VariantConfig} from '../config';
import type {Arc, Point} from '../lib/arcs';
import {applyBloom, BLOOM_DIVISOR, createBuffer, useCanvasDraw} from '../lib/canvas';
import {arcStateAt, cameraDrift} from '../lib/timing';
import {rgba, THEMES} from '../theme';

/** Frames a single ring takes to expand and fade. */
const PULSE_FRAMES = 15;

type Pulse = {at: Point; age: number};

/**
 * A bright ring expands and fades at an arc's endpoint: once at the origin as
 * the arc starts drawing, and once at the destination as it completes.
 * Opacity is zero at both ends of a pulse's life, which is what lets the
 * pulses sit inside a seamless loop.
 */
export const NodePulse: React.FC<{config: VariantConfig; arcs: Arc[]}> = ({
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

      const pulses: Pulse[] = [];
      for (const arc of arcs) {
        const {local} = arcStateAt(arc, frame);
        if (local < PULSE_FRAMES) {
          pulses.push({at: arc.start, age: local});
        }
        const sinceComplete = local - arc.drawFrames;
        if (sinceComplete >= 0 && sinceComplete < PULSE_FRAMES) {
          pulses.push({at: arc.end, age: sinceComplete});
        }
      }

      for (const pulse of pulses) {
        const p = pulse.age / PULSE_FRAMES;
        // sin() rather than a linear ramp so opacity is zero at both p=0 and
        // p=1 - a ring that started at full opacity would tear the loop.
        const alpha = Math.sin(Math.PI * p);
        if (alpha <= 0.002) continue;

        const radius = interpolate(p, [0, 1], [config.pulseRadius * 0.14, config.pulseRadius], {
          easing: Easing.out(Easing.cubic),
        });

        ctx.lineWidth = Math.max(1.5, config.pulseRadius * 0.075 * (1 - p * 0.55));
        ctx.strokeStyle = rgba(THEMES.nodeWhite, alpha * 0.75);
        ctx.beginPath();
        ctx.arc(pulse.at.x, pulse.at.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        const core = config.pulseRadius * 0.1;
        const gradient = ctx.createRadialGradient(
          pulse.at.x,
          pulse.at.y,
          0,
          pulse.at.x,
          pulse.at.y,
          core * 4,
        );
        gradient.addColorStop(0, rgba(THEMES.nodeWhite, alpha * 0.9));
        gradient.addColorStop(1, rgba(THEMES.nodeWhite, 0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(pulse.at.x, pulse.at.y, core * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      applyBloom(ctx, bloomBuffer, [
        {radius: 18, strength: 0.6},
        {radius: 60, strength: 0.28},
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
