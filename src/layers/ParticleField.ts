import { random } from 'remotion';
import { CONFIG, FPS, type Depth } from '../config';
import { alpha, PLANE } from '../plane';
import type { Scene } from '../scene';
import type { VariantId } from '../variants';

type Particle = {
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  tone: 'cyan' | 'white' | 'amber';
  depth: Depth;
  flashPhase: number;
  flashEvery: number;
};

/**
 * ParticleField — slow drift across the plane.
 *
 * Positions are pure functions of the frame with wraparound inside the plane
 * rectangle, so nothing accumulates and nothing has to be simulated. Amber is
 * the accent: roughly a fifth of the field, and clustered into a couple of
 * columns rather than spread evenly.
 */
export const buildParticles = (id: VariantId): Particle[] => {
  const n = CONFIG.particleCount;
  const amberClusters = [0.63, 0.79, 0.9];
  return Array.from({ length: n }, (_, i) => {
    const s = `p-${id}-${i}`;
    const isAmber = random(`${s}-tone`) < CONFIG.particleAmberShare;
    const rightBias = random(`${s}-bias`);
    // Two thirds of the field lives in vertical drifts on the right.
    let nx: number;
    if (isAmber) {
      const cl = amberClusters[Math.floor(random(`${s}-cl`) * amberClusters.length)];
      nx = cl + (random(`${s}-clx`) - 0.5) * 0.075;
    } else if (rightBias > 0.32) {
      nx = 0.55 + random(`${s}-x`) * 0.5;
    } else {
      nx = random(`${s}-x`) * 0.55;
    }
    const tone: Particle['tone'] = isAmber
      ? 'amber'
      : random(`${s}-w`) > 0.55
        ? 'white'
        : 'cyan';
    const depth: Depth =
      random(`${s}-d`) > 0.72 ? 'sharp' : random(`${s}-d2`) > 0.45 ? 'mid' : 'far';
    return {
      x0: PLANE.x + nx * PLANE.w,
      y0: PLANE.y + random(`${s}-y`) * PLANE.h,
      // Mostly downward drift with a slight lateral lean, as if falling on the plane.
      vx: (random(`${s}-vx`) - 0.35) * 0.5,
      vy: 0.55 + random(`${s}-vy`) * 1.1,
      size: 6 + random(`${s}-s`) * 16,
      opacity: 0.42 + random(`${s}-o`) * 0.56,
      tone,
      depth,
      flashPhase: random(`${s}-fp`),
      flashEvery: FPS / CONFIG.particleFlashesPerSecond,
    };
  });
};

const wrap = (v: number, lo: number, span: number) => {
  const t = (v - lo) % span;
  return lo + (t < 0 ? t + span : t);
};

export const drawParticleField = (
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  particles: Particle[],
  depth: Depth
) => {
  const p = scene.v.palette;
  const f = scene.frame;
  for (let i = 0; i < particles.length; i++) {
    const q = particles[i];
    if (q.depth !== depth) continue;
    const x = wrap(q.x0 + q.vx * f * CONFIG.particleDriftPerFrame, PLANE.x, PLANE.w);
    const y = wrap(q.y0 + q.vy * f * CONFIG.particleDriftPerFrame, PLANE.y, PLANE.h);

    // Seeded flashes: a handful of dots brighten for 3–4 frames at a time.
    const cyc = f / q.flashEvery + q.flashPhase * 40;
    const phase = cyc - Math.floor(cyc);
    const flashing = phase < 4 / q.flashEvery && random(`fl-${scene.id}-${i}-${Math.floor(cyc)}`) > 0.55;
    const boost = flashing ? 2.4 : 1;

    const color = q.tone === 'amber' ? p.accentAmber : q.tone === 'white' ? p.labelWhite : p.curveCyan;
    ctx.fillStyle = alpha(color, Math.min(1, q.opacity * boost));
    if (flashing) {
      ctx.shadowColor = alpha(color, 0.9);
      ctx.shadowBlur = 26;
    }
    const s = q.size * (flashing ? 1.35 : 1);
    // Squares for amber, dots for the rest — matches the marker language of the grid.
    if (q.tone === 'amber') ctx.fillRect(x - s / 2, y - s / 2, s, s);
    else {
      ctx.beginPath();
      ctx.arc(x, y, s / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
};
