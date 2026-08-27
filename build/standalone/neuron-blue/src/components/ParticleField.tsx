import React, {useEffect, useMemo, useRef} from 'react';
import type {Scene} from '../geometry';
import type {VariantConfig} from '../variants';
import {DUR, lsin, retractionProfile} from '../motion';
import {rgba} from '../color';

const SPRITE = 128;

const makeSprite = (color: string): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = SPRITE;
  c.height = SPRITE;
  const ctx = c.getContext('2d');
  if (ctx) {
    const h = SPRITE / 2;
    const g = ctx.createRadialGradient(h, h, 0, h, h, h);
    g.addColorStop(0, rgba(color, 1));
    g.addColorStop(0.35, rgba(color, 0.4));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SPRITE, SPRITE);
  }
  return c;
};

/**
 * Floating dots between and around the nodes. Sharp points and soft
 * near-camera discs; a cool family plus a clustered warm accent family.
 * All drift is on closed seeded paths whose periods divide 375.
 */
export const ParticleField: React.FC<{
  scene: Scene;
  cfg: VariantConfig;
  frame: number;
  width: number;
  height: number;
}> = ({scene, cfg, frame, width, height}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const {palette} = cfg;

  const sprites = useMemo(
    () => ({
      cool: makeSprite(palette.particleCool),
      warm: makeSprite(palette.particleWarm),
      white: makeSprite(palette.particleWhite),
    }),
    [palette]
  );

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';
    const t01 = frame / DUR;
    const hero = scene.nodes[0];
    const pull =
      cfg.motionMode === 'retract' && cfg.retract ? retractionProfile(frame, cfg.retract) : 0;

    for (const p of scene.particles) {
      let x = p.x + p.ax * lsin(t01, p.fx, p.phx);
      let y = p.y + p.ay * Math.cos(Math.PI * 2 * (p.fy * t01 + p.phy));
      if (p.inwardAmp > 0 && pull > 0) {
        // Drawn toward the node with the retraction, back out by frame 375
        const dx = hero.px - p.x;
        const dy = hero.py - p.y;
        const d = Math.hypot(dx, dy) || 1;
        x += (dx / d) * p.inwardAmp * pull;
        y += (dy / d) * p.inwardAmp * pull;
      }
      const alpha = p.alpha * (0.75 + 0.25 * lsin(t01, p.twFreq, p.twPhase));
      const sprite = sprites[p.family];
      if (p.soft) {
        const s = p.r * 4;
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s);
      } else {
        if (p.alpha > 0.55) {
          // Bloom on the brightest particles
          const s = p.r * 9;
          ctx.globalAlpha = alpha * 0.4;
          ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = rgba(
          p.family === 'warm'
            ? palette.particleWarm
            : p.family === 'white'
              ? palette.particleWhite
              : palette.particleCool,
          alpha
        );
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }, [scene, cfg, frame, width, height, sprites, palette]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%'}}
    />
  );
};
