import React, {useMemo} from 'react';
import {MeshPhysicalMaterial, Texture} from 'three';

/**
 * A substantial brushed-metal mast.
 *
 * A smooth cylinder reflecting a smooth gradient reads as a plain white stick,
 * so the shaft shader adds what actually makes a metal pole legible: a bright
 * vertical highlight down the lit flank, a distinctly darker shaded flank,
 * fine lengthwise brushing in the roughness, and faint horizontal banding
 * suggesting the mast is built in sections.
 *
 * The hoist band is the strip the flag is bent onto, with three fixing points.
 */
export const Pole: React.FC<{
  readonly x: number;
  readonly topY: number;
  readonly bottomY: number;
  readonly radius: number;
  readonly envMap: Texture;
  /** Vertical span of the flag, so the hoist band lines up with it. */
  readonly hoistTopY: number;
  readonly hoistBottomY: number;
}> = ({x, topY, bottomY, radius, envMap, hoistTopY, hoistBottomY}) => {
  const shaft = useMemo(() => {
    const m = new MeshPhysicalMaterial({
      color: '#8f979f',
      metalness: 1,
      roughness: 0.3,
      anisotropy: 0.8,
      anisotropyRotation: Math.PI / 2,
      envMap,
      envMapIntensity: 0.7,
    });

    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPolePos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPolePos = position;');

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPolePos;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
{
  // Azimuth around the mast. The key light sits upper front-left, so the
  // highlight is placed to match it.
  float a = atan(vPolePos.z, vPolePos.x);
  float lit = cos(a - 2.30);

  // Darker flank turning away from the key.
  float shade = mix(0.30, 1.0, smoothstep(-0.95, 0.75, lit));

  // Faint horizontal banding: the mast reads as sections rather than one tube.
  float sect = 1.0 - 0.07 * smoothstep(0.90, 1.0, abs(sin(vPolePos.y * 5.5)));

  diffuseColor.rgb *= shade * sect;

  // The bright vertical streak down the lit flank.
  diffuseColor.rgb += vec3(0.34) * smoothstep(0.62, 0.99, lit);
}`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
{
  // Lengthwise brushing.
  float a = atan(vPolePos.z, vPolePos.x);
  float streak = sin(a * 23.0) * 0.5 + sin(a * 11.0) * 0.3 + sin(a * 41.0) * 0.2;
  roughnessFactor = clamp(roughnessFactor + streak * 0.13, 0.05, 1.0);
}`,
        );
    };
    return m;
  }, [envMap]);

  const finial = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: '#a9b0b8',
        metalness: 1,
        roughness: 0.14,
        envMap,
        envMapIntensity: 0.9,
      }),
    [envMap],
  );

  const band = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: '#767d85',
        metalness: 1,
        roughness: 0.42,
        envMap,
        envMapIntensity: 0.6,
      }),
    [envMap],
  );

  const length = topY - bottomY;
  const midY = (topY + bottomY) / 2;
  const hoistMid = (hoistTopY + hoistBottomY) / 2;
  const hoistLen = hoistTopY - hoistBottomY;
  const fixings = [0.5, 0, -0.5]; // three fixing points along the band

  return (
    <group position={[x, 0, 0]}>
      <mesh material={shaft} position={[0, midY, 0]}>
        <cylinderGeometry args={[radius, radius * 1.06, length, 64, 1]} />
      </mesh>

      {/* Finial: a collar and a spherical cap. */}
      <mesh material={band} position={[0, topY + radius * 0.35, 0]}>
        <cylinderGeometry args={[radius * 1.25, radius * 1.25, radius * 0.7, 48, 1]} />
      </mesh>
      <mesh material={finial} position={[0, topY + radius * 2.4, 0]}>
        <sphereGeometry args={[radius * 1.85, 48, 32]} />
      </mesh>

      {/* Hoist band: the strip the flag is bent onto. */}
      <mesh material={band} position={[0, hoistMid, 0]}>
        <cylinderGeometry args={[radius * 1.14, radius * 1.14, hoistLen, 48, 1]} />
      </mesh>
      {fixings.map((f) => (
        <mesh key={f} material={finial} position={[0, hoistMid + f * hoistLen * 0.82, radius * 0.9]}>
          <sphereGeometry args={[radius * 0.4, 24, 16]} />
        </mesh>
      ))}
    </group>
  );
};
