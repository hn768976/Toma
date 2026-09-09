import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {cameraAt} from './camera';
import {
  DESIGN_H,
  DESIGN_W,
  DRIFT_X,
  DRIFT_Y,
  DURATION,
  HERO_SPRITE_RATIO,
  MIN_SPRITE_ENERGY_EXP,
  MIN_SPRITE_PX,
  POINT_SPRITE_RATIO,
} from './constants';
import type {Palette} from './palettes';
import {buildPlanes, respawnEnvelope, type Star} from './stars';
import {buildSprites} from './sprites';

const CULL_PAD = 80;

export const StarCanvas: React.FC<{palette: Palette; seed: number}> = ({
  palette,
  seed,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  const planes = useMemo(() => buildPlanes(palette, seed), [palette, seed]);
  const sprites = useMemo(() => buildSprites(palette), [palette]);

  // Layout effect, not effect: this runs synchronously during commit, so the
  // canvas is guaranteed to hold the right pixels before Remotion screenshots.
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Normalised against the fixed 600-frame loop, not the composition
    // length, so a longer composition simply repeats the same cycle.
    const t = (frame % DURATION) / DURATION;
    const {rollRad, zoom} = cameraAt(t);
    const s = (width / DESIGN_W) * zoom;
    const cos = Math.cos(rollRad);
    const sin = Math.sin(rollRad);
    const cx = DESIGN_W / 2;
    const cy = DESIGN_H / 2;
    // Rotate + scale about the design centre, mapped onto the output centre.
    ctx.setTransform(
      s * cos,
      s * sin,
      -s * sin,
      s * cos,
      width / 2 - s * (cos * cx - sin * cy),
      height / 2 - s * (sin * cx + cos * cy),
    );

    ctx.globalCompositeOperation = 'lighter';

    // Below this many design px a sprite would land on a sub-pixel of the
    // output. Clamp the size and pay the lost energy back in alpha so the 1080p
    // preview keeps the same apparent star density as the 4K master.
    const minDesign = MIN_SPRITE_PX / s;

    const drawStar = (star: Star, rate: number, hero: boolean) => {
      const u = (t + star.cycle) % 1;
      const x = star.x + DRIFT_X * rate * u;
      const y = star.y + DRIFT_Y * rate * u;
      if (x < -CULL_PAD || x > DESIGN_W + CULL_PAD) return;
      if (y < -CULL_PAD || y > DESIGN_H + CULL_PAD) return;

      const twinkle =
        1 -
        star.depth *
          (0.5 - 0.5 * Math.cos((Math.PI * 2 * frame) / star.period + star.phase));
      let alpha = star.alpha * twinkle * respawnEnvelope(u, hero);
      if (alpha <= 0.002) return;

      const ratio = hero ? HERO_SPRITE_RATIO * star.boost : POINT_SPRITE_RATIO;
      let d = star.core * ratio;
      if (d < minDesign) {
        alpha *= (d / minDesign) ** MIN_SPRITE_ENERGY_EXP;
        d = minDesign;
      }

      ctx.globalAlpha = Math.min(1, alpha);
      const sprite = hero ? sprites.heroes[star.tint] : sprites.points[star.tint];
      ctx.drawImage(sprite, x - d / 2, y - d / 2, d, d);
    };

    // Back to front, so the nearest plane's heroes sit on top.
    for (let i = planes.length - 1; i >= 0; i--) {
      const plane = planes[i];
      for (const star of plane.points) drawStar(star, plane.rate, false);
    }
    for (let i = planes.length - 1; i >= 0; i--) {
      const plane = planes[i];
      for (const star of plane.heroes) drawStar(star, plane.rate, true);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }, [frame, width, height, planes, sprites]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        mixBlendMode: 'screen',
      }}
    />
  );
};
