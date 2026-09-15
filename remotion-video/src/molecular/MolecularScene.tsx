import React, { useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Backdrop } from "./Backdrop";
import { Dust } from "./Dust";
import { Effects } from "./Effects";
import { Molecules } from "./Molecules";
import { buildEquirectTexture } from "./environment";
import type { VersionPreset } from "./types";

export const MolecularScene: React.FC<{
  preset: VersionPreset;
  time: number;
  resolutionScale: number;
  geometry: THREE.BufferGeometry;
}> = ({ preset, time, resolutionScale, geometry }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  // Synthesised studio IBL. PMREM is expensive, so it is built once per preset
  // and reused for every frame of that version.
  const envMap = useMemo(() => {
    const equirect = buildEquirectTexture(preset.env, preset.exposure);
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();
    const target = pmrem.fromEquirectangular(equirect);
    equirect.dispose();
    pmrem.dispose();
    return target.texture;
  }, [gl, preset.env, preset.exposure]);

  useLayoutEffect(() => {
    scene.environment = envMap;
  }, [scene, envMap]);

  // Camera rig is a pure function of elapsed seconds — no integration, so any
  // frame can be rendered standalone and distributed across workers.
  const rig = preset.camera(time);
  camera.position.set(...rig.position);
  camera.fov = rig.fov;
  camera.near = 0.1;
  camera.far = 200;
  camera.lookAt(new THREE.Vector3(...rig.lookAt));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  return (
    <>
      <Backdrop spec={preset.background} exposure={preset.exposure} />

      <Molecules
        geometry={geometry}
        layout={preset.layout}
        glass={preset.glass}
        time={time}
      />

      <Dust spec={preset.dust} time={time} />

      {/* IBL does the heavy lifting; these just lift the shadow side. */}
      <ambientLight intensity={0.35 * preset.exposure} />
      <directionalLight position={[4, 6, 5]} intensity={0.9 * preset.exposure} />
      <directionalLight
        position={[-5, -2, 3]}
        intensity={0.35 * preset.exposure}
        color="#9fc8ff"
      />

      <Effects post={preset.post} resolutionScale={resolutionScale} />
    </>
  );
};
