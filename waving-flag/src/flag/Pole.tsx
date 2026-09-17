import React, {useMemo} from 'react';
import {MeshPhysicalMaterial, Texture} from 'three';

/**
 * Brushed metal pole with a simple spherical finial. Runs off the bottom of
 * frame. The brushed look comes from three's anisotropic specular lobe, which
 * smears the highlight along the pole rather than leaving a hard hotspot.
 */
export const Pole: React.FC<{
  readonly x: number;
  readonly topY: number;
  readonly bottomY: number;
  readonly radius: number;
  readonly envMap: Texture;
}> = ({x, topY, bottomY, radius, envMap}) => {
  const shaft = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: '#868d95',
        metalness: 1,
        roughness: 0.32,
        anisotropy: 0.8,
        anisotropyRotation: Math.PI / 2,
        envMap,
        envMapIntensity: 0.62,
      }),
    [envMap],
  );

  // Fine lengthwise streaks in the roughness — the brushing. Without them a
  // smooth cylinder reflecting a smooth gradient reads as a plain white rod.
  shaft.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vPolePos;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
{
  float a = atan(vPolePos.z, vPolePos.x);
  float streak = sin(a * 23.0) * 0.5 + sin(a * 11.0) * 0.3 + sin(a * 41.0) * 0.2;
  roughnessFactor = clamp(roughnessFactor + streak * 0.11, 0.04, 1.0);
}`,
      );
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vPolePos;`,
      )
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vPolePos = position;`);
  };
  const finial = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: '#959ca4',
        metalness: 1,
        roughness: 0.16,
        envMap,
        envMapIntensity: 0.75,
      }),
    [envMap],
  );

  const length = topY - bottomY;
  const midY = (topY + bottomY) / 2;

  return (
    <group position={[x, 0, 0]}>
      <mesh material={shaft} position={[0, midY, 0]}>
        <cylinderGeometry args={[radius, radius, length, 48, 1]} />
      </mesh>
      <mesh material={finial} position={[0, topY + radius * 1.7, 0]}>
        <sphereGeometry args={[radius * 1.75, 48, 32]} />
      </mesh>
    </group>
  );
};
