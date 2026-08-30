import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {LOOP_FRAMES} from '../constants';
import {context2d} from '../lib/canvas';
import {hexToRgb, rgba} from '../lib/color';
import type {DotField} from '../lib/dots';
import {drift, regionActivity} from '../lib/motion';
import type {VariantConfig} from '../variants';

const quadraticPoint = (
  p0: number,
  c: number,
  p1: number,
  t: number,
): number => {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * c + t * t * p1;
};

/**
 * The links between regions that are lit at the same time: a thin arc bowing
 * upward with a bright dot running along it. The dots' own brightening is
 * handled in <DotGrid>; this layer is only what sits above them.
 */
export const HotspotLayer: React.FC<{
  field: DotField;
  config: VariantConfig;
}> = ({field, config}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  const centres = useMemo(
    () =>
      config.hotspot.regions.map((region) => {
        const point = field.projection([region.lon, region.lat]);
        return {x: point ? point[0] : 0, y: point ? point[1] : 0};
      }),
    [field, config],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = context2d(canvas);
    ctx.clearRect(0, 0, width, height);

    const {arcs} = config.hotspot;
    const link = hexToRgb(config.palette.link);
    const hot = hexToRgb(config.palette.hot);
    const {dx, dy} = drift(frame, config.drift.amplitude, LOOP_FRAMES);

    const activity = config.hotspot.regions.map((_unused, i) =>
      regionActivity(i, frame, config.hotspot, LOOP_FRAMES),
    );

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    for (let a = 0; a < centres.length; a++) {
      if (activity[a] <= 0) {
        continue;
      }
      for (let b = a + 1; b < centres.length; b++) {
        // An arc exists only while both of its endpoints are lit, so it fades
        // in with the second region and out with whichever decays first.
        const strength = Math.min(activity[a], activity[b]);
        if (strength <= 0) {
          continue;
        }

        const ax = centres[a].x + dx;
        const ay = centres[a].y + dy;
        const bx = centres[b].x + dx;
        const by = centres[b].y + dy;
        const distance = Math.hypot(bx - ax, by - ay);
        // Bow scales with distance — one curvature for every pair would put
        // absurd loops on the short hops.
        const bow = Math.min(
          arcs.maxBow,
          Math.max(arcs.minBow, distance * arcs.bowRatio),
        );
        const cx = (ax + bx) / 2;
        const cy = (ay + by) / 2 - bow;

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(cx, cy, bx, by);

        ctx.strokeStyle = rgba(link, strength * arcs.alpha * 0.28);
        ctx.lineWidth = arcs.width * 3.5;
        ctx.stroke();

        ctx.strokeStyle = rgba(link, strength * arcs.alpha);
        ctx.lineWidth = arcs.width;
        ctx.stroke();

        const t =
          ((frame / arcs.travellerFrames) % 1 + random(`arc-${a}-${b}`)) % 1;
        const tx = quadraticPoint(ax, cx, bx, t);
        const ty = quadraticPoint(ay, cy, by, t);

        const glow = ctx.createRadialGradient(
          tx,
          ty,
          0,
          tx,
          ty,
          arcs.travellerRadius * 4,
        );
        glow.addColorStop(0, rgba(hot, strength * 0.55));
        glow.addColorStop(1, rgba(hot, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(tx, ty, arcs.travellerRadius * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = rgba(hot, strength);
        ctx.beginPath();
        ctx.arc(tx, ty, arcs.travellerRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalCompositeOperation = 'source-over';
  }, [frame, width, height, config, centres]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
    />
  );
};
