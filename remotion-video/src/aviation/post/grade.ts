import { Vector3 } from "three/webgpu";
import { clamp, dot, float, mix, pow, screenUV, uniform, vec2, vec3 } from "three/tsl";
import { falloff, hash12 } from "../three/tsl-noise";
import type { TSL } from "../three/tsl";

/**
 * The look pass: exposure, lens falloff, colour grade, tone map, grain.
 *
 * The six references were shot on very different stock and graded very
 * differently — a flat overcast port, a warm hazy cruise, a hard teal-pushed
 * midday sky — so matching them is as much a grading problem as a lighting one.
 * The controls are the ones a colourist would reach for, in the order they
 * would apply them.
 */

export type GradeParams = {
  /** Stops of exposure, applied in linear before anything else. */
  readonly exposure: number;
  /** Lens falloff towards the corners. 0 disables. */
  readonly vignette: number;
  readonly vignetteSoftness: number;
  /** Lift/gamma/gain, the classic three-way colour balance. */
  readonly lift: Vector3;
  readonly gamma: Vector3;
  readonly gain: Vector3;
  /** S-curve strength around `contrastPivot`. */
  readonly contrast: number;
  readonly contrastPivot: number;
  readonly saturation: number;
  /** Pulls the whole frame towards this hue; used for the teal-graded shot. */
  readonly tint: Vector3;
  readonly tintAmount: number;
  /** Film grain amplitude, post tone map. */
  readonly grain: number;
  /** Size of a grain cluster in pixels. */
  readonly grainScale: number;
  /** Lateral chromatic aberration at the corners, in pixels. */
  readonly chromaticAberration: number;
};

export const defaultGrade = (overrides: Partial<GradeParams> = {}): GradeParams => ({
  exposure: 0,
  vignette: 0.24,
  vignetteSoftness: 0.62,
  lift: new Vector3(0, 0, 0),
  gamma: new Vector3(1, 1, 1),
  gain: new Vector3(1, 1, 1),
  contrast: 0.12,
  contrastPivot: 0.32,
  saturation: 1,
  tint: new Vector3(1, 1, 1),
  tintAmount: 0,
  grain: 0.012,
  grainScale: 1.4,
  chromaticAberration: 0,
  ...overrides,
});

export type GradeUniforms = { [K in keyof GradeParams]: ReturnType<typeof uniform> };

export const createGradeUniforms = (p: GradeParams): GradeUniforms => ({
  exposure: uniform(p.exposure),
  vignette: uniform(p.vignette),
  vignetteSoftness: uniform(p.vignetteSoftness),
  lift: uniform(p.lift.clone()),
  gamma: uniform(p.gamma.clone()),
  gain: uniform(p.gain.clone()),
  contrast: uniform(p.contrast),
  contrastPivot: uniform(p.contrastPivot),
  saturation: uniform(p.saturation),
  tint: uniform(p.tint.clone()),
  tintAmount: uniform(p.tintAmount),
  grain: uniform(p.grain),
  grainScale: uniform(p.grainScale),
  chromaticAberration: uniform(p.chromaticAberration),
});

export const applyGradeUniforms = (u: GradeUniforms, p: GradeParams) => {
  u.exposure.value = p.exposure;
  u.vignette.value = p.vignette;
  u.vignetteSoftness.value = p.vignetteSoftness;
  (u.lift.value as Vector3).copy(p.lift);
  (u.gamma.value as Vector3).copy(p.gamma);
  (u.gain.value as Vector3).copy(p.gain);
  u.contrast.value = p.contrast;
  u.contrastPivot.value = p.contrastPivot;
  u.saturation.value = p.saturation;
  (u.tint.value as Vector3).copy(p.tint);
  u.tintAmount.value = p.tintAmount;
  u.grain.value = p.grain;
  u.grainScale.value = p.grainScale;
  u.chromaticAberration.value = p.chromaticAberration;
};

const LUMA = vec3(0.2126, 0.7152, 0.0722);

/**
 * Narkowicz's fit of the ACES filmic curve. Cheap, and its shoulder rolls the
 * blown-out sky in every one of these references into highlight rather than
 * clipping it flat.
 */
const acesFilmic = (x: TSL): TSL =>
  clamp(x.mul(x.mul(2.51).add(0.03)).div(x.mul(x.mul(2.43).add(0.59)).add(0.14)), 0, 1) as TSL;

/**
 * Builds the grade node.
 *
 * `sample` is called with a UV so the chromatic aberration term can re-sample
 * the source at three slightly different radii.
 */
export const createGradeNode = (
  u: GradeUniforms,
  sample: (uv: TSL) => TSL,
  /** Frame number, so grain is deterministic per frame rather than per render. */
  frameSeed: ReturnType<typeof uniform>,
  resolution: ReturnType<typeof uniform>,
): TSL => {
  const uv = screenUV as unknown as TSL;
  const centred = uv.sub(0.5);
  const radius = centred.length().mul(1.4142);

  // Lateral chromatic aberration grows with distance from the optical axis.
  const shift = centred.mul(u.chromaticAberration.mul(0.001).mul(radius));
  const red = sample(uv.add(shift) as TSL);
  const green = sample(uv);
  const blue = sample(uv.sub(shift) as TSL);
  const source = vec3(red.r, green.g, blue.b) as TSL;

  // ---- Linear, scene-referred ---------------------------------------------
  const exposed = source.mul(pow(float(2), u.exposure));
  // Lens falloff belongs before the tone map, where it behaves like less light
  // reaching the corner of the frame rather than like a painted-on shadow.
  const lensFalloff = falloff(u.vignetteSoftness, 1, radius as TSL);
  const vignetted = exposed.mul(mix(float(1), lensFalloff, u.vignette));

  // ---- Display-referred ----------------------------------------------------
  const tonemapped = acesFilmic(vignetted as TSL);

  // Lift/gamma/gain, then an S-curve about the pivot.
  const lifted = tonemapped.mul(u.gain).add(u.lift.mul(float(1).sub(tonemapped)));
  const gammaed = pow(clamp(lifted, 0.0001, 1), vec3(1, 1, 1).div(u.gamma));
  const pivoted = gammaed.sub(u.contrastPivot);
  const contrasted = clamp(
    u.contrastPivot.add(pivoted.mul(float(1).add(u.contrast)).add(
      pivoted.mul(pivoted).mul(pivoted).mul(u.contrast.mul(-1.6)),
    )),
    0,
    1,
  );

  const luma = dot(contrasted, LUMA);
  const saturated = mix(vec3(luma, luma, luma), contrasted, u.saturation);
  const tinted = mix(saturated, saturated.mul(u.tint), u.tintAmount);

  // ---- Grain ---------------------------------------------------------------
  // Grain in a real negative sits in the mid-tones: highlights are saturated
  // and shadows carry too little signal to show it.
  const grainUv = uv.mul(resolution).div(u.grainScale).add(frameSeed.mul(vec2(37.7, 91.3)));
  const noise = hash12(grainUv as TSL).sub(0.5);
  const midtones = float(1).sub(tinted.g.sub(0.5).mul(2).abs().pow(1.5));
  const grained = tinted.add(noise.mul(u.grain).mul(midtones));

  return clamp(grained, 0, 1) as TSL;
};
