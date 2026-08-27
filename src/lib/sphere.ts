import type {MaskField} from './mask';
import {rnd, rndRange} from './rng';
import {MASK_TO_CANVAS} from './space';

/**
 * The orbiting shell. Particles sit on a sphere that spins about a
 * screen-horizontal axis, so each one travels a vertical circle at a fixed x —
 * which is exactly the set of latitude rings the mask's compressed vertical
 * grid bands already draw. This is plain 2D parametric maths on the same canvas
 * as everything else, no 3D renderer involved, and projecting a shell rather
 * than filling a disc is what gives the rim its density: near the limb the
 * surface runs edge-on to the viewer and the projected particles pile up.
 *
 * Its centre and radius come from the silhouette mask rather than from
 * constants of their own, so the shell and the form it rides can never drift
 * apart.
 */
export const SPHERE_COUNT = 2800;

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

export const buildSphere = (field: MaskField, seedPrefix: string): SphereField => {
  const count = SPHERE_COUNT;
  const {x0, x1, y0, y1} = field.bbox;
  const sphere: SphereField = {
    cx: ((x0 + x1) / 2) * MASK_TO_CANVAS,
    cy: ((y0 + y1) / 2) * MASK_TO_CANVAS,
    r: ((x1 - x0) / 2) * MASK_TO_CANVAS,
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
    sphere.cosPsi[i] = c;
    sphere.sinPsi[i] = Math.sqrt(Math.max(0, 1 - c * c));
    sphere.theta[i] = rnd(`${s}:t`) * Math.PI * 2;
    sphere.radius[i] = 2.8 + Math.pow(rnd(`${s}:r`), 1.8) * 4.2;
    const b = rnd(`${s}:b`);
    sphere.bright[i] = b < 0.14 ? rndRange(`${s}:bh`, 0.8, 1) : rndRange(`${s}:bl`, 0.3, 0.72);
    sphere.colorIdx[i] = b < 0.14 ? 2 : rnd(`${s}:cc`) < 0.78 ? 0 : 1;
  }
  return sphere;
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
