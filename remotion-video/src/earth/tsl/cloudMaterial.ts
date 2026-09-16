import {
  cameraPosition,
  cross,
  dot,
  exp,
  float,
  Fn,
  max,
  mix,
  mx_fractal_noise_float,
  normalize,
  oneMinus,
  positionLocal,
  pow,
  saturate,
  smoothstep,
  texture,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { MeshBasicNodeMaterial, type Node, type Texture } from "three/webgpu";
import { NORTH } from "./common";
import type { EarthUniforms } from "./uniforms";

/**
 * The cloud deck, a thin shell above the surface.
 *
 * Opacity is treated as an optical depth rather than a straight alpha, so the
 * deck thickens where the view grazes it. That is what keeps the limb reading
 * as a layer of air with weather in it instead of a decal on a ball.
 */
export const createCloudMaterial = (clouds: Texture, u: EarthUniforms) => {
  const material = new MeshBasicNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;

  const driftedUv = () => uv().add(vec2(u.cloudDrift, 0));

  material.colorNode = Fn(() => {
    const point = positionLocal;
    const normal = normalize(point);
    const east = normalize(cross(NORTH, normal));
    const north = cross(normal, east);

    const sun = normalize(u.sunDirection);
    const view = normalize(cameraPosition.sub(point));
    const ndl = dot(normal, sun);

    const dayMask = smoothstep(-0.14, 0.2, ndl);
    const warm = smoothstep(0.28, -0.02, ndl).mul(dayMask);
    const sunColor = mix(vec3(1.0, 0.985, 0.96), vec3(1.0, 0.62, 0.36), warm);

    // Self-shadowing: peek at the deck a little way towards the sun, so the
    // anti-sun flank of every cloud mass darkens.
    const towardsSun = vec2(dot(sun, east), dot(sun, north)).mul(0.0022);
    const neighbour = texture(clouds, driftedUv().sub(towardsSun)).a;
    const selfShadow = oneMinus(neighbour.mul(0.45));

    // Forward scattering — the silver lining you get looking towards the sun.
    const mu = dot(view.negate(), sun);
    const silver = pow(saturate(mu), 9).mul(0.55).mul(dayMask);

    const color = sunColor
      .mul(saturate(ndl).mul(0.88).add(0.12))
      .mul(selfShadow)
      .mul(u.sunIntensity)
      .add(sunColor.mul(silver))
      .add(vec3(0.035, 0.045, 0.07).mul(oneMinus(dayMask)));

    return vec4(color, 1);
  })() as unknown as Node;

  material.opacityNode = Fn(() => {
    const point = positionLocal;
    const normal = normalize(point);
    const view = normalize(cameraPosition.sub(point));

    const base = pow(texture(clouds, driftedUv()).a, 1.3);
    const evolve = mx_fractal_noise_float(
      point.mul(140).add(vec3(0, 0, u.cloudEvolve)),
      3,
      2,
      0.55,
    );
    // A finer field on top, so the deck keeps wisps and torn edges at a
    // range where the cloud map itself is only a few kilometres per texel.
    const wisps = mx_fractal_noise_float(
      point.mul(620).add(vec3(0, 0, u.cloudEvolve.mul(0.4))),
      3,
      2,
      0.5,
    );
    const modulated = base.mul(evolve.mul(0.26).add(1)).mul(wisps.mul(0.22).add(1));
    const density = saturate(modulated).mul(u.cloudOpacity);

    // Longer path through the deck at grazing angles, capped so the limb does
    // not blow out into a hard white band.
    const path = float(1).div(max(saturate(dot(normal, view)), float(0.16)));
    return oneMinus(exp(density.mul(path).mul(-2.6)));
  })() as unknown as Node;

  return material;
};
