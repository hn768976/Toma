/**
 * TSL node materials. Everything here compiles to WGSL and runs on WebGPU.
 *
 * The animation is driven by a single `progress` uniform that runs 0 -> 1 over
 * the clip. Every time-dependent term is a function of `fract(k * progress)`
 * with an integer `k`, so the last frame lands exactly on the first and the
 * 20 second clip loops without a seam.
 */

import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MeshBasicNodeMaterial,
  type Texture,
} from "three/webgpu";
import {
  abs,
  attribute,
  cameraPosition,
  dot,
  exp,
  float,
  fract,
  length,
  max,
  mix,
  normalize,
  oneMinus,
  positionWorld,
  pow,
  saturate,
  smoothstep,
  texture,
  normalWorld,
  uniform,
  vec2,
  vec3,
} from "three/tsl";
import { PALETTE, TRACE_FADE_END, TRACE_FADE_START } from "./constants";

/** World units between consecutive pulses on one route. */
const PULSE_SPACING = 4.2;
/**
 * Pulses travel `PULSE_TRAVEL * PULSE_SPACING` world units over one loop.
 * Must be a whole number for the loop to close.
 */
const PULSE_TRAVEL = 9;
/** A second, slower pulse train adds traffic without visible repetition. */
const SLOW_PULSE_SPACING = 9.5;
const SLOW_PULSE_TRAVEL = 4;

export type TraceMaterialHandle = {
  material: MeshBasicNodeMaterial;
  progress: ReturnType<typeof uniform>;
};

export const createTraceMaterial = (): TraceMaterialHandle => {
  const progress = uniform(0);

  const across = attribute("aAcross", "float");
  const arc = attribute("aArc", "float");
  const route = attribute("aRoute", "vec3");

  const seed = route.x;
  const routeLength = route.y;
  const startRadius = route.z;

  // Cross-section: a tight conductor with a soft bleed either side of it.
  const distance = abs(across);
  const core = oneMinus(smoothstep(0.03, 0.3, distance));
  const halo = pow(saturate(oneMinus(distance)), float(3.0)).mul(0.46);

  // Two pulse trains at different rates and offsets.
  const fastPhase = fract(
    arc
      .div(PULSE_SPACING)
      .sub(progress.mul(PULSE_TRAVEL))
      .add(seed.mul(7.13)),
  );
  const slowPhase = fract(
    arc
      .div(SLOW_PULSE_SPACING)
      .sub(progress.mul(SLOW_PULSE_TRAVEL))
      .add(seed.mul(3.77)),
  );

  // Ahead of the head the light stops abruptly; behind it a long tail trails
  // off — the asymmetry is what makes a moving dot read as a signal.
  const cometTail = (phase: typeof fastPhase, tail: number) =>
    exp(phase.mul(-70.0)).mul(0.85).add(exp(oneMinus(phase).mul(-tail)));

  const fastPulse = cometTail(fastPhase, 13.0);
  const slowPulse = cometTail(slowPhase, 26.0).mul(0.45);
  const pulse = fastPulse.add(slowPulse);

  // Every conductor rests the same cool blue; only the traffic running along a
  // minority of them is warm, which is how the reference plate reads.
  const warm = oneMinus(smoothstep(float(0.1), float(0.13), seed));
  const restColour = vec3(...new Color(PALETTE.traceBlue).toArray());
  const pulseColour = mix(
    vec3(...new Color(PALETTE.pulseBlue).toArray()),
    vec3(...new Color(PALETTE.pulseRed).toArray()),
    warm,
  );

  // Per-route brightness so the board does not look uniformly energised.
  const gain = pow(fract(seed.mul(91.7)), float(1.8)).mul(0.86).add(0.14);

  // Fade the ends of every route, and fade nets seeded away from the chip in
  // from nothing, so no trace simply starts or stops in mid-air.
  const endFade = smoothstep(0.0, 2.0, routeLength.sub(arc));
  // Only nets seeded well away from the package need easing in; the escape
  // routes must stay bright right where they leave the pins.
  const startFade = mix(
    float(1.0),
    smoothstep(0.0, 3.0, arc),
    saturate(startRadius.sub(3.0).mul(0.5)),
  );

  // Horizon falloff keeps the far board black instead of a noisy grey mat.
  const radius = length(vec2(positionWorld.x, positionWorld.z));
  const horizon = oneMinus(
    smoothstep(float(TRACE_FADE_START), float(TRACE_FADE_END), radius),
  );

  const visibility = horizon.mul(endFade).mul(startFade);

  // The resting conductor is dim; the pulse is what carries the highlight.
  const restLight = restColour.mul(core.add(halo.mul(0.55)).mul(gain).mul(0.72));
  const pulseLight = pulseColour.mul(
    pulse.mul(core.add(halo.mul(1.7))).mul(1.3),
  );

  const material = new MeshBasicNodeMaterial();
  material.colorNode = restLight.add(pulseLight).mul(visibility);
  material.transparent = true;
  material.blending = AdditiveBlending;
  material.depthWrite = false;
  material.side = DoubleSide;
  material.toneMapped = true;

  return { material, progress };
};

/** World units covered by one repeat of the substrate texture. */
const SUBSTRATE_TILE = 8.5;

export const createBoardMaterial = (substrate: Texture) => {
  const radius = length(vec2(positionWorld.x, positionWorld.z));

  const detailUv = vec2(
    positionWorld.x.div(SUBSTRATE_TILE),
    positionWorld.z.div(SUBSTRATE_TILE),
  );
  const detail = texture(substrate, detailUv);

  // Large-scale modulation hides the fact that the detail texture tiles.
  const broad = texture(
    substrate,
    vec2(
      positionWorld.x.div(SUBSTRATE_TILE * 6.3).add(0.31),
      positionWorld.z.div(SUBSTRATE_TILE * 6.3).add(0.17),
    ),
  );

  // The board is lit almost entirely by the net it carries, so approximate
  // that with a wide pool of light centred on the package.
  const nearGlow = exp(radius.mul(-0.2)).mul(1.5);
  const wideGlow = exp(radius.mul(-0.05)).mul(0.62);
  const light = nearGlow.add(wideGlow).add(0.16);

  const tint = vec3(0.22, 0.48, 1.0);
  const base = detail.rgb.mul(broad.rgb.mul(2.4).add(0.6)).mul(2.6);

  const horizon = oneMinus(smoothstep(float(19.0), float(46.0), radius));

  const material = new MeshBasicNodeMaterial();
  material.colorNode = base
    .mul(light)
    .mul(tint.mul(1.25).add(0.12))
    .mul(horizon);
  material.toneMapped = true;

  return material;
};

/**
 * The package body. A Fresnel term on a near-black base gives the moulded
 * epoxy its bright silhouette edge without paying for a full PBR shading pass.
 */
export const createChipBodyMaterial = () => {
  const viewDirection = normalize(cameraPosition.sub(positionWorld));
  const facing = saturate(dot(normalWorld, viewDirection));
  const fresnel = pow(oneMinus(facing), float(6.5));

  // The lid catches more light than the sides.
  const upness = saturate(normalWorld.y);

  const body = vec3(...new Color(PALETTE.chipBody).toArray());
  const rim = vec3(...new Color(PALETTE.chipRim).toArray());

  const material = new MeshBasicNodeMaterial();
  material.colorNode = body
    .add(rim.mul(fresnel.mul(0.55)))
    .add(vec3(0.01, 0.024, 0.05).mul(upness));
  material.toneMapped = true;

  return material;
};

export const createChipLidMaterial = (lid: Texture) => {
  const material = new MeshBasicNodeMaterial();
  material.colorNode = texture(lid).rgb.mul(0.95);
  material.toneMapped = true;

  return material;
};

/**
 * Contact shadow under the package.
 *
 * Without it the chip floats: every other surface here is additive, so nothing
 * in the scene can darken the board. This is the one subtractive element, and
 * it is what makes the package look like it is sitting on the substrate rather
 * than hovering over it.
 */
export const createChipShadowMaterial = () => {
  const distance = length(vec2(positionWorld.x, positionWorld.z));

  const material = new MeshBasicNodeMaterial();
  material.colorNode = vec3(0.0, 0.004, 0.012);
  material.opacityNode = smoothstep(float(2.6), float(0.75), distance).mul(0.9);
  material.transparent = true;
  material.depthWrite = false;
  material.toneMapped = false;

  return material;
};

/** Atmospheric haze so the glow does not stop dead at the board surface. */
export const createHazeMaterial = () => {
  const height = saturate(positionWorld.y.mul(0.5));
  const radius = length(vec2(positionWorld.x, positionWorld.z));
  const falloff = exp(radius.mul(-0.09));

  const material = new MeshBasicNodeMaterial();
  material.colorNode = vec3(0.08, 0.26, 0.62).mul(
    max(float(0.0), oneMinus(height)).mul(falloff).mul(0.30),
  );
  material.transparent = true;
  material.blending = AdditiveBlending;
  material.depthWrite = false;
  material.side = DoubleSide;
  material.toneMapped = true;

  return material;
};
