// The cell look, written in TSL (three's shading language) so one source
// compiles to WGSL on the WebGPU backend and GLSL on the WebGL2 fallback.
//
// Cells are drawn as camera-facing instanced quads rather than sphere
// meshes. That is deliberate: the reference's defining feature is a very
// shallow depth of field, and shading an analytic sphere inside a quad
// lets each cell carry its own circle-of-confusion in the fragment shader.
// That is far cheaper and far softer than rendering real geometry and
// then trying to recover the blur from a depth buffer in post -- and it
// means the blur is correct per-cell even where cells overlap.

import * as THREE from "three/webgpu";
import {
  Fn,
  attribute,
  cameraProjectionMatrix,
  cameraViewMatrix,
  float,
  mix,
  mx_fractal_noise_float,
  positionGeometry,
  uniform,
  varying,
  vec3,
  vec4,
} from "three/tsl";
import type { Theme } from "./themes";

/** Extra quad margin so the fuzzy silhouette is never clipped by the quad. */
const FUZZ_MARGIN = 0.25;
/**
 * The quad has to grow faster than the blur it carries. If it only grew by
 * the circle of confusion, a heavily defocused cell's falloff would reach
 * the quad boundary exactly and get sliced off along a straight edge.
 */
const BLUR_MARGIN = 1.9;

export type CellMaterialUniforms = {
  focus: ReturnType<typeof uniform>;
  blur: ReturnType<typeof uniform>;
  maxBlur: ReturnType<typeof uniform>;
  fogStart: ReturnType<typeof uniform>;
};

export type CellMaterial = {
  material: THREE.MeshBasicNodeMaterial;
  uniforms: CellMaterialUniforms;
};

const linear = (hex: string) => new THREE.Color(hex);

export const createCellMaterial = (theme: Theme): CellMaterial => {
  // Per-frame camera state, written by scene.ts.
  const uFocus = uniform(18);
  const uBlur = uniform(0.2);
  const uMaxBlur = uniform(2.2);
  const uFogStart = uniform(4);

  // Per-theme constants.
  const uCore = uniform(linear(theme.cellCore));
  const uLit = uniform(linear(theme.cellLit));
  const uRim = uniform(linear(theme.cellRim));
  const uRimStrength = uniform(theme.rimStrength);
  const uRimFalloff = uniform(theme.rimFalloff);
  const uFogColor = uniform(linear(theme.fogColor));
  const uFogDensity = uniform(theme.fogDensity);
  const uOpacity = uniform(theme.opacity);
  const uLitStrength = uniform(theme.litStrength);
  const uLitFalloff = uniform(theme.litFalloff);
  const uLightDir = uniform(new THREE.Vector3(...theme.lightDir).normalize());

  // Per-instance: world centre, and (radius, seed, fade).
  const aCenter = attribute("aCenter", "vec3");
  const aParams = attribute("aParams", "vec3");

  const viewCenter = cameraViewMatrix.mul(vec4(aCenter, 1)).xyz;
  // Distance in front of the camera. View space looks down -Z.
  const dist = viewCenter.z.negate();
  const radius = aParams.x;

  // Thin-lens circle of confusion. Screen-space blur radius is
  // proportional to |d - focus| / d; converting that back to a world-space
  // radius at depth d cancels the 1/d, leaving a clean linear ramp.
  const defocus = dist.sub(uFocus);
  const coc = defocus.abs().mul(uBlur).min(uMaxBlur);
  const halfSize = radius.mul(1 + FUZZ_MARGIN).add(coc.mul(BLUR_MARGIN));

  // Fraction of the quad the solid sphere occupies, and how soft its edge is.
  const vRatio = varying(radius.div(halfSize), "vRatio");
  const vSoft = varying(coc.div(halfSize), "vSoft");
  const vSeed = varying(aParams.y, "vSeed");
  const vFade = varying(aParams.z, "vFade");
  const vDist = varying(dist, "vDist");
  // 1 when the cell sits in front of the focal plane, 0 behind it, with a
  // short ramp across the plane itself so a cell crossing focus does not
  // switch opacity in a single frame. `defocus` is negative in front, so
  // negating it puts "in front" at the top of the smoothstep.
  const vInFront = varying(defocus.negate().smoothstep(-0.4, 0.4), "vInFront");

  const material = new THREE.MeshBasicNodeMaterial();

  // Billboard: offset the quad in view space so it always faces the camera,
  // then project. The mesh itself is never transformed, so world == local.
  material.vertexNode = Fn(() => {
    const offset = positionGeometry.xy.mul(halfSize);
    const viewPos = vec3(viewCenter.xy.add(offset), viewCenter.z);
    return cameraProjectionMatrix.mul(vec4(viewPos, 1));
  })();

  // Shared between colour and opacity: where we are on the sphere.
  // `d` is distance from the quad centre in quad units (0..~1.41).
  const quad = positionGeometry.xy;
  const d = quad.length();

  // Fine fuzz on the silhouette. It is driven by the quad position rather
  // than the sphere normal so it stays crisp right at the edge, and it is
  // faded out as a cell goes out of focus -- real defocus would smear it away.
  const fuzzVisible = float(1).sub(vSoft.mul(9)).clamp(0, 1);
  const noise = mx_fractal_noise_float(
    vec3(quad.mul(34), vSeed),
    2,
    2.4,
    0.5,
    1,
  );
  const dFuzzed = d.add(noise.mul(vRatio).mul(0.026).mul(fuzzVisible));

  // Soft edge = defocus blur + a constant sliver of antialiasing. The
  // constant part has to stay wider than one fuzz wavelength, or the
  // displaced edge breaks up into specks instead of reading as fur.
  const edge = vSoft.add(vRatio.mul(0.018)).add(0.008);
  const coverage = dFuzzed
    .smoothstep(vRatio.sub(edge), vRatio.add(edge))
    .oneMinus();

  // Analytic sphere normal in view space, from the quad coordinate.
  const nxy = quad.div(vRatio);
  const nz = float(1).sub(nxy.dot(nxy)).clamp(0, 1).sqrt();
  const normal = vec3(nxy, nz).normalize();

  // Key light. Kept gentle -- in the reference the cells are near-matte
  // and most of the apparent shaping comes from the silhouette, not from
  // a hot highlight.
  const lambert = normal.dot(uLightDir).clamp(0, 1);
  const body = mix(uCore, uLit, lambert.pow(uLitFalloff).mul(uLitStrength));

  // Fresnel-ish rim: brightest where the surface turns away from us. On the
  // dark grades this is the glow that makes the cells read as luminous; on
  // mono it is just enough to lift the silhouette off the backdrop.
  // The rim is additive, so in a packed frame the glow from dozens of
  // overlapping cells would stack and bleach the whole image. Defocus is
  // what keeps that honest: a blurred rim light genuinely smears and dims,
  // so out-of-focus cells contribute far less glow than sharp ones.
  const rimFocus = mix(float(0.18), float(1), vSoft.mul(3).clamp(0, 1).oneMinus());
  const rim = nz
    .oneMinus()
    .clamp(0, 1)
    .pow(uRimFalloff)
    .mul(uRimStrength)
    .mul(rimFocus);
  const lit = body.add(uRim.mul(rim));

  // Aerial haze. Distant cells sink into the backdrop, which is most of
  // what sells the depth once the frame is packed.
  const fog = vDist
    .sub(uFogStart)
    .max(0)
    .mul(uFogDensity.negate())
    .exp()
    .oneMinus()
    .clamp(0, 1);

  material.colorNode = mix(lit, uFogColor, fog);

  // Foreground bokeh is genuinely translucent -- a blurred near object
  // spreads its energy over a much larger area, so you see past it.
  // Background bokeh is not: it is still fully occluded by whatever is in
  // front of it. Applying the fade to both is what makes a packed frame
  // dissolve into overlapping ghost outlines.
  const blurFade = mix(
    float(1),
    mix(float(1), float(0.62), vSoft.mul(2.4).clamp(0, 1)),
    vInFront,
  );
  material.opacityNode = coverage.mul(uOpacity).mul(vFade).mul(blurFade);

  material.transparent = true;
  material.depthWrite = false;
  material.depthTest = false;
  material.side = THREE.DoubleSide;
  material.toneMapped = false;

  return {
    material,
    uniforms: {
      focus: uFocus,
      blur: uBlur,
      maxBlur: uMaxBlur,
      fogStart: uFogStart,
    },
  };
};

export { FUZZ_MARGIN };
