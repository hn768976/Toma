import { Fn, mix, pow, saturate, smoothstep, uv, vec3, vec4 } from "three/tsl";
import {
  AdditiveBlending,
  DoubleSide,
  MeshBasicNodeMaterial,
  type Node,
} from "three/webgpu";
import type { EarthUniforms } from "./uniforms";

/**
 * The meteor streak.
 *
 * Drawn on a quad parented to the camera, so it is defined in screen space
 * and always lies along its own direction of travel — a world-space object
 * would need re-billboarding every frame and would still fight the depth
 * buffer for no gain, since nothing in the shot can plausibly occlude it.
 *
 * The quad reads left to right: u = 0 is the far end of the tail, u = 1 is
 * the head. The tail narrows as it goes back, which is what stops it reading
 * as a drawn line.
 */
export const createMeteorMaterial = (u: EarthUniforms) => {
  const material = new MeshBasicNodeMaterial();
  material.transparent = true;
  material.blending = AdditiveBlending;
  material.depthWrite = false;
  material.depthTest = false;
  material.side = DoubleSide;

  material.colorNode = Fn(() => {
    const along = uv().x;
    const across = uv().y.sub(0.5).mul(2).abs();

    // Width profile: a point at the back opening out towards the head.
    const width = pow(along, 2.4).mul(0.92).add(0.03);
    const body = smoothstep(width, width.mul(0.18), across);

    const tail = body.mul(pow(along, 1.7)).mul(0.9);
    const head = pow(along, 26).mul(smoothstep(0.55, 0.0, across)).mul(3.2);

    const colour = mix(vec3(0.55, 0.72, 1.0), vec3(1.0, 0.96, 0.88), pow(along, 3));
    const intensity = saturate(tail.add(head)).mul(u.meteorIntensity);

    return vec4(colour.mul(intensity), 1);
  })() as unknown as Node;

  return material;
};
