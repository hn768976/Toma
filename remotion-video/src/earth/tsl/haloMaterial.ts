import {
  cameraPosition,
  dot,
  float,
  Fn,
  length,
  max,
  mix,
  normalize,
  positionLocal,
  pow,
  saturate,
  smoothstep,
  vec3,
  vec4,
} from "three/tsl";
import {
  AdditiveBlending,
  BackSide,
  MeshBasicNodeMaterial,
  type Node,
} from "three/webgpu";
import type { EarthUniforms } from "./uniforms";

/**
 * The halo standing off the limb.
 *
 * The physical atmosphere shell is only about 60 km thick, which at this
 * range is a hairline — correct, but it does not read as the glow you see
 * around the planet in real orbital footage, where the airglow and the
 * camera's own flare spread the limb light well out into the black.
 *
 * This is that spread, drawn as its own wide shell: for each pixel, how close
 * the sightline passes to the planet's centre decides the falloff, so the
 * glow hugs the silhouette evenly all the way round instead of tracking the
 * geometry of a mesh. Depth testing is left on so the planet occludes it and
 * the glow only ever appears outside the disc.
 */
export const createHaloMaterial = (
  u: EarthUniforms,
  options: { radius: number; falloff: number },
) => {
  const material = new MeshBasicNodeMaterial();
  material.transparent = true;
  material.blending = AdditiveBlending;
  material.depthWrite = false;
  material.side = BackSide;

  material.colorNode = Fn(() => {
    const origin = cameraPosition;
    const ray = normalize(positionLocal.sub(cameraPosition));

    // Closest approach of the sightline to the planet's centre. Clamping the
    // parameter at zero keeps rays pointing away from Earth well behaved.
    const along = max(dot(origin, ray).negate(), float(0));
    const closestPoint = origin.add(ray.mul(along));
    const closest = length(closestPoint);

    const outer = float(options.radius);
    const spread = saturate(outer.sub(closest).div(outer.sub(1)));
    const glow = pow(spread, options.falloff);

    const sun = normalize(u.sunDirection);
    const lit = smoothstep(-0.4, 0.28, dot(normalize(closestPoint), sun));

    // White-hot where it meets the limb, falling to deep blue as it thins —
    // the other way round and the glow bleaches the sky instead of the edge.
    const tint = mix(vec3(0.3, 0.55, 1.0), vec3(0.82, 0.93, 1.0), pow(spread, 2.2));

    const color = tint.mul(glow).mul(lit).mul(u.haloStrength).mul(u.sunIntensity);

    // Night-side airglow, so the dark limb keeps a thin edge against space.
    const airglow = vec3(0.1, 0.2, 0.28).mul(glow).mul(u.haloStrength).mul(0.16);

    return vec4(color.add(airglow), 1);
  })() as unknown as Node;

  return material;
};
