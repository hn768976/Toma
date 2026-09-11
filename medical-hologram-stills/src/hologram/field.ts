// The background field, fitted to the reference stills.
//
// The reference field was sampled on a 1500x844 grid (8 x-positions by 7
// y-positions, taking the 30th percentile of a 21x21 window so the hex mesh
// and the stock watermark don't skew the reading) and fitted with the layer
// stack below, which maps 1:1 onto SVG gradients composited with
// mix-blend-mode: screen. RMS error of the fit is 3.4/255 per channel.
//
//   result = base ramp (pure blue, horizontal)
//            screened with an elliptical cast on the left  (violet)
//            screened with an elliptical cast on the right (cyan)
//            screened with a wide central halo
//            darkened toward the bottom edge
//
// Screening a layer at opacity a is exactly `screen(dst, src * a)`, so an SVG
// gradient stop's opacity is the layer's intensity — no approximation.

export type Cast = {
  /** centre as a fraction of frame width */
  x: number;
  /** gaussian sigma as a fraction of frame width / height */
  sx: number;
  sy: number;
  colour: [number, number, number];
};

export type FieldSpec = {
  /** base magnitude: value at x=0, the quadratic's control value, value at x=W */
  ramp: [number, number, number];
  /** colour direction of the base, multiplied by the ramp magnitude */
  tint: [number, number, number];
  /** alpha of the black overlay at the bottom edge (0 at mid-height) */
  bottomShade: number;
  left: Cast;
  right: Cast;
  halo: { scale: number; power: number; colour: [number, number, number] };
};

export const rgb = (c: [number, number, number]) =>
  `rgb(${c.map((v) => Math.max(0, Math.min(255, Math.round(v)))).join(", ")})`;

/** Quadratic bezier: ramp[0] at u=0, ramp[2] at u=1, ramp[1] as the control. */
export const rampAt = (ramp: [number, number, number], u: number) =>
  ramp[0] * (1 - u) * (1 - u) + 2 * ramp[1] * u * (1 - u) + ramp[2] * u * u;

export type Stop = { offset: number; colour: string; opacity: number };

/** Stops for the base ramp, as a horizontal linear gradient. */
export const rampStops = (spec: FieldSpec, steps = 6): Stop[] =>
  Array.from({ length: steps }, (_, i) => {
    const u = i / (steps - 1);
    const m = rampAt(spec.ramp, u);
    return {
      offset: u,
      colour: rgb(spec.tint.map((t) => t * m) as [number, number, number]),
      opacity: 1,
    };
  });

/**
 * Stops for a gaussian falloff drawn as a radial gradient whose radius is
 * `sigmas` standard deviations, so the tail is fully described.
 */
export const gaussianStops = (colour: string, sigmas = 3, steps = 9): Stop[] =>
  Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return { offset: t, colour, opacity: Math.exp(-0.5 * (t * sigmas) ** 2) };
  });

/** Stops for exp(-(d/scale)^power), used by the wide central halo. */
export const superGaussianStops = (colour: string, power: number, reach: number, steps = 9): Stop[] =>
  Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return { offset: t, colour, opacity: Math.exp(0 - (t * reach) ** power) };
  });

/**
 * gradientTransform that turns the unit circle of a radial gradient into the
 * ellipse a cast needs (sigma differs in x and y).
 */
export const castTransform = (cast: Cast, W: number, H: number) => {
  const x = cast.x * W;
  const ry = (cast.sy * H) / (cast.sx * W);
  return `translate(${x} ${H / 2}) scale(1 ${ry.toFixed(4)}) translate(${-x} ${-H / 2})`;
};
