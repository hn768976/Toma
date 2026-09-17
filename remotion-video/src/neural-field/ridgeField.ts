// The "gyri" layer: the flowing brain-coral maze that fills one side of the
// frame in the reference clip.
//
// It is a real plane in the 3D scene, subdivided and displaced along z, so it
// catches perspective and parallaxes against the bokeh volume in front of it.
//
// The pattern is built the way a synthetic fingerprint is: take a constant
// slope across x, bend it with a domain-warped fractal noise field, then slice
// the result into contour bands. Contouring the noise directly (the obvious
// approach) spaces the bands by the field's gradient, so flat regions of noise
// open into large dead areas; adding the slope guarantees an even band density
// everywhere while the warp supplies all the meander.
//
// The field is evaluated per fragment rather than interpolated from the
// vertices — at this band density, vertex interpolation aliases badly. The
// vertex stage runs a cheaper, lower-octave version of the same field, which is
// all the low-frequency relief needs.
//
// Written in TSL (three/webgpu node materials) so the same source compiles to
// WGSL on the WebGPU backend and GLSL on the WebGL2 fallback.

import * as THREE from "three/webgpu";
import {
  Fn,
  vec2,
  vec3,
  vec4,
  float,
  uniform,
  positionLocal,
  varying,
  mix,
  smoothstep,
  fract,
  abs,
  pow,
  cos,
  sin,
  clamp,
  oneMinus,
  mx_fractal_noise_float,
  mx_fractal_noise_vec2,
  mx_cell_noise_float,
} from "three/tsl";

import { FIELD_BAND_COUNT, FIELD_RELIEF } from "./constants";
import type { Palette } from "./palettes";

const srgb = (hex: string) => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);

/** Base frequency of the field in plane units. */
const FIELD_FREQ = 0.16;
/**
 * y is sampled at a lower frequency than x, which stretches the gyri
 * vertically — the reference's ridges are combed, not isotropic marbling.
 */
const FIELD_ANISOTROPY = 0.58;
/** How hard the noise bends the base slope. Too high and the maze goes chaotic. */
const WARP_STRENGTH = 1.25;
/** Slope of the underlying parallel-line field the warp bends. */
const RIDGE_SLOPE = 0.42;
/** How much the noise displaces the contour phase, in band widths. */
const RIDGE_WANDER = 0.75;

export type RidgeFieldOptions = {
  palette: Palette;
  /** +1 = dense side on the left (reference), -1 = mirrored to the right. */
  mirror: 1 | -1;
  width: number;
  height: number;
  segmentsX: number;
  segmentsY: number;
  /** Seconds; one full turn of the phase circle per clip. */
  loopPeriod: number;
};

export type RidgeField = {
  mesh: THREE.Mesh;
  update: (timeSeconds: number) => void;
  dispose: () => void;
};

export const createRidgeField = ({
  palette,
  mirror,
  width,
  height,
  segmentsX,
  segmentsY,
  loopPeriod,
}: RidgeFieldOptions): RidgeField => {
  // `uPhase` is the clip's progress in radians. Every time-dependent term is
  // driven by cos/sin of it, so the last frame lands exactly back on the first
  // and the clip loops seamlessly.
  const uPhase = uniform(0);
  const uMirror = uniform(mirror);

  const uRidgeLow = uniform(srgb(palette.ridgeLow));
  const uRidgeMid = uniform(srgb(palette.ridgeMid));
  const uRidgeHigh = uniform(srgb(palette.ridgeHigh));
  const uFilament = uniform(srgb(palette.filament));
  const uHaze = uniform(srgb(palette.haze));

  const halfWidth = width / 2;

  /** Field coordinate for this point on the plane, mirrored if asked. */
  const coordAt = () =>
    vec2(
      positionLocal.x.mul(uMirror).mul(FIELD_FREQ),
      positionLocal.y.mul(FIELD_FREQ * FIELD_ANISOTROPY),
    );

  /**
   * Evaluates the warped field. `octaves` trades cost for detail so the vertex
   * stage can run a cheap version of exactly the same shape as the fragment.
   */
  const evaluate = (p: ReturnType<typeof vec2>, warpOctaves: number, fieldOctaves: number) => {
    const c = vec2(cos(uPhase), sin(uPhase));

    // Warp basis — only needs to be smooth and large-scale.
    const warp = mx_fractal_noise_vec2(
      vec3(p, c.x.mul(0.65).add(11.3)),
      warpOctaves,
      2.0,
      0.5,
    ).toVar();

    // Feed the warp back in, plus a slow circular drift of the whole domain.
    // Circular rather than linear so it returns to its start at the loop point.
    const warped = p.add(warp.mul(WARP_STRENGTH)).add(c.mul(0.34)).toVar();

    const v = mx_fractal_noise_float(
      vec3(warped, c.y.mul(0.5).add(4.1)),
      fieldOctaves,
      2.0,
      0.55,
    ).toVar();

    return { warp, warped, v };
  };

  // --- geometry & material ------------------------------------------------
  const geometry = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  // Normalised across the plane: 0 at the dense edge, 1 at the open edge.
  const across = clamp(
    positionLocal.x.mul(uMirror).div(halfWidth).mul(0.5).add(0.5),
    0,
    1,
  );

  const vRelief = varying(float(0), "vRelief");

  material.positionNode = Fn(() => {
    // Cheap version of the field — relief is low-frequency, so one warp octave
    // and two field octaves are indistinguishable here and much faster.
    const { v } = evaluate(coordAt(), 1, 2);
    const relief = v.mul(0.5).add(0.5).toVar();
    vRelief.assign(relief);

    // Push the crests toward the camera. Squared presence so the open side
    // stays genuinely flat rather than gently rippling.
    const presence = smoothstep(0.88, 0.1, across);
    const z = relief
      .mul(FIELD_RELIEF)
      .mul(presence.mul(presence))
      .sub(FIELD_RELIEF * 0.25);

    return vec3(positionLocal.x, positionLocal.y, z);
  })();

  material.colorNode = Fn(() => {
    const { warp, warped, v } = evaluate(coordAt(), 2, 3);

    // Parallel lines in x, bent by the field. Contours of this are the gyri.
    const ridgePhase = warped.x.mul(RIDGE_SLOPE).add(v.mul(RIDGE_WANDER));

    // `band` is 0 along a band's centre line and 1 in the trough between bands.
    const band = abs(fract(ridgePhase.mul(FIELD_BAND_COUNT)).sub(0.5))
      .mul(2.0)
      .toVar();

    // How present the field is here. The reference keeps the mass on one side
    // and lets it dissolve across the middle; nudging the threshold with the
    // field makes that boundary organic rather than a gradient wiping over it.
    const presence = clamp(
      smoothstep(0.95, 0.0, across).add(v.mul(0.12)),
      0.0,
      1.0,
    ).toVar();
    // Detail dies sooner than mass, which is what defocus looks like.
    const sharpness = smoothstep(0.46, -0.06, across).toVar();
    const openness = oneMinus(sharpness).toVar();

    // Two readings of the same bands: crisp and very soft. Mixing toward the
    // soft one across the open side fakes depth of field far more cheaply than
    // an actual blur pass, and costs nothing extra to sample.
    const bodySharp = pow(oneMinus(band), 2.6);
    // Almost flat: blurring a stripe pattern with a kernel near its period
    // collapses it toward a low-contrast swell, which is what the open side is.
    const bodySoft = smoothstep(1.7, -0.7, band).mul(0.7);
    const body = mix(bodySoft, bodySharp, sharpness).toVar();

    // The thin bright trace running along each crest, on most but not all of
    // the gyri so it reads as circuitry rather than as an outline.
    const core = pow(oneMinus(band), 8.0);
    const traceMask = smoothstep(-0.3, 0.35, warp.x);
    const trace = core.mul(traceMask).mul(sharpness).toVar();

    // Beads of light sitting on the traces.
    const beads = smoothstep(
      0.55,
      0.95,
      mx_cell_noise_float(
        vec3(
          positionLocal.x.mul(uMirror).mul(1.6),
          positionLocal.y.mul(1.6),
          cos(uPhase).mul(0.4),
        ),
      ),
    );
    const sparkle = trace.mul(beads).mul(1.9);

    // Colour ramp across the field's low frequencies: blue through teal, with
    // the green crest reserved for the very top of the range.
    const tone = smoothstep(-0.45, 0.5, v).toVar();
    const ramp = mix(uRidgeLow, uRidgeMid, smoothstep(0.0, 0.8, tone)).toVar();
    ramp.assign(mix(ramp, uRidgeHigh, pow(tone, 4.6)));

    // Relief lighting: crests that lean toward camera read brighter.
    const lift = float(0.5).add(vRelief.mul(0.95));

    // The mass is brightest where it is densest and falls away across the
    // frame, on top of the detail dying out.
    const falloff = mix(float(1.0), float(0.5), across);

    const rgb = ramp
      .mul(body)
      .mul(lift)
      .mul(falloff)
      .mul(1.05)
      .add(uFilament.mul(trace).mul(0.55))
      .add(uFilament.mul(sparkle))
      // A little haze so the dissolving edge doesn't just vanish to black.
      .add(uHaze.mul(body).mul(mix(float(0.55), float(1.2), openness)));

    return vec4(rgb.mul(presence), 1.0);
  })();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;

  return {
    mesh,
    update: (timeSeconds: number) => {
      uPhase.value = (timeSeconds / loopPeriod) * Math.PI * 2;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
};
