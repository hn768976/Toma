/**
 * The displaced surface.
 *
 * Two scalar fields are defined over the ground plane: `height`, which lifts
 * each stroke sample in Y, and `sway`, which slides it sideways in X. Sway is
 * what combs the strokes into the S-curves that read as the texture; height is
 * what folds the band into crests. Where a crest turns edge-on to the camera
 * the depth-running lines pile their screen-space length into a narrow band and
 * that region reads dark — there is no shading model, the value is entirely
 * how tightly the strokes pack.
 *
 * Both fields are sums of travelling sinusoids
 *
 *     A * sin(k . p + 2*pi*omega*t + phase)
 *
 * with *integer* omega, which is the whole reason for using a spectral field
 * rather than sampled noise: at t = 1 every component has come back around to
 * exactly where it started, so frame 600 is bit-identical to frame 0 and the
 * loop is seamless by construction rather than by cross-fade.
 *
 * The components are baked into the shader source as literals (see shaders.ts)
 * so the GPU evaluates a straight-line unrolled expression per vertex.
 */

export type WaveComponent = {
  /** Wavelength in world units. */
  wavelength: number;
  /** Direction of travel, degrees from +X. 90 degrees travels into depth,
   *  which foreshortening makes far slower on screen than a lateral one. */
  angle: number;
  /** Amplitude in world units. */
  amplitude: number;
  /** Temporal frequency in cycles per loop. Must be an integer. */
  omega: number;
  /** Phase offset in turns. */
  phase: number;
};

/**
 * Height. The two longest components carry most of the amplitude and travel
 * mostly into depth, so the large-scale shape breathes rather than sweeps. The
 * lateral migration the eye actually tracks comes from the 21- and 10-unit
 * components: one wavelength per 20s loop, roughly a third of the width of the
 * band at the depth where it is most visible.
 */
export const HEIGHT_WAVES: WaveComponent[] = [
  { wavelength: 70, angle: 100, amplitude: 0.3, omega: 1, phase: 0.12 },
  { wavelength: 34, angle: 78, amplitude: 0.36, omega: -1, phase: 0.63 },
  { wavelength: 23, angle: 128, amplitude: 0.28, omega: 1, phase: 0.31 },
  { wavelength: 17, angle: 12, amplitude: 0.26, omega: -1, phase: 0.87 },
  { wavelength: 11, angle: 95, amplitude: 0.17, omega: 1, phase: 0.05 },
  { wavelength: 7.6, angle: 38, amplitude: 0.1, omega: 2, phase: 0.44 },
  { wavelength: 5.0, angle: 105, amplitude: 0.05, omega: -1, phase: 0.71 },
  { wavelength: 3.4, angle: 70, amplitude: 0.02, omega: 2, phase: 0.26 },
];

/**
 * Sideways sway. Deliberately short-wavelength and near-perpendicular to X:
 * a component travelling into depth varies with Z and barely with X, so
 * neighbouring lines sway *together* and stay parallel — a comb, not a tangle.
 * Amplitude is around two line spacings, which matches the reference.
 */
export const SWAY_WAVES: WaveComponent[] = [
  { wavelength: 11, angle: 75, amplitude: 0.055, omega: -1, phase: 0.19 },
  { wavelength: 4.2, angle: 92, amplitude: 0.05, omega: 1, phase: 0.58 },
  { wavelength: 2.6, angle: 84, amplitude: 0.027, omega: -1, phase: 0.9 },
  { wavelength: 1.7, angle: 98, amplitude: 0.013, omega: 1, phase: 0.37 },
];

/** Peak-to-peak height used to normalise the crest term in the shader. */
export const HEIGHT_AMPLITUDE = HEIGHT_WAVES.reduce(
  (sum, w) => sum + w.amplitude,
  0,
);

const TAU = Math.PI * 2;

/** Emits one component as a GLSL term: `A*sin(kx*p.x + kz*p.y + w*t + phi)`. */
export const componentToGlsl = (w: WaveComponent) => {
  const k = TAU / w.wavelength;
  const kx = k * Math.cos((w.angle * Math.PI) / 180);
  const kz = k * Math.sin((w.angle * Math.PI) / 180);
  const f = (n: number) => n.toFixed(6);
  return `${f(w.amplitude)} * sin(${f(kx)} * p.x + ${f(kz)} * p.y + ${f(
    w.omega * TAU,
  )} * t + ${f(w.phase * TAU)})`;
};

export const wavesToGlsl = (waves: WaveComponent[]) =>
  waves.map(componentToGlsl).join("\n    + ");
