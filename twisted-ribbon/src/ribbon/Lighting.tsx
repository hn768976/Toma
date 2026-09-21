import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { buildEnvironment } from './environment';
import type { LightSpec, VersionConfig } from './versions';

const SHADOW_MAP = 4096;

/**
 * Camera basis, so lights can be authored as "screen upper right" instead of as
 * world coordinates that stop meaning anything the moment the shot is re-framed.
 */
const useCameraBasis = () => {
  const camera = useThree((s) => s.camera);
  return useMemo(() => {
    const forward = new Vector3();
    camera.getWorldDirection(forward);
    const right = new Vector3()
      .crossVectors(forward, new Vector3(0, 1, 0))
      .normalize();
    const up = new Vector3().crossVectors(right, forward).normalize();
    const back = forward.clone().negate();
    return { right, up, back };
  }, [camera, camera.position.x, camera.position.y, camera.position.z]);
};

const useLightPosition = (spec: LightSpec): [number, number, number] => {
  const { right, up, back } = useCameraBasis();
  return useMemo(() => {
    const v = new Vector3()
      .addScaledVector(right, spec.dir[0])
      .addScaledVector(up, spec.dir[1])
      .addScaledVector(back, spec.dir[2]);
    if (v.lengthSq() === 0) v.set(0, 1, 0);
    v.normalize().multiplyScalar(spec.distance);
    return [v.x, v.y, v.z];
  }, [right, up, back, spec]);
};

export const Lighting: React.FC<{ cfg: VersionConfig }> = ({ cfg }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const { key, fill, rims, ambient, hemi } = cfg.lights;

  const keyPos = useLightPosition(key);
  const fillPos = useLightPosition(fill);
  const { right, up, back } = useCameraBasis();
  const rimPositions = useMemo(
    () =>
      rims.map((r) => {
        const v = new Vector3()
          .addScaledVector(right, r.dir[0])
          .addScaledVector(up, r.dir[1])
          .addScaledVector(back, r.dir[2]);
        if (v.lengthSq() === 0) v.set(0, 1, 0);
        v.normalize().multiplyScalar(r.distance);
        return [v.x, v.y, v.z] as [number, number, number];
      }),
    [rims, right, up, back],
  );

  const envMap = useMemo(() => buildEnvironment(gl, cfg.env), [gl, cfg.env]);

  useEffect(() => {
    scene.environment = envMap;
    scene.environmentIntensity = cfg.env.intensity;
    return () => {
      scene.environment = null;
    };
  }, [scene, envMap, cfg.env.intensity]);

  return (
    <>
      <ambientLight intensity={ambient.intensity} color={ambient.color} />
      <hemisphereLight args={[hemi.sky, hemi.ground, hemi.intensity]} />
      <directionalLight
        position={keyPos}
        intensity={key.intensity}
        color={key.color}
        castShadow
        shadow-mapSize-width={SHADOW_MAP}
        shadow-mapSize-height={SHADOW_MAP}
        shadow-camera-left={-2.2}
        shadow-camera-right={2.2}
        shadow-camera-top={2.2}
        shadow-camera-bottom={-2.2}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
        shadow-bias={cfg.shadow.bias}
        shadow-normalBias={cfg.shadow.normalBias}
      />
      <directionalLight
        position={fillPos}
        intensity={fill.intensity}
        color={fill.color}
      />
      {rims.map((r, i) => (
        <directionalLight
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          position={rimPositions[i]}
          intensity={r.intensity}
          color={r.color}
        />
      ))}
    </>
  );
};
