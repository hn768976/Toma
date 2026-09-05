import { SIMPLEX_4D_GLSL } from "./simplex4d.glsl";
import { snoise4 } from "./simplex4d";

// ---------------------------------------------------------------------------
// The dune height field.
//
// Everything about this clip has to loop exactly at frame 450, including the
// forward camera drift, so the field is built to be *periodic in world space*
// rather than merely "animated slowly". Two ideas do the work:
//
//  1. Torus mapping. A 2D position is mapped onto a torus in 4D and fed to 4D
//     simplex noise. Walking one FIELD_PERIOD in x or z walks all the way
//     around a circle, so the field tiles exactly with period FIELD_PERIOD on
//     both axes -- no seams, no tapering, no blend region.
//
//  2. Time as advection. Because the field tiles, translating a layer by a
//     whole number of periods over the loop returns it to where it started.
//     Several layers sliding at different integer rates sum to a field that
//     genuinely *evolves* (crests migrate and reshape) yet is exactly periodic
//     in time. That is cheaper than spending two more noise dimensions on a
//     time circle, and it keeps the noise call count low enough for software
//     rasterisation.
//
// The same tiling is what lets particles wrap: a particle that falls off the
// near edge is pushed back one FIELD_PERIOD and lands on identical terrain.
// ---------------------------------------------------------------------------

/** Size of one field tile, in world units. Also the camera's travel per loop. */
export const FIELD_PERIOD = 11.0;

/** Peak height of the dunes above the mean plane, in world units. */
export const DUNE_AMPLITUDE = 0.82;

/**
 * Layers do not peak together, so the raw sum never reaches the sum of their
 * amplitudes. Dividing by this makes DUNE_AMPLITUDE mean what it says: with
 * it in place, a 300x300x30 sweep of the tile puts the field in -0.836..0.741,
 * which is what CAMERA_HEIGHT is set against.
 */
export const FIELD_PEAK_FACTOR = 0.63;

/**
 * The radii below were tuned against a 15-unit tile. Scaling them with
 * FIELD_PERIOD keeps dune size fixed in world units, so the tile can be
 * resized -- which trades particle density against visible repetition --
 * without redesigning the terrain.
 */
const RADIUS_REF_PERIOD = 15.0;
const RADIUS_SCALE = FIELD_PERIOD / RADIUS_REF_PERIOD;

export type DuneLayer = {
  /** Frequency multiplier. Must be an integer to keep the tile seamless. */
  readonly m: number;
  /** Torus radius on the x circle. Smaller = features stretched along x. */
  readonly rx: number;
  /** Torus radius on the z circle. Larger = more ridges per tile. */
  readonly rz: number;
  /**
   * Integer shear applied as `z += shear * x`. Unimodular, so it tilts the
   * ridges diagonally across frame without breaking the period lattice.
   */
  readonly shear: number;
  readonly amp: number;
  /** Whole tiles travelled per loop. Integers keep the loop closed. */
  readonly drift: readonly [number, number];
  /** Constant offset, purely to decorrelate layers from one another. */
  readonly phase: readonly [number, number];
};

// The first layer carries the ridges and is static: the skyline should feel
// geological, and the camera's own forward travel already supplies most of the
// large-scale change. The second is a broad swell drifting sideways, which
// raises and drops whole stretches of ridge as it passes -- that is what makes
// crests visibly reshape without anything appearing to "scroll". The last two
// are fine detail, drifting faster because at their scale it reads as texture.
export const DUNE_LAYERS: readonly DuneLayer[] = [
  {
    m: 1,
    rx: 0.3,
    rz: 0.95,
    shear: 1,
    amp: 1.0,
    drift: [0, 0],
    phase: [0.0, 0.0],
  },
  {
    m: 1,
    rx: 0.55,
    rz: 0.3,
    shear: 1,
    amp: 0.55,
    drift: [1, 0],
    phase: [0.37, 0.11],
  },
  {
    m: 3,
    rx: 0.7,
    rz: 0.9,
    shear: 1,
    amp: 0.085,
    drift: [-1, 1],
    phase: [0.71, 0.53],
  },
  {
    m: 9,
    rx: 1.5,
    rz: 1.7,
    shear: 0,
    amp: 0.02,
    drift: [2, -1],
    phase: [0.19, 0.83],
  },
];

const AMP_SUM = DUNE_LAYERS.reduce((a, l) => a + l.amp, 0);

const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/**
 * GLSL for `dunesHeight(vec2 world, float tPhase)`, generated from the layer
 * table above so the shader and the CPU mirror below can never drift apart.
 */
export const DUNE_FIELD_GLSL = /* glsl */ `
${SIMPLEX_4D_GLSL}

#define DUNES_TAU 6.283185307179586
#define DUNES_INV_PERIOD ${f(1 / FIELD_PERIOD)}
#define DUNES_AMPLITUDE ${f(DUNE_AMPLITUDE / (AMP_SUM * FIELD_PEAK_FACTOR))}

// Maps a tile-space position onto a torus in 4D. One unit of q.x or q.y is a
// full turn, which is what makes the resulting noise tile exactly.
vec4 dunesTorus(vec2 q, float rx, float rz) {
  float ax = DUNES_TAU * q.x;
  float az = DUNES_TAU * q.y;
  return vec4(rx * cos(ax), rx * sin(ax), rz * cos(az), rz * sin(az));
}

float dunesLayer(
  vec2 q, float m, float rx, float rz, float shear, vec2 drift, vec2 phase, float t
) {
  vec2 sheared = vec2(q.x, q.y + shear * q.x);
  return dunesSnoise(dunesTorus(sheared * m + drift * t + phase, rx, rz));
}

// world: XZ in world units. tPhase: loop position, 0..1.
float dunesHeight(vec2 world, float tPhase) {
  vec2 q = world * DUNES_INV_PERIOD;
  float h = 0.0;
${DUNE_LAYERS.map(
  (l) =>
    `  h += ${f(l.amp)} * dunesLayer(q, ${f(l.m)}, ${f(l.rx * RADIUS_SCALE)}, ${f(l.rz * RADIUS_SCALE)}, ` +
    `${f(l.shear)}, vec2(${f(l.drift[0])}, ${f(l.drift[1])}), ` +
    `vec2(${f(l.phase[0])}, ${f(l.phase[1])}), tPhase);`,
).join("\n")}
  return h * DUNES_AMPLITUDE;
}
`;

const TAU = Math.PI * 2;
const NORM = DUNE_AMPLITUDE / (AMP_SUM * FIELD_PEAK_FACTOR);

/**
 * CPU mirror of `dunesHeight`. Only used at module load, to displace the mesh
 * that particles are scattered over; the shader owns the per-frame version.
 */
export const duneHeight = (worldX: number, worldZ: number, tPhase: number) => {
  const qx = worldX / FIELD_PERIOD;
  const qy = worldZ / FIELD_PERIOD;
  let h = 0;
  for (const l of DUNE_LAYERS) {
    const shearedY = qy + l.shear * qx;
    const ux = qx * l.m + l.drift[0] * tPhase + l.phase[0];
    const uy = shearedY * l.m + l.drift[1] * tPhase + l.phase[1];
    const ax = TAU * ux;
    const az = TAU * uy;
    const rx = l.rx * RADIUS_SCALE;
    const rz = l.rz * RADIUS_SCALE;
    h +=
      l.amp *
      snoise4(
        rx * Math.cos(ax),
        rx * Math.sin(ax),
        rz * Math.cos(az),
        rz * Math.sin(az),
      );
  }
  return h * NORM;
};
