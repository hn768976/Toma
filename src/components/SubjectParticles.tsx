import React, {useLayoutEffect} from 'react';
import {rgba} from '../lib/color'; // @only:sphere
import {respawnState, twinkle} from '../lib/particles';
import type {Scene} from '../lib/scene';
import {dotSprite, glowSprite} from '../lib/sprites';
import {spherePoint, spherePulse, type SphereField} from '../lib/sphere'; // @only:sphere
import {streamFade, streamPoint, type StreamField} from '../lib/streams'; // @only:stream
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

// @only:stream
/**
 * The "stream" branch: ribbons of particles emitted continuously from the
 * subject's trailing edge, each riding a cubic path out past the right frame
 * edge and fading as it goes. A behavioural branch, not a re-parameterised
 * shimmer.
 */
const drawStreams = (
  ctx: CanvasRenderingContext2D,
  streams: StreamField,
  palette: Palette,
  frame: number,
) => {
  const sprites = [dotSprite(palette.accent), dotSprite(palette.white)];
  const glow = glowSprite(palette.accent);
  const gate = presence(frame, 0.95);
  if (gate <= 0.002) return;

  for (let i = 0; i < streams.count; i++) {
    const t = (frame / streams.period[i] + streams.phase[i]) % 1;
    const s = streams.streams[streams.streamIdx[i]];
    const p = streamPoint(s, t);
    const off = streams.offset[i];
    const x = p.x + p.nx * off;
    const y = p.y + p.ny * off;
    const alpha = clamp(streamFade(t) * streams.bright[i] * gate, 0, 1);
    if (alpha <= 0.004) continue;
    const r = streams.radius[i];
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprites[streams.colorIdx[i]], x - r, y - r, r * 2, r * 2);
    if (streams.bright[i] > 0.82) {
      const gr = r * 6;
      ctx.globalAlpha = alpha * 0.24;
      ctx.drawImage(glow, x - gr, y - gr, gr * 2, gr * 2);
    }
  }
};

// @end

// @only:sphere
/**
 * The "sphere" branch: a hollow particle shell spinning about a horizontal axis
 * in the gap between the palms, pulsing on a slow sine.
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

    // @only:stream
    if (mode === 'stream' && scene.streams) {
      drawStreams(ctx, scene.streams, palette, frame);
    }
    // @end
    // @only:sphere
    if (mode === 'sphere' && scene.sphere) {
      drawSphere(ctx, scene.sphere, palette, frame);
    }
    // @end

    ctx.restore();
  }, [canvasRef, scene, palette, mode, transform, frame]);

  return null;
};
