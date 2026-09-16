import {
  cameraPosition,
  dot,
  exp,
  float,
  Fn,
  max,
  min,
  normalize,
  positionLocal,
  pow,
  saturate,
  smoothstep,
  sqrt,
  vec3,
  vec4,
} from "three/tsl";
import {
  AdditiveBlending,
  BackSide,
  MeshBasicNodeMaterial,
  type Node,
} from "three/webgpu";
import { ATMOSPHERE_RADIUS } from "../config";
import type { EarthUniforms } from "./uniforms";

/**
 * The air.
 *
 * Drawn on a back-facing shell with depth testing off, because the shader does
 * its own occlusion: for every pixel it solves the ray against the top of the
 * atmosphere and against the planet, and shades the segment that survives. So
 * one draw gives both the bright arc standing off the limb and the haze lying
 * over the disc, with the right amount of air in each.
 */
export const createAtmosphereMaterial = (u: EarthUniforms) => {
  const material = new MeshBasicNodeMaterial();
  material.transparent = true;
  material.blending = AdditiveBlending;
  material.depthWrite = false;
  material.depthTest = false;
  material.side = BackSide;

  material.colorNode = Fn(() => {
    const origin = cameraPosition;
    const ray = normalize(positionLocal.sub(cameraPosition));

    const b = dot(origin, ray);
    const distanceSq = dot(origin, origin);

    const outer = float(ATMOSPHERE_RADIUS);
    const discOuter = b.mul(b).sub(distanceSq).add(outer.mul(outer));
    const rootOuter = sqrt(max(discOuter, float(0)));
    const enter = max(b.negate().sub(rootOuter), float(0));
    const leave = b.negate().add(rootOuter);

    const discPlanet = b.mul(b).sub(distanceSq).add(1);
    const rootPlanet = sqrt(max(discPlanet, float(0)));
    const hitPlanet = b.negate().sub(rootPlanet);
    const blocked = discPlanet.greaterThan(0).and(hitPlanet.greaterThan(enter));
    const exit = blocked.select(min(leave, hitPlanet), leave);

    // Optical depth, normalised against a full grazing chord.
    const chord = float(Math.sqrt(ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS - 1) * 2);
    const thickness = max(exit.sub(enter), float(0)).div(chord);
    const depth = thickness.mul(u.atmosphereDensity).mul(1.8);
    const optical = float(1).sub(exp(depth.negate()));

    // Light the segment from its midpoint, softened well past the geometric
    // terminator so twilight wraps around the limb the way it really does.
    const sun = normalize(u.sunDirection);
    const midpoint = normalize(origin.add(ray.mul(enter.add(exit).mul(0.5))));
    const lit = smoothstep(-0.34, 0.3, dot(midpoint, sun));

    const mu = dot(ray, sun);
    const rayleighPhase = mu.mul(mu).add(1).mul(0.75);
    const miePhase = pow(saturate(mu), 22);

    const rayleighColor = vec3(0.26, 0.49, 1.0).mul(u.rayleigh).mul(rayleighPhase);

    // Aerosol sits in the bottom few kilometres, so the Mie term grows with
    // how deep the sightline cuts. Together with the extinction below, that
    // is what stacks a warm band under the blue one at sunrise.
    const mieColor = vec3(1.0, 0.58, 0.28)
      .mul(u.mie)
      .mul(miePhase)
      .mul(thickness.mul(3.2).add(0.18))
      .mul(2.2);

    // Wavelength-dependent extinction along the chord. Blue is scattered out
    // first, so the deepest sightlines — the ones grazing the lowest air —
    // come through orange while the high limb above them stays blue. That
    // stack is the whole reason an orbital sunrise looks the way it does.
    const extinction = exp(
      vec3(3.4, 2.0, 1.05).mul(thickness.negate()).mul(u.extinction),
    );

    const color = rayleighColor
      .add(mieColor)
      .mul(optical)
      .mul(lit)
      .mul(extinction)
      .mul(u.sunIntensity);

    // Keep a whisper of airglow on the night limb.
    const airglow = vec3(0.05, 0.11, 0.16).mul(optical).mul(0.5);

    return vec4(color.add(airglow), 1);
  })() as unknown as Node;

  return material;
};
