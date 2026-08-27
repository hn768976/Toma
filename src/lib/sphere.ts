import {rnd, rndRange} from './rng';
import {CANVAS_H, DESIGN_TO_CANVAS} from './space';

/**
 * The orb the cupped hands hold. Particles sit on a spherical shell that spins
 * about a screen-horizontal axis, so they travel in vertical circles. This is
 * plain 2D parametric maths drawn to the same canvas as everything else — no
 * 3D renderer involved — and projecting a shell rather than filling a disc is
 * what gives the rim its density: near the limb the surface runs edge-on to the
 * viewer and the projected particles pile up.
 */
export const SPHERE_COUNT = 860;

/** ~12% of frame height, floating in the gap just above the fingertips. */
export const SPHERE_RADIUS = CANVAS_H * 0.06;
const CENTRE_DESIGN_X = 960;
const CENTRE_DESIGN_Y = 516;

/** Whole turns per 480 frames, so the orbit closes exactly on the loop. */
export const SPHERE_TURNS = 2;
/** Divides 480. */
const PULSE_PERIOD = 160;

export type SphereField = {
  cx: number;
  cy: number;
  r: number;
  count: number;
  /** Polar angle from the spin axis; cos is uniform, giving a uniform shell. */
  cosPsi: Float32Array;
  sinPsi: Float32Array;
  /** Starting angle around the spin axis. */
  theta: Float32Array;
  radius: Float32Array;
  bright: Float32Array;
  /** 0 primary, 1 white, 2 accent. */
  colorIdx: Uint8Array;
};

export const buildSphere = (seedPrefix: string): SphereField => {
  const count = SPHERE_COUNT;
  const field: SphereField = {
    cx: CENTRE_DESIGN_X * DESIGN_TO_CANVAS,
    cy: CENTRE_DESIGN_Y * DESIGN_TO_CANVAS,
    r: SPHERE_RADIUS,
    count,
    cosPsi: new Float32Array(count),
    sinPsi: new Float32Array(count),
    theta: new Float32Array(count),
    radius: new Float32Array(count),
    bright: new Float32Array(count),
    colorIdx: new Uint8Array(count),
  };

  for (let i = 0; i < count; i++) {
    const s = `${seedPrefix}:orb${i}`;
    const c = rnd(`${s}:c`) * 2 - 1;
    field.cosPsi[i] = c;
    field.sinPsi[i] = Math.sqrt(Math.max(0, 1 - c * c));
    field.theta[i] = rnd(`${s}:t`) * Math.PI * 2;
    field.radius[i] = 2.4 + Math.pow(rnd(`${s}:r`), 1.8) * 3.6;
    const b = rnd(`${s}:b`);
    field.bright[i] = b < 0.14 ? rndRange(`${s}:bh`, 0.8, 1) : rndRange(`${s}:bl`, 0.3, 0.72);
    field.colorIdx[i] = b < 0.14 ? 2 : rnd(`${s}:cc`) < 0.78 ? 0 : 1;
  }
  return field;
};

/** Slow brightness pulse; period 160 divides 480. */
export const spherePulse = (frame: number): number =>
  0.82 + 0.28 * Math.sin((2 * Math.PI * frame) / PULSE_PERIOD);

/**
 * Screen position and signed depth for one orb particle. Depth drives
 * brightness and size so the near face of the shell reads in front of the far.
 */
export const spherePoint = (
  field: SphereField,
  i: number,
  frame: number,
): {x: number; y: number; depth: number} => {
  const a =
    field.theta[i] + (2 * Math.PI * SPHERE_TURNS * frame) / 480;
  return {
    x: field.cx + field.r * field.cosPsi[i],
    y: field.cy + field.r * field.sinPsi[i] * Math.cos(a),
    depth: field.sinPsi[i] * Math.sin(a),
  };
};
