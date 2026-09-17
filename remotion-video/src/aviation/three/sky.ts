import {
  DataTexture,
  EquirectangularReflectionMapping,
  FloatType,
  LinearFilter,
  RGBAFormat,
  Vector3,
} from "three/webgpu";
import { clamp, dot, float, max, mix, normalize, pow, uniform } from "three/tsl";
import { falloff } from "./tsl-noise";
import type { TSL } from "./tsl";

/**
 * An analytic sky, deliberately art-directable rather than physically derived.
 *
 * The six references span overcast port haze, golden hour above a cloud deck
 * and a hard backlit midday blue, and no single-parameter atmosphere model
 * lands all three. So the model is a small stack of terms — zenith-to-horizon
 * gradient, horizon haze band, Mie forward-scatter lobe, sun disc — each with
 * an exposed colour and weight, and each shot dials in its own set.
 *
 * The same formula is evaluated twice: in TSL for the visible dome, and on the
 * CPU to bake the equirectangular map that lights the models. The two are kept
 * in step by construction — every term appears in both, in the same order,
 * with the same constants.
 */
export type SkyParams = {
  /** Normalised direction *towards* the sun. */
  readonly sunDirection: Vector3;
  readonly zenithColor: Vector3;
  readonly horizonColor: Vector3;
  /** Colour of the thick air near the horizon; usually warmer and paler. */
  readonly hazeColor: Vector3;
  readonly sunColor: Vector3;
  /** How tightly the gradient hugs the horizon. Higher = crisper transition. */
  readonly gradientFalloff: number;
  /** Half-width of the low haze band, in units of view-direction Y. */
  readonly hazeHeight: number;
  /** Strength of the broad glow around the sun. */
  readonly mieStrength: number;
  /** Exponent of the Mie lobe. Higher = tighter glow. */
  readonly mieFalloff: number;
  /** Brightness of the sun disc itself. Zero hides it. */
  readonly sunDiscIntensity: number;
  /** Angular size term for the disc. Higher = smaller sun. */
  readonly sunDiscFalloff: number;
  /** Overall multiplier applied last. */
  readonly intensity: number;
};

export const defaultSky = (overrides: Partial<SkyParams> = {}): SkyParams => ({
  sunDirection: new Vector3(0.3, 0.55, -0.78).normalize(),
  zenithColor: new Vector3(0.18, 0.34, 0.68),
  horizonColor: new Vector3(0.66, 0.76, 0.9),
  hazeColor: new Vector3(0.86, 0.88, 0.92),
  sunColor: new Vector3(1.0, 0.94, 0.82),
  gradientFalloff: 1.35,
  hazeHeight: 0.16,
  mieStrength: 0.35,
  mieFalloff: 8,
  sunDiscIntensity: 0,
  sunDiscFalloff: 1400,
  intensity: 1,
  ...overrides,
});

export type SkyRig = {
  readonly params: SkyParams;
  /** Live uniforms, so a shot can animate the sky without a material rebuild. */
  readonly uniforms: {
    sunDirection: ReturnType<typeof uniform>;
    zenithColor: ReturnType<typeof uniform>;
    horizonColor: ReturnType<typeof uniform>;
    hazeColor: ReturnType<typeof uniform>;
    sunColor: ReturnType<typeof uniform>;
    gradientFalloff: ReturnType<typeof uniform>;
    hazeHeight: ReturnType<typeof uniform>;
    mieStrength: ReturnType<typeof uniform>;
    mieFalloff: ReturnType<typeof uniform>;
    sunDiscIntensity: ReturnType<typeof uniform>;
    sunDiscFalloff: ReturnType<typeof uniform>;
    intensity: ReturnType<typeof uniform>;
  };
  /** Sky radiance along a (normalised) view direction. */
  radiance(direction: TSL): TSL;
};

export const createSkyRig = (params: SkyParams): SkyRig => {
  const uniforms = {
    sunDirection: uniform(params.sunDirection.clone()),
    zenithColor: uniform(params.zenithColor.clone()),
    horizonColor: uniform(params.horizonColor.clone()),
    hazeColor: uniform(params.hazeColor.clone()),
    sunColor: uniform(params.sunColor.clone()),
    gradientFalloff: uniform(params.gradientFalloff),
    hazeHeight: uniform(params.hazeHeight),
    mieStrength: uniform(params.mieStrength),
    mieFalloff: uniform(params.mieFalloff),
    sunDiscIntensity: uniform(params.sunDiscIntensity),
    sunDiscFalloff: uniform(params.sunDiscFalloff),
    intensity: uniform(params.intensity),
  };

  const radiance = (direction: TSL): TSL => {
    const u = uniforms;
    const d = normalize(direction);
    const up = clamp(d.y, -1, 1);

    // Zenith -> horizon. Raising `up` to a fractional power keeps a wide band
    // of near-horizon sky rather than a linear ramp, which is what makes the
    // upward-looking container shots read like a real wide lens.
    const t = pow(clamp(up, 0, 1), float(1).div(u.gradientFalloff));
    const gradient = mix(u.horizonColor, u.zenithColor, t);

    // Haze band: dense air piled up along the line of sight near the horizon,
    // continuing below it so the dome still reads when the camera tips down.
    const haze = falloff(u.hazeHeight.mul(-0.4), u.hazeHeight, up as TSL);
    const withHaze = mix(gradient, u.hazeColor, haze.mul(0.85));

    // Mie forward scattering: the broad bloom of light around the sun, plus a
    // much wider lobe that lifts the whole sun side of the sky.
    const cosTheta = clamp(dot(d, u.sunDirection), -1, 1);
    const lobe = max(cosTheta, 0);
    const mie = pow(lobe, u.mieFalloff).mul(u.mieStrength);
    const wide = pow(lobe, 2.2).mul(u.mieStrength).mul(0.35);
    const disc = pow(lobe, u.sunDiscFalloff).mul(u.sunDiscIntensity);

    return withHaze.add(u.sunColor.mul(mie.add(wide).add(disc))).mul(u.intensity) as TSL;
  };

  return { params, uniforms, radiance };
};

/** CPU mirror of {@link SkyRig.radiance}, used to bake the environment map. */
export const evaluateSky = (dir: Vector3, p: SkyParams, out: Vector3): Vector3 => {
  const d = dir.clone().normalize();
  const up = Math.max(-1, Math.min(1, d.y));

  const t = Math.pow(Math.max(0, Math.min(1, up)), 1 / p.gradientFalloff);
  out.copy(p.horizonColor).lerp(p.zenithColor, t);

  const inner = -p.hazeHeight * 0.4;
  const outer = p.hazeHeight;
  const hx = Math.max(0, Math.min(1, (up - inner) / (outer - inner)));
  const haze = 1 - hx * hx * (3 - 2 * hx);
  out.lerp(p.hazeColor, haze * 0.85);

  const cosTheta = Math.max(-1, Math.min(1, d.dot(p.sunDirection)));
  const lobe = Math.max(0, cosTheta);
  const glow =
    Math.pow(lobe, p.mieFalloff) * p.mieStrength +
    Math.pow(lobe, 2.2) * p.mieStrength * 0.35 +
    Math.pow(lobe, p.sunDiscFalloff) * p.sunDiscIntensity;

  out.x += p.sunColor.x * glow;
  out.y += p.sunColor.y * glow;
  out.z += p.sunColor.z * glow;
  return out.multiplyScalar(p.intensity);
};

/**
 * Bakes an equirectangular float texture of the sky for image-based lighting.
 *
 * 128x64 is plenty: it is only ever read through a roughness-blurred prefilter,
 * so the bake costs a fraction of a frame's render budget.
 */
export const bakeSkyEnvironment = (params: SkyParams, width = 128): DataTexture => {
  const height = width / 2;
  const data = new Float32Array(width * height * 4);
  const dir = new Vector3();
  const rgb = new Vector3();
  for (let y = 0; y < height; y++) {
    // Equirect convention: row 0 is the zenith.
    const theta = ((y + 0.5) / height) * Math.PI;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    for (let x = 0; x < width; x++) {
      const phi = ((x + 0.5) / width) * Math.PI * 2 - Math.PI;
      dir.set(sinT * Math.sin(phi), cosT, -sinT * Math.cos(phi));
      evaluateSky(dir, params, rgb);
      const i = (y * width + x) * 4;
      data[i] = rgb.x;
      data[i + 1] = rgb.y;
      data[i + 2] = rgb.z;
      data[i + 3] = 1;
    }
  }
  const texture = new DataTexture(data, width, height, RGBAFormat, FloatType);
  texture.mapping = EquirectangularReflectionMapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
};
