import { makeRandom, range, spread, clamp, smoothstep } from './random';
import type { VersionConfig } from '../versions';

export type Bubble = {
  index: number;
  seed: number;
  radius: number;
  /** Non-uniform scale, so no two bubbles read as the same sphere. */
  squash: [number, number, number];
  home: [number, number, number];
  origin: [number, number, number];
  drift: [number, number, number];
  orbit: { radius: number; speed: number; phase: number; tilt: number };
  spin: [number, number, number];
  bornAt: number;
  layer: 'far' | 'mid' | 'near';
};

export type Layers = { far: Bubble[]; mid: Bubble[]; near: Bubble[] };

/**
 * Builds one composition's bubble population. Layer assignment is by depth so
 * the defocus passes stay physically sensible: things furthest from the focal
 * plane land in the blurred layers.
 */
export const buildField = (config: VersionConfig): Layers => {
  const { field } = config;
  const rnd = makeRandom(field.seed);
  const bubbles: Bubble[] = [];

  for (let i = 0; i < field.count; i++) {
    const t = field.count === 1 ? 0 : i / (field.count - 1);
    const radius = range(rnd, field.minRadius, field.maxRadius);

    let home: [number, number, number] = [
      spread(rnd, field.spreadX),
      spread(rnd, field.spreadY),
      spread(rnd, field.spreadZ),
    ];

    // `macroHero` needs one unmistakable subject rather than an even field:
    // the first bubble is oversized and parked near the focal plane, the rest
    // are pushed behind it to become bokeh.
    let heroScale = 1;
    if (field.motion === 'macroHero') {
      if (i === 0) {
        home = [spread(rnd, 0.6), spread(rnd, 0.4), 1.8];
        heroScale = field.heroRadius ? field.heroRadius / radius : 1.15;
      } else {
        home = [spread(rnd, field.spreadX), spread(rnd, field.spreadY), range(rnd, -field.spreadZ, -1.2)];
      }
    }

    if (field.motion === 'packed') {
      // Jittered lattice: keeps the frame evenly covered the way a tightly
      // packed macro shot is, without the clumping pure random gives.
      const cols = Math.ceil(Math.sqrt(field.count * 1.6));
      const rows = Math.ceil(field.count / cols);
      const cx = (i % cols) / Math.max(cols - 1, 1) - 0.5;
      const cy = Math.floor(i / cols) / Math.max(rows - 1, 1) - 0.5;
      home = [
        cx * field.spreadX * 2.1 + spread(rnd, field.spreadX * 0.22),
        cy * field.spreadY * 2.1 + spread(rnd, field.spreadY * 0.22),
        spread(rnd, field.spreadZ),
      ];
    }

    if (field.motion === 'cell') {
      const ring = Math.floor(i / 6);
      const a = (i % 6) / 6 * Math.PI * 2 + ring * 0.7;
      const rr = 1.6 + ring * 2.5;
      home = [Math.cos(a) * rr, Math.sin(a) * rr * 0.72, spread(rnd, field.spreadZ)];
    }

    // Entry position. `converge` and `fill` animate from here to `home`.
    let origin: [number, number, number] = [...home];
    if (field.motion === 'converge') {
      const a = rnd() * Math.PI * 2;
      const d = range(rnd, 2.5, 9.5);
      origin = [Math.cos(a) * d, Math.sin(a) * d * 0.62, spread(rnd, field.spreadZ * 1.6)];
    }
    if (field.motion === 'fill') {
      const a = rnd() * Math.PI * 2;
      const d = range(rnd, 13, 24);
      origin = [Math.cos(a) * d, Math.sin(a) * d * 0.72, home[2]];
    }
    if (field.motion === 'rise') {
      home = [home[0], spread(rnd, field.spreadY * 2.1), home[2]];
      origin = [...home];
    }

    bubbles.push({
      index: i,
      seed: rnd() * 100,
      radius: radius * heroScale,
      squash: [
        1 + spread(rnd, 0.13),
        1 + spread(rnd, 0.13),
        1 + spread(rnd, 0.1),
      ],
      home,
      origin,
      drift: [spread(rnd, 1), spread(rnd, 1), spread(rnd, 0.6)],
      orbit: {
        radius: range(rnd, 0.25, 1.5),
        speed: range(rnd, 0.1, 0.45),
        phase: rnd() * Math.PI * 2,
        tilt: rnd() * Math.PI,
      },
      spin: [spread(rnd, 0.35), spread(rnd, 0.35), spread(rnd, 0.35)],
      bornAt: field.motion === 'converge' || field.motion === 'fill' ? t * 0.45 : 0,
      layer: 'mid',
    });
  }

  // Depth-sort, then peel the extremes off into the defocused layers.
  const byDepth = [...bubbles].sort((a, b) => a.home[2] - b.home[2]);
  const farCount = Math.round(byDepth.length * field.farRatio);
  const nearCount = Math.round(byDepth.length * field.nearRatio);

  byDepth.forEach((b, i) => {
    if (i < farCount) b.layer = 'far';
    else if (i >= byDepth.length - nearCount) b.layer = 'near';
    else b.layer = 'mid';
  });

  return {
    far: bubbles.filter((b) => b.layer === 'far'),
    mid: bubbles.filter((b) => b.layer === 'mid'),
    near: bubbles.filter((b) => b.layer === 'near'),
  };
};

/**
 * Position of one bubble at normalised time `p` (0..1 across the clip).
 * `t` is seconds, used for motion whose rate should not depend on clip length.
 */
export const bubbleTransform = (
  b: Bubble,
  config: VersionConfig,
  t: number,
  p: number,
): { pos: [number, number, number]; rot: [number, number, number]; scale: number } => {
  const { field } = config;
  const s = field.driftSpeed;

  // Base drift shared by every archetype: slow, non-repeating sinusoidal sway.
  const sway: [number, number, number] = [
    Math.sin(t * s * 0.6 + b.orbit.phase) * b.orbit.radius * 0.5,
    Math.cos(t * s * 0.47 + b.orbit.phase * 1.3) * b.orbit.radius * 0.5,
    Math.sin(t * s * 0.33 + b.orbit.phase * 0.7) * b.orbit.radius * 0.3,
  ];

  let pos: [number, number, number];
  let scale = 1;

  switch (field.motion) {
    case 'converge': {
      // Gather, then breathe slightly so the cluster never looks frozen.
      const k = smoothstep(b.bornAt, b.bornAt + 0.55, p);
      const settle = smoothstep(0.55, 1.0, p);
      const breathe = 1 + Math.sin(t * 0.9 + b.orbit.phase) * 0.05 * settle;
      pos = [
        (b.origin[0] + (b.home[0] - b.origin[0]) * k) * breathe + sway[0] * settle,
        (b.origin[1] + (b.home[1] - b.origin[1]) * k) * breathe + sway[1] * settle,
        b.origin[2] + (b.home[2] - b.origin[2]) * k + sway[2] * settle,
      ];
      // Full size from frame one. `bornAt` staggers where a bubble travels
      // from, not whether it exists — scaling it in as well left every bubble
      // at zero size on the opening frame, so the clip started on a blank
      // plate and popped in.
      break;
    }
    case 'fill': {
      const k = smoothstep(b.bornAt, b.bornAt + 0.6, p);
      pos = [
        b.origin[0] + (b.home[0] - b.origin[0]) * k + sway[0],
        b.origin[1] + (b.home[1] - b.origin[1]) * k + sway[1],
        b.home[2] + sway[2],
      ];
      // Same as `converge`: these origins already sit outside the frame, so
      // the entrance reads without also animating scale.
      break;
    }
    case 'rise': {
      // Continuous upward travel with wrap-around, plus lateral wobble.
      const travel = field.spreadY * 4.2;
      const y = ((b.home[1] + t * s * 2.6 + field.spreadY * 2) % travel) - travel / 2;
      pos = [b.home[0] + sway[0], y + sway[1] * 0.4, b.home[2] + sway[2]];
      // Fade at the extremes so the wrap is never visible as a pop.
      scale = clamp(smoothstep(-travel / 2, -travel / 2 + 2.5, y)) *
              clamp(1 - smoothstep(travel / 2 - 2.5, travel / 2, y));
      break;
    }
    case 'swirl': {
      // Orbital churn around a tilted axis, as if stirred.
      const a = t * b.orbit.speed * s * 2.2 + b.orbit.phase;
      const r = b.orbit.radius * 2.2;
      const ct = Math.cos(b.orbit.tilt);
      const st = Math.sin(b.orbit.tilt);
      pos = [
        b.home[0] + Math.cos(a) * r,
        b.home[1] + Math.sin(a) * r * ct,
        b.home[2] + Math.sin(a) * r * st,
      ];
      break;
    }
    case 'macroHero': {
      // The hero barely moves; the backdrop bubbles drift more to sell scale.
      const amp = b.index === 0 ? 0.35 : 1;
      pos = [
        b.home[0] + sway[0] * amp,
        b.home[1] + sway[1] * amp,
        b.home[2] + sway[2] * amp,
      ];
      break;
    }
    case 'cell':
    case 'packed':
    case 'float':
    default: {
      pos = [b.home[0] + sway[0], b.home[1] + sway[1], b.home[2] + sway[2]];
      break;
    }
  }

  const rs = field.rotateSpeed;
  return {
    pos,
    rot: [b.spin[0] * t * rs * 6, b.spin[1] * t * rs * 6, b.spin[2] * t * rs * 6],
    scale,
  };
};
