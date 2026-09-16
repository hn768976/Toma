import type Node from 'three/src/nodes/core/Node.js';
import { clamp, dot, float, max, pow, screenUV, vec2, vec3, vec4 } from 'three/tsl';

/**
 * Sample offsets for the bokeh disc, laid out by Vogel's method so the points
 * are evenly spread rather than clustered.
 */
export const bokehKernel = (samples: number): [number, number][] => {
  const GOLDEN_ANGLE = 2.39996323;
  const points: [number, number][] = [];
  for (let i = 0; i < samples; i++) {
    const theta = i * GOLDEN_ANGLE;
    const radius = Math.sqrt((i + 0.5) / samples);
    points.push([radius * Math.cos(theta), radius * Math.sin(theta)]);
  }
  return points;
};

const LUMA = vec3(0.2126, 0.7152, 0.0722);

export type DepthOfFieldOptions = {
  /** The scene colour, as a sampleable texture node. */
  colorTexture: {
    sample: (uv: Node<'vec2'>) => Node<'vec4'>;
  };
  /** Positive view-space distance from the camera, per pixel. */
  viewDistance: Node<'float'>;
  /** Distance, in world units, that is perfectly sharp. */
  focusDistance: Node<'float'>;
  /** How far from the focal plane a point has to be to reach maximum blur. */
  focusRange: Node<'float'>;
  /** Maximum blur radius, as a fraction of frame height. */
  blurStrength: Node<'float'>;
  /** Frame aspect ratio, so the disc stays circular. */
  aspect: number;
  samples?: number;
};

/**
 * Depth of field.
 *
 * A single-pass, depth-scaled bokeh gather. three ships a DepthOfFieldNode, but
 * it resolves its circle-of-confusion into an R16F multiple-render-target,
 * which SwiftShader (the software rasteriser a headless render falls back to)
 * does not resolve correctly -- the effect comes back as a flat field. This
 * does the same job with nothing but texture fetches.
 *
 * Taps are weighted towards the highlights, which is what turns the specular
 * pin-points in the far field into the round bokeh discs the reference has.
 */
export const depthOfField = ({
  colorTexture,
  viewDistance,
  focusDistance,
  focusRange,
  blurStrength,
  aspect,
  samples = 32,
}: DepthOfFieldOptions): Node<'vec4'> => {
  const circleOfConfusion = clamp(
    viewDistance.sub(focusDistance).abs().div(focusRange),
    0.0,
    1.0,
  );
  const radius = pow(circleOfConfusion, 1.3).mul(blurStrength);
  const offsetScale = vec2(radius.div(aspect), radius);

  let accumulated = vec3(0, 0, 0).mul(1);
  let weightSum = float(0).add(0);

  for (const [dx, dy] of bokehKernel(samples)) {
    const sampleUv = screenUV.add(offsetScale.mul(vec2(dx, dy)));
    const tap = colorTexture.sample(sampleUv);
    const luma = dot(tap.rgb, LUMA);
    const weight = float(1).add(max(luma.sub(0.8), 0.0).mul(1.5));

    accumulated = accumulated.add(tap.rgb.mul(weight));
    weightSum = weightSum.add(weight);
  }

  return vec4(accumulated.div(weightSum), 1.0);
};

export type BloomOptions = {
  colorTexture: {
    sample: (uv: Node<'vec2'>) => Node<'vec4'>;
  };
  /** Luminance above which a pixel starts to glow. */
  threshold: Node<'float'>;
  /** How much of the glow is added back. */
  strength: Node<'float'>;
  /** Glow radius, as a fraction of frame height. */
  radius: Node<'float'>;
  aspect: number;
  samples?: number;
};

/**
 * Bloom.
 *
 * A single-pass, Gaussian-weighted disc gather over the thresholded image.
 *
 * three ships a BloomNode, and it is the better effect -- a proper mip pyramid
 * rather than one wide tap ring. But it does its work in updateBefore(), by
 * binding its own render targets mid-frame; nested inside a larger output
 * expression that leaves the canvas bound to one of them, and the frame comes
 * out as nothing but the clear colour. This stays inside the fragment shader,
 * so it composes with anything.
 */
export const bloomGlow = ({
  colorTexture,
  threshold,
  strength,
  radius,
  aspect,
  samples = 24,
}: BloomOptions): Node<'vec3'> => {
  const offsetScale = vec2(radius.div(aspect), radius);

  let accumulated = vec3(0, 0, 0).mul(1);
  let weightSum = 0;

  for (const [dx, dy] of bokehKernel(samples)) {
    const distance = Math.hypot(dx, dy);
    const weight = Math.exp(-2.2 * distance * distance);
    weightSum += weight;

    const sampleUv = screenUV.add(offsetScale.mul(vec2(dx, dy)));
    const tap = colorTexture.sample(sampleUv).rgb;
    const bright = max(tap.sub(threshold), 0.0);

    accumulated = accumulated.add(bright.mul(weight));
  }

  return accumulated.div(weightSum).mul(strength);
};
