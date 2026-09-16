import { Fn, mix, pow, saturate, smoothstep, uv, vec2, vec3, vec4 } from "three/tsl";
import {
  AdditiveBlending,
  DoubleSide,
  MeshBasicNodeMaterial,
  type Node,
} from "three/webgpu";
import type { EarthUniforms } from "./uniforms";

/**
 * Lens flare on the sun.
 *
 * three ships an anamorphic post node, but it tints hard towards violet and
 * its reach grows fast enough that at any useful strength it lays a coloured
 * wash over the whole frame. Drawing the flare directly on a quad parented to
 * the camera costs one more draw and gives exact control of its colour,
 * length and falloff — and it can be hidden on the frames where the sun is
 * behind the planet, which a post pass cannot know about.
 */
export const createFlareMaterial = (u: EarthUniforms) => {
  const material = new MeshBasicNodeMaterial();
  material.transparent = true;
  material.blending = AdditiveBlending;
  material.depthWrite = false;
  material.depthTest = false;
  material.side = DoubleSide;

  material.colorNode = Fn(() => {
    const centred = uv().sub(vec2(0.5, 0.5)).mul(2);
    const across = centred.y.abs();
    const along = centred.x.abs();

    // The horizontal bar: long in x, tight in y, tapering to nothing at
    // either end rather than stopping at the quad edge.
    const barFade = pow(saturate(along.oneMinus()), 1.6);
    const bar = smoothstep(0.32, 0.0, across.div(barFade.max(0.02))).mul(barFade);

    // The core the bar comes out of.
    const radial = saturate(centred.mul(vec2(3.4, 1.0)).length().oneMinus());
    const core = pow(radial, 3.2);

    const colour = mix(vec3(1.0, 0.62, 0.34), vec3(1.0, 0.96, 0.9), pow(radial, 2));
    const intensity = bar.mul(0.55).add(core.mul(1.9)).mul(u.flareIntensity);

    return vec4(colour.mul(intensity), 1);
  })() as unknown as Node;

  return material;
};
