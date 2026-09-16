import * as THREE from "three/webgpu";
import {
  Fn,
  abs,
  cameraPosition,
  dot,
  exp,
  float,
  length,
  max,
  mix,
  normalWorld,
  positionGeometry,
  positionWorld,
  pow,
  saturate,
  smoothstep,
  uniform,
  vec3,
} from "three/tsl";
import type { Theme } from "./themes";

export type PlateMaterial = {
  material: THREE.MeshBasicNodeMaterial;
  /** World-space direction the seam light comes from, in the XY plane. */
  lightAzimuth: THREE.Vector2;
  /** Direction of the soft key that shapes the slab faces. */
  keyDirection: THREE.Vector3;
};

/**
 * Shades a slab the way the reference does: matte faces that stay close to
 * black (or, for the light theme, close to white) with a hot line where a
 * grazing light catches the chamfer around the outline.
 *
 * The light is a world-space direction rather than a `THREE.Light`, so the
 * highlight stays put while the stack turns underneath it. That is what makes
 * it travel: a straight edge has a single normal along its whole length and so
 * lights up evenly end to end, while the corner arcs sweep through normals and
 * the highlight rolls off around them. Lighting the geometry analytically also
 * keeps the shader cheap, which matters when the frames are rasterised in
 * software.
 */
export const createPlateMaterial = (
  theme: Theme,
  /** Half-width of a slab; sets the scale of the face gradient. */
  plateHalf: number,
  /** Half the slab's thickness, bevels included; sets the wall gradient. */
  slabHalf: number,
): PlateMaterial => {
  const material = new THREE.MeshBasicNodeMaterial();

  const lightAzimuth = new THREE.Vector2(0, 1);
  const keyDirection = new THREE.Vector3(0, 1, 0);

  const plateColor = uniform(new THREE.Color(theme.plate));
  const neonColor = uniform(new THREE.Color(theme.neon));
  const backdropColor = uniform(new THREE.Color(theme.backdrop));
  const lightAzimuthU = uniform(lightAzimuth);
  const keyDirectionU = uniform(keyDirection);

  const ambient = uniform(theme.ambient);
  const keyGain = uniform(theme.keyGain);
  const crevice = uniform(theme.crevice);
  const rimGain = uniform(theme.rimGain);
  const rimPower = uniform(theme.rimPower);
  const wallGain = uniform(theme.wallGain);
  const wallPower = uniform(theme.wallPower);
  const faceGain = uniform(theme.faceGain);
  const facePower = uniform(theme.facePower);
  const faceSpan = uniform(plateHalf);
  const slabHalfU = uniform(slabHalf);
  const wallFalloff = uniform(theme.wallFalloff);
  const fogStart = uniform(theme.fogStart);
  const fogDensity = uniform(theme.fogDensity);

  material.colorNode = Fn(() => {
    const n = normalWorld.normalize();
    const upness = n.z;
    const sideness = length(n.xy);
    // Flat faces have no meaningful azimuth; clamp before normalising.
    const facing = saturate(
      dot(n.xy.div(max(sideness, float(1e-4))), lightAzimuthU),
    );

    // The chamfer sits at roughly 45°: partly up, partly out.
    const bevelMask = smoothstep(0.3, 0.8, upness).mul(
      smoothstep(0.25, 0.65, sideness),
    );
    // The wall below it faces straight out.
    const wallMask = smoothstep(0.55, 0.95, sideness).mul(
      smoothstep(0.55, 0.12, abs(upness)),
    );
    const faceMask = smoothstep(0.8, 0.99, upness);

    const rim = pow(facing, rimPower).mul(bevelMask).mul(rimGain);

    // The seam light sits in the chamfer at the top of each slab, so the wall
    // below it is washed, not lit: brightest where it meets the chamfer and
    // falling away towards the face of the slab underneath. Without this the
    // whole wall lights up evenly and reads as a wide band instead of a line.
    const heightInSlab = smoothstep(
      slabHalfU.negate(),
      slabHalfU,
      positionGeometry.z,
    );
    const wall = pow(facing, wallPower)
      .mul(wallMask)
      .mul(pow(heightInSlab, wallFalloff))
      .mul(wallGain);

    // Spill across the flat faces is driven by world position, because the
    // face normal points at the camera and carries no azimuth of its own.
    // It is a linear ramp across the stack rather than a radial one: measuring
    // the angle from the axis puts a singularity right where the slabs meet.
    const spill = smoothstep(
      faceSpan.negate(),
      faceSpan,
      dot(positionWorld.xy, lightAzimuthU),
    );
    const face = pow(spill, facePower).mul(faceMask).mul(faceGain);

    const lambert = saturate(dot(n, keyDirectionU));
    const shade = mix(crevice, float(1), smoothstep(0, 0.85, upness));
    const body = plateColor.mul(ambient.add(lambert.mul(keyGain))).mul(shade);
    const lit = body.add(neonColor.mul(rim.add(wall).add(face)));

    // Sink the far end of the stack into the backdrop.
    const distance = length(positionWorld.sub(cameraPosition));
    const fade = saturate(
      exp(fogDensity.negate().mul(max(distance.sub(fogStart), float(0)))),
    );
    return vec3(mix(backdropColor, lit, fade));
  })();

  return { material, lightAzimuth, keyDirection };
};
