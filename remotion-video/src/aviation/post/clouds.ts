import { Vector3 } from "three/webgpu";
import {
  Fn,
  clamp,
  dot,
  exp,
  float,
  max,
  min,
  mix,
  normalize,
  smoothstep,
  texture,
  screenUV,
  uniform,
  vec3,
  vec4,
} from "three/tsl";
import { getCloudNoise, sampleVolume } from "../three/noise-textures";
import { hash12 } from "../three/tsl-noise";
import { falloff } from "../three/tsl-noise";
import type { TSL } from "../three/tsl";

/**
 * A raymarched cumulus layer.
 *
 * Three of the six references live or die on cloud: the golden deck seen from
 * above in shot 4, the towers a silhouetted jet crosses in shot 5, and the
 * build-up behind the airport sign in shot 6. Billboards cannot do any of
 * those — they betray themselves the moment the camera moves past them — so
 * the layer is marched properly, with Beer-Lambert extinction, a short
 * secondary march towards the sun, and a Henyey-Greenstein phase function that
 * produces the bright rim you get looking towards the light.
 *
 * Density follows the standard modelling approach for real-time skies: a
 * low-frequency Perlin-Worley base decides where cloud exists, a height
 * gradient decides what shape it takes at that altitude, and finer Worley
 * octaves erode the result into cauliflower. The noise is baked into 3D
 * textures on the CPU — see `noise-textures.ts` for why.
 */

export type CloudParams = {
  /** Slab bounds in metres above the origin plane. */
  readonly bottom: number;
  readonly top: number;
  /** 0 clear, 1 overcast. */
  readonly coverage: number;
  readonly density: number;
  /** Metres per tile of the weather map: the size of a weather system. */
  readonly weatherScale: number;
  /** Metres per tile of the base shape noise: the size of a single cloud. */
  readonly shapeScale: number;
  /** Metres per tile of the erosion noise: the size of a cauliflower lobe. */
  readonly detailScale: number;
  readonly detailStrength: number;
  /** 0 flat stratus, 1 towering cumulus. */
  readonly cloudType: number;
  readonly sunDirection: Vector3;
  readonly sunColor: Vector3;
  readonly sunIntensity: number;
  /** Skylight from above and bounce from below. */
  readonly ambientTop: Vector3;
  readonly ambientBottom: Vector3;
  /** Henyey-Greenstein asymmetry for the forward and back lobes. */
  readonly forwardScatter: number;
  readonly backScatter: number;
  readonly scatterBlend: number;
  readonly extinction: number;
  /**
   * Strength of the dark-edge term. Real cloud edges are darker than a plain
   * Beer-Lambert march predicts, because a thin edge scatters light out before
   * it has a chance to bounce back.
   */
  readonly powder: number;
  /** Distance the secondary march towards the sun covers, in metres. */
  readonly lightMarchDistance: number;
  /** Furthest the primary march will travel, in metres. */
  readonly maxDistance: number;
  /** Offset applied to the noise lookups; animate for drift. */
  readonly wind: Vector3;
  /** How quickly distant cloud dissolves into haze. */
  readonly horizonFade: number;
  readonly horizonColor: Vector3;
};

export const defaultCloudParams = (overrides: Partial<CloudParams> = {}): CloudParams => ({
  bottom: 1400,
  top: 3400,
  coverage: 0.55,
  density: 1,
  weatherScale: 34000,
  shapeScale: 4200,
  detailScale: 420,
  detailStrength: 0.38,
  cloudType: 0.75,
  sunDirection: new Vector3(0.3, 0.5, -0.81).normalize(),
  sunColor: new Vector3(1, 0.93, 0.8),
  sunIntensity: 7,
  ambientTop: new Vector3(0.52, 0.62, 0.78),
  ambientBottom: new Vector3(0.26, 0.3, 0.38),
  forwardScatter: 0.78,
  backScatter: -0.28,
  scatterBlend: 0.62,
  extinction: 0.055,
  powder: 0.7,
  lightMarchDistance: 1100,
  maxDistance: 90000,
  wind: new Vector3(0, 0, 0),
  horizonFade: 0.035,
  horizonColor: new Vector3(0.82, 0.86, 0.92),
  ...overrides,
});

export type CloudUniforms = { [K in keyof CloudParams]: ReturnType<typeof uniform> };

export type CloudLayer = {
  readonly uniforms: CloudUniforms;
  /**
   * Marches the layer along a world-space ray, stopping at `maxRayDistance`
   * so scene geometry occludes cloud correctly.
   *
   * Returns `vec4(scattered radiance, 1 - transmittance)`, ready to composite
   * over whatever the scene pass produced.
   */
  march(rayOrigin: TSL, rayDirection: TSL, maxRayDistance: TSL): TSL;
  apply(params: CloudParams): void;
};

/**
 * Rescales `v` from one range to another.
 *
 * The input span is floored away from zero. Every caller here passes an
 * ascending range, and at least one of them (the coverage remap) legitimately
 * collapses to zero width over clear sky — which without the guard divides by
 * zero, and the resulting NaN propagates through the march and blacks out the
 * entire dome, not just the pixel that produced it.
 */
const remap = (v: TSL, lowIn: TSL, highIn: TSL, lowOut: TSL, highOut: TSL): TSL =>
  lowOut.add(v.sub(lowIn).div(highIn.sub(lowIn).max(1e-4)).mul(highOut.sub(lowOut))) as TSL;

/** Henyey-Greenstein phase function. */
const henyeyGreenstein = Fn(([cosAngle, g]: [TSL, TSL]) => {
  const g2 = g.mul(g);
  const denom = float(1).add(g2).sub(g.mul(2).mul(cosAngle)).max(1e-4);
  return float(1)
    .sub(g2)
    .div(denom.mul(denom.sqrt()).mul(4 * Math.PI));
});

export const createCloudLayer = (
  params: CloudParams,
  steps: number,
  lightSteps: number,
): CloudLayer => {
  const noise = getCloudNoise();

  const u: CloudUniforms = {
    bottom: uniform(params.bottom),
    top: uniform(params.top),
    coverage: uniform(params.coverage),
    density: uniform(params.density),
    weatherScale: uniform(params.weatherScale),
    shapeScale: uniform(params.shapeScale),
    detailScale: uniform(params.detailScale),
    detailStrength: uniform(params.detailStrength),
    cloudType: uniform(params.cloudType),
    sunDirection: uniform(params.sunDirection.clone()),
    sunColor: uniform(params.sunColor.clone()),
    sunIntensity: uniform(params.sunIntensity),
    ambientTop: uniform(params.ambientTop.clone()),
    ambientBottom: uniform(params.ambientBottom.clone()),
    forwardScatter: uniform(params.forwardScatter),
    backScatter: uniform(params.backScatter),
    scatterBlend: uniform(params.scatterBlend),
    extinction: uniform(params.extinction),
    powder: uniform(params.powder),
    lightMarchDistance: uniform(params.lightMarchDistance),
    maxDistance: uniform(params.maxDistance),
    wind: uniform(params.wind.clone()),
    horizonFade: uniform(params.horizonFade),
    horizonColor: uniform(params.horizonColor.clone()),
  };

  /** Vertical profile of a cloud: where in the slab it is allowed to exist. */
  const heightGradient = Fn(([h]: [TSL]) => {
    // Stratus hugs the base of the layer; cumulus builds a tall rounded body
    // that flattens as it nears the inversion at the top.
    const stratus = smoothstep(0, 0.07, h).mul(falloff(0.16, 0.34, h as TSL));
    const cumulus = smoothstep(0.02, 0.26, h).mul(falloff(0.68, 1, h as TSL));
    return mix(stratus, cumulus, u.cloudType);
  });

  /**
   * Cloud density at a world-space point.
   *
   * `cheap` skips the erosion octaves. The secondary march towards the sun uses
   * it: the shadow it produces is far too soft for that detail to survive, and
   * skipping it roughly halves the cost of the whole layer.
   */
  const sampleDensity = Fn(([position, cheap]: [TSL, TSL]) => {
    const p = position.add(u.wind);
    const h = clamp(position.y.sub(u.bottom).div(u.top.sub(u.bottom).max(1e-3)), 0, 1);

    const weather = texture(noise.weather, p.xz.div(u.weatherScale));
    // Coverage scales the weather map straight into a 0..1 threshold. The
    // tempting alternative — remapping the map's floor up by the coverage
    // amount — compresses the usable range so hard that the base shape never
    // clears the threshold and the sky comes out empty.
    const coverage = clamp(weather.x.mul(u.coverage).mul(1.7), 0, 1);

    // Each column of the layer gets its own ceiling, taken from the weather
    // map's type channel. Without this every cloud tops out at exactly the same
    // altitude and a deck seen from above reads as a flat speckled sheet rather
    // than as rolling tops — the single biggest tell that it is not cloud.
    const ceiling = weather.y.mul(0.6).add(0.4);
    const shaped = clamp(h.div(ceiling), 0, 1);

    const shape = sampleVolume(noise.shape, p.div(u.shapeScale) as TSL);
    const gradient = heightGradient(shaped as TSL) as TSL;
    const base = remap(
      shape.x.mul(gradient) as TSL,
      float(1).sub(coverage) as TSL,
      float(1),
      float(0),
      float(1),
    );
    const withCoverage = clamp(base.mul(coverage), 0, 1);

    const detailSample = sampleVolume(noise.detail, p.mul(1.4).div(u.detailScale) as TSL);
    const detailFbm = detailSample.x
      .mul(0.62)
      .add(detailSample.y.mul(0.26))
      .add(detailSample.z.mul(0.12));
    // Wispy at the base, cauliflower at the top: the erosion inverts with height.
    const erosion = mix(detailFbm.oneMinus(), detailFbm, shaped).mul(u.detailStrength);
    const eroded = clamp(remap(withCoverage as TSL, erosion as TSL, float(1), float(0), float(1)), 0, 1);

    const result = mix(eroded, withCoverage, cheap);
    return result.mul(u.density).mul(weather.z.mul(0.55).add(0.55));
  });

  /** Beer-Lambert transmittance from a point towards the sun. */
  const lightTransmittance = Fn(([position]: [TSL]) => {
    const stepLength = u.lightMarchDistance.div(lightSteps);
    let optical = float(0) as TSL;
    for (let step = 0; step < lightSteps; step++) {
      const t = stepLength.mul(step + 0.5);
      optical = optical.add(
        sampleDensity(position.add(u.sunDirection.mul(t)) as TSL, float(1)).mul(stepLength),
      ) as TSL;
    }
    // One long tap beyond the cone catches the shadow of a neighbouring tower,
    // which is what stops a cumulus field looking uniformly lit.
    const far = position.add(u.sunDirection.mul(u.lightMarchDistance.mul(6)));
    optical = optical.add(
      sampleDensity(far as TSL, float(1)).mul(u.lightMarchDistance.mul(2)),
    ) as TSL;
    // Real cumulus is optically thick: a single Beer-Lambert term over a
    // kilometre of it goes to zero, and the cloud renders as a flat grey mass
    // lit only by ambient. What actually brightens a cloud's interior is
    // multiple scattering, approximated here by summing octaves of decreasing
    // weight against decreasing extinction — the standard cheap stand-in, and
    // the difference between a grey slab and something with a lit side.
    let energy = float(0) as TSL;
    let weight = 1;
    let attenuation = 1;
    for (let octave = 0; octave < 3; octave++) {
      energy = energy.add(
        exp(optical.mul(u.extinction.mul(attenuation)).negate()).mul(weight),
      ) as TSL;
      weight *= 0.55;
      attenuation *= 0.38;
    }
    return energy;
  });

  /**
   * Wrapped in `Fn` rather than inlined: `If` and `Loop` build onto the
   * enclosing TSL stack, and there is no stack unless the graph is being built
   * inside a shader function.
   */
  const marchFn = Fn(([rayOrigin, rayDirection, maxRayDistance]: [TSL, TSL, TSL]) => {
    const ro = rayOrigin;
    const rd = normalize(rayDirection);

    // Ray/slab intersection. A ray running almost parallel to the layer would
    // give an unbounded span, so the divisor is kept away from zero while
    // keeping its sign.
    const dy = rd.y;
    const magnitude = dy.abs().max(1e-4);
    const direction = dy.sign();
    // |dy| floored, sign preserved, and a ray exactly parallel to the layer
    // pushed to +1 so the division stays finite. Doing this with a boolean
    // select instead silently yields zero on this backend.
    const safeDy = magnitude
      .mul(direction)
      .add(magnitude.mul(direction.abs().oneMinus()));
    const t0 = u.bottom.sub(ro.y).div(safeDy);
    const t1 = u.top.sub(ro.y).div(safeDy);
    const tNear = max(min(t0, t1), float(0));
    const tFar = min(min(max(t0, t1), u.maxDistance), maxRayDistance);

    // The span collapses to zero when the ray misses the layer, so the march
    // needs no branch to handle that case — and must not have one. On this
    // backend a TSL `Loop` that accumulates into variables declared outside it
    // contributes nothing at all: the loop runs and the result integrates to
    // zero, with no error anywhere. So the march is unrolled in JavaScript into
    // a plain expression tree instead. Each step's partial products are shared
    // by reference, so the graph stays linear in the step count, and the shader
    // ends up with no control flow at all.
    const span = max(tFar.sub(tNear), float(0));
    const stepLength = span.div(steps);
    const cosAngle = dot(rd, u.sunDirection);
    // Two lobes: a strong forward one for the silver lining you get looking
    // into the sun, and a weak backward one for the glow looking away from it.
    const phase = mix(
      henyeyGreenstein(cosAngle as TSL, u.backScatter as unknown as TSL) as TSL,
      henyeyGreenstein(cosAngle as TSL, u.forwardScatter as unknown as TSL) as TSL,
      u.scatterBlend,
    );

    let scattered = vec3(0, 0, 0) as TSL;
    let transmittance = float(1) as TSL;

    // Offsetting each pixel's first sample by a fraction of a step turns the
    // banding a short march would show into fine noise, which the half-
    // resolution sky pass then smooths on the way back up.
    const jitter = hash12(screenUV.mul(1024) as TSL);

    for (let step = 0; step < steps; step++) {
      const t = tNear.add(stepLength.mul(jitter.add(step)));
      const position = ro.add(rd.mul(t)) as TSL;
      const density = sampleDensity(position, float(0)) as TSL;
      const h = clamp(position.y.sub(u.bottom).div(u.top.sub(u.bottom).max(1e-3)), 0, 1);

      const sunEnergy = lightTransmittance(position) as TSL;
      // Dark edges: thin cloud scatters light straight back out.
      const powderTerm = mix(float(1), float(1).sub(exp(density.mul(-14))), u.powder);
      const ambient = mix(u.ambientBottom, u.ambientTop, h);
      const luminance = u.sunColor
        .mul(u.sunIntensity)
        .mul(sunEnergy)
        .mul(phase)
        .mul(powderTerm)
        .add(ambient);

      const sigma = u.extinction.mul(density);
      const stepTransmittance = exp(sigma.mul(stepLength).negate());
      // Analytic integral of the segment rather than a rectangle rule, which is
      // what keeps the march stable at low step counts.
      scattered = scattered.add(
        luminance.mul(float(1).sub(stepTransmittance)).mul(transmittance),
      ) as TSL;
      transmittance = transmittance.mul(stepTransmittance) as TSL;
    }

    // Cloud far enough away dissolves into the same haze the sky uses.
    const fade = clamp(float(1).sub(exp(tNear.mul(u.horizonFade).mul(-0.001))), 0, 1);
    scattered = mix(scattered, u.horizonColor.mul(float(1).sub(transmittance)), fade) as TSL;

    return vec4(scattered, float(1).sub(transmittance));
  });

  const march = (rayOrigin: TSL, rayDirection: TSL, maxRayDistance: TSL): TSL =>
    marchFn(rayOrigin, rayDirection, maxRayDistance) as TSL;

  const apply = (next: CloudParams) => {
    u.bottom.value = next.bottom;
    u.top.value = next.top;
    u.coverage.value = next.coverage;
    u.density.value = next.density;
    u.weatherScale.value = next.weatherScale;
    u.shapeScale.value = next.shapeScale;
    u.detailScale.value = next.detailScale;
    u.detailStrength.value = next.detailStrength;
    u.cloudType.value = next.cloudType;
    (u.sunDirection.value as Vector3).copy(next.sunDirection);
    (u.sunColor.value as Vector3).copy(next.sunColor);
    u.sunIntensity.value = next.sunIntensity;
    (u.ambientTop.value as Vector3).copy(next.ambientTop);
    (u.ambientBottom.value as Vector3).copy(next.ambientBottom);
    u.forwardScatter.value = next.forwardScatter;
    u.backScatter.value = next.backScatter;
    u.scatterBlend.value = next.scatterBlend;
    u.extinction.value = next.extinction;
    u.powder.value = next.powder;
    u.lightMarchDistance.value = next.lightMarchDistance;
    u.maxDistance.value = next.maxDistance;
    (u.wind.value as Vector3).copy(next.wind);
    u.horizonFade.value = next.horizonFade;
    (u.horizonColor.value as Vector3).copy(next.horizonColor);
  };

  return { uniforms: u, march, apply };
};
