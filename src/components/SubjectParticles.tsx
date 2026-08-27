import React, {useLayoutEffect} from 'react';
import {rgba} from '../lib/color'; // @only:sphere
import {respawnState, twinkle} from '../lib/particles';
import type {Scene} from '../lib/scene';
import {dotSprite, glowSprite} from '../lib/sprites';
import {spherePoint, spherePulse, type SphereField} from '../lib/sphere'; // @only:sphere
import {clamp, mix} from '../lib/space';
import {presence, useLoopFrame} from '../lib/timing';
import type {Palette, SubjectMode} from '../variants';

type Props = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  scene: Scene;
  palette: Palette;
  mode: SubjectMode;
  transform: {scale: number; cx: number; cy: number};
};

/** Particles at or above this brightness get a bloom pass. */
const BLOOM_THRESHOLD = 0.72;

// @only:sphere
/**
 * The "sphere" branch: a hollow particle shell spinning about a horizontal
 * axis, pulsing on a slow sine, riding the latitude bands the mask's grid
 * already draws.
 */
const drawSphere = (
  ctx: CanvasRenderingContext2D,
  sphere: SphereField,
  palette: Palette,
  frame: number,
) => {
  const sprites = [
    dotSprite(palette.primary),
    dotSprite(palette.white),
    dotSprite(palette.accent),
  ];
  const glow = glowSprite(palette.accent);
  const gate = presence(frame, 0.85);
  if (gate <= 0.002) return;
  const pulse = spherePulse(frame);

  for (let i = 0; i < sphere.count; i++) {
    const p = spherePoint(sphere, i, frame);
    // Near face brighter and slightly larger than the far face.
    const depth = 0.22 + 0.78 * (p.depth * 0.5 + 0.5);
    const alpha = clamp(sphere.bright[i] * depth * pulse * gate, 0, 1);
    if (alpha <= 0.004) continue;
    const r = sphere.radius[i] * (0.66 + 0.5 * depth);
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprites[sphere.colorIdx[i]], p.x - r, p.y - r, r * 2, r * 2);
    if (sphere.bright[i] > 0.8 && p.depth > 0) {
      const gr = r * 7;
      ctx.globalAlpha = alpha * 0.22;
      ctx.drawImage(glow, p.x - gr, p.y - gr, gr * 2, gr * 2);
    }
  }

  // A soft core so the shell reads as containing something.
  const halo = ctx.createRadialGradient(
    sphere.cx,
    sphere.cy,
    0,
    sphere.cx,
    sphere.cy,
    sphere.r * 1.9,
  );
  halo.addColorStop(0, rgba(palette.accent, 0.07 * pulse * gate));
  halo.addColorStop(0.42, rgba(palette.primary, 0.035 * pulse * gate));
  halo.addColorStop(1, rgba(palette.primary, 0));
  ctx.globalAlpha = 1;
  ctx.fillStyle = halo;
  ctx.fillRect(
    sphere.cx - sphere.r * 2,
    sphere.cy - sphere.r * 2,
    sphere.r * 4,
    sphere.r * 4,
  );
};

// @end

export const SubjectParticles: React.FC<Props> = ({
  canvasRef,
  scene,
  palette,
  mode,
  transform,
}) => {
  const frame = useLoopFrame();

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sprites = [
      dotSprite(palette.primary),
      dotSprite(palette.white),
      dotSprite(palette.secondary),
    ];
    const glows = [
      glowSprite(palette.primary),
      glowSprite(palette.white),
      glowSprite(palette.secondary),
    ];

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(transform.cx, transform.cy);
    ctx.scale(transform.scale, transform.scale);
    ctx.translate(-transform.cx, -transform.cy);
    ctx.globalCompositeOperation = 'lighter';

    const particles = scene.particles;
    const n = particles.count;
    // Bloom is collected during the main pass and drawn afterwards so the
    // glow always sits over the discs rather than under half of them.
    const bloomX: number[] = [];
    const bloomY: number[] = [];
    const bloomR: number[] = [];
    const bloomA: number[] = [];
    const bloomC: number[] = [];

    for (let i = 0; i < n; i++) {
      const env = presence(frame, particles.delay[i]);
      if (env <= 0.002) continue;

      const rs = respawnState(particles, i, frame);
      if (rs.alpha <= 0.002) continue;

      const x = mix(particles.sx[i], rs.x, env);
      const y = mix(particles.sy[i], rs.y, env);
      const tw = twinkle(frame, particles.twinklePeriod[i], particles.twinklePhase[i]);
      const alpha = clamp(
        particles.bright[i] * tw * Math.pow(env, 0.55) * rs.alpha,
        0,
        1,
      );
      if (alpha <= 0.004) continue;

      const r = particles.radius[i];
      const c = particles.colorIdx[i];
      ctx.globalAlpha = alpha * 0.92;
      ctx.drawImage(sprites[c], x - r, y - r, r * 2, r * 2);

      if (particles.bright[i] >= BLOOM_THRESHOLD) {
        bloomX.push(x);
        bloomY.push(y);
        bloomR.push(r * 5.5);
        bloomA.push(alpha * 0.3);
        bloomC.push(c);
      }
    }

    for (let i = 0; i < bloomX.length; i++) {
      const r = bloomR[i];
      ctx.globalAlpha = bloomA[i];
      ctx.drawImage(glows[bloomC[i]], bloomX[i] - r, bloomY[i] - r, r * 2, r * 2);
    }

    // @only:sphere
    if (mode === 'sphere' && scene.sphere) {
      drawSphere(ctx, scene.sphere, palette, frame);
    }
    // @end

    ctx.restore();
  }, [canvasRef, scene, palette, mode, transform, frame]);

  return null;
};
