import { BALL_COUNT } from "./constants";

/**
 * Metaball choreography.
 *
 * Every channel is a sum of sines whose frequencies are whole numbers of
 * cycles per loop. A signal built that way has the loop length as an exact
 * period, so frame 0 and frame `durationInFrames` are bit-identical and the
 * clip cuts back on itself invisibly — no cross-fade required.
 */

type Channel = {
  /** Value at rest. */
  base: number;
  /** [amplitude, cycles per loop, phase in turns] triples, summed. */
  waves: [amplitude: number, cycles: number, phase: number][];
};

type BallSpec = {
  x: Channel;
  y: Channel;
  z: Channel;
  radius: Channel;
};

const ch = (base: number, ...waves: Channel["waves"]): Channel => ({
  base,
  waves,
});

const TAU = Math.PI * 2;

const sample = (channel: Channel, t: number): number => {
  let value = channel.base;
  for (const [amplitude, cycles, phase] of channel.waves) {
    value += amplitude * Math.sin(TAU * (cycles * t + phase));
  }
  return value;
};

/**
 * The camera sits at the origin looking down -Z with a 35 degree vertical
 * field of view, so at a depth of d the frame is 0.315*d tall and 0.560*d
 * wide either side of centre. The layout below leans on that: the dominant
 * mass rides close to the lens on the right, and the satellites hang further
 * back near the middle, which is what gives the reference its scale contrast.
 */
const ballSpecs: BallSpec[] = [
  // --- The dominant mass -------------------------------------------------
  // Six of the eight balls belong to the mass on the right. They orbit each
  // other inside it, which keeps its silhouette changing all the way through
  // the loop while never breaking the composition the references hold: one
  // large body on the right, one or two free satellites, and nothing else.

  // 0 — core. Never leaves frame right; it only breathes and leans. The
  //     lobes around it are held high and low on purpose: together they must
  //     cover the full height of frame at every point in the loop, because
  //     the references never let the mass pull away from an edge.
  {
    x: ch(3.3, [0.25, 1, 0.0], [0.1, 2, 0.35]),
    y: ch(-0.28, [0.26, 1, 0.22], [0.1, 3, 0.6]),
    z: ch(-6.7, [0.4, 1, 0.55], [0.12, 2, 0.1]),
    radius: ch(2.45, [0.12, 1, 0.3], [0.05, 2, 0.75]),
  },
  // 1 — lower lobe. Swells below the core and sinks back.
  {
    x: ch(2.8, [0.42, 1, 0.62], [0.16, 2, 0.2]),
    y: ch(-2.95, [0.35, 1, 0.08], [0.14, 2, 0.5]),
    z: ch(-7.0, [0.5, 2, 0.3]),
    radius: ch(1.78, [0.2, 1, 0.66], [0.06, 3, 0.15]),
  },
  // 2 — upper lobe. Rises and falls, reshaping the top edge.
  {
    x: ch(3.2, [0.4, 1, 0.31], [0.12, 3, 0.8]),
    y: ch(2.2, [0.38, 1, 0.74], [0.15, 2, 0.05]),
    z: ch(-7.05, [0.55, 1, 0.12]),
    radius: ch(1.64, [0.2, 2, 0.4], [0.07, 1, 0.9]),
  },
  // 3 — the budding lobe. Reaches furthest left of the mass group, so this
  //     is usually the one a passing satellite fuses onto.
  {
    x: ch(1.32, [0.48, 1, 0.52], [0.18, 2, 0.15]),
    y: ch(-0.15, [0.95, 1, 0.08], [0.24, 3, 0.45]),
    z: ch(-7.4, [0.6, 1, 0.68]),
    radius: ch(1.38, [0.2, 1, 0.18], [0.07, 2, 0.6]),
  },
  // 4 — deep lobe, mostly behind the core; adds weight low in frame.
  {
    x: ch(3.45, [0.55, 2, 0.41], [0.18, 1, 0.9]),
    y: ch(-1.95, [0.5, 1, 0.66], [0.18, 3, 0.1]),
    z: ch(-6.3, [0.45, 1, 0.3]),
    radius: ch(1.5, [0.24, 1, 0.84], [0.08, 2, 0.25]),
  },
  // 5 — high lobe that buds clear of the mass around the middle of the loop
  //     and is drawn back in, which is where the long neck comes from.
  {
    x: ch(2.1, [1.5, 1, 0.46], [0.24, 2, 0.44]),
    y: ch(2.3, [0.5, 1, 0.3], [0.18, 2, 0.68]),
    z: ch(-7.6, [0.65, 1, 0.05]),
    radius: ch(1.0, [0.22, 1, 0.6], [0.06, 3, 0.4]),
  },

  // --- Free satellites ---------------------------------------------------
  // Two only, a half cycle apart, so one is arriving as the other leaves.
  // Both swing far enough left to clear frame and far enough right to fuse
  // into the mass, which is the whole arc the references play out.

  // 6 — the large satellite. Crosses the full width of frame once per loop.
  {
    x: ch(0.1, [2.3, 1, 0.06], [0.2, 2, 0.5]),
    y: ch(0.05, [0.95, 1, 0.37], [0.16, 2, 0.88]),
    z: ch(-8.0, [0.9, 1, 0.24]),
    radius: ch(0.94, [0.16, 1, 0.55], [0.05, 3, 0.3]),
  },
  // 7 — the small satellite, on the opposite beat and further back.
  {
    x: ch(-0.5, [2.6, 1, 0.56], [0.22, 3, 0.35]),
    y: ch(0.5, [0.8, 1, 0.8], [0.16, 2, 0.2]),
    z: ch(-9.0, [1.0, 1, 0.7]),
    radius: ch(0.72, [0.14, 1, 0.42], [0.05, 2, 0.9]),
  },
];

if (ballSpecs.length !== BALL_COUNT) {
  throw new Error(
    `motion.ts defines ${ballSpecs.length} balls but BALL_COUNT is ${BALL_COUNT}`,
  );
}

export type BallField = {
  /** Flat [x, y, z] triples, ready to hand to a vec3 uniform array. */
  positions: Float32Array;
  /** One radius per ball. */
  radii: Float32Array;
};

export const createBallField = (): BallField => ({
  positions: new Float32Array(BALL_COUNT * 3),
  radii: new Float32Array(BALL_COUNT),
});

/**
 * Fills `field` with the ball layout at loop position `t`, where t is the
 * fraction of the loop elapsed. Values outside [0, 1) are fine — the motion
 * is periodic, so t and t+1 give the same result.
 */
export const sampleBallField = (field: BallField, t: number): BallField => {
  for (let i = 0; i < BALL_COUNT; i++) {
    const spec = ballSpecs[i];
    field.positions[i * 3 + 0] = sample(spec.x, t);
    field.positions[i * 3 + 1] = sample(spec.y, t);
    field.positions[i * 3 + 2] = sample(spec.z, t);
    field.radii[i] = sample(spec.radius, t);
  }
  return field;
};

/**
 * A slow periodic push/pull on the camera. Keeps the frame from feeling
 * locked off without ever breaking the loop.
 */
export const sampleCameraZ = (t: number): number =>
  0.32 * Math.sin(TAU * t) + 0.08 * Math.sin(TAU * (2 * t + 0.3));

/** Matching sideways sway, a quarter cycle out of step with the dolly. */
export const sampleCameraX = (t: number): number =>
  0.18 * Math.sin(TAU * (t + 0.25));
