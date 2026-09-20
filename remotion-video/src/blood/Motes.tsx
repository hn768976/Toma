import { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { createGlowTexture } from "./assets";
import { cellPosition, normalizeDirection, sampleCells, type Volume } from "./flow";
import type { BloodLook, MoteSpec } from "./looks";

const scratch = new THREE.Object3D();
const scratchPosition = new THREE.Vector3();

/**
 * Plasma sparkle: fine specks of light carried along with the flow.
 *
 * These are light, not bodies, so they are allowed to overlap each other and
 * the cells. They are deliberately kept small and crisp — a mote wide enough to
 * read as a defocused disc would look like a blurred cell, which is exactly
 * what these versions must not contain.
 */
export const Motes: React.FC<{
  look: BloodLook;
  spec: MoteSpec;
  volume: Volume;
  seed: number;
}> = ({ look, spec, volume, seed }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const direction = useMemo(() => normalizeDirection(look.flowDirection), [look.flowDirection]);

  const motes = useMemo(
    () =>
      sampleCells({
        count: spec.count,
        seed,
        volume,
        size: spec.size,
        margin: 0,
        tumble: 0,
        color: spec.color,
        colorSpread: 0,
        enforceSpacing: false,
      }),
    [spec.count, spec.size, spec.color, seed, volume],
  );

  const mesh = useMemo(() => {
    const material = new THREE.MeshBasicMaterial({
      map: createGlowTexture(spec.softness),
      color: spec.color,
      transparent: true,
      opacity: spec.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const instanced = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      material,
      Math.max(1, spec.count),
    );
    instanced.frustumCulled = false;
    // Drawn after the cells so they read as light in front of the plasma.
    instanced.renderOrder = 2;
    return instanced;
  }, [spec.count, spec.color, spec.opacity, spec.softness]);

  useLayoutEffect(() => {
    return () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    };
  }, [mesh]);

  useLayoutEffect(() => {
    const instanced = meshRef.current;
    if (!instanced) {
      return;
    }
    const time = frame / fps;

    for (let i = 0; i < motes.length; i++) {
      const mote = motes[i];
      cellPosition(mote, time, direction, look.flowSpeed, volume, scratchPosition);
      scratch.position.copy(scratchPosition);
      scratch.rotation.set(0, 0, 0);
      scratch.scale.set(mote.size, mote.size, 1);
      scratch.updateMatrix();
      instanced.setMatrixAt(i, scratch.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
  }, [frame, fps, motes, direction, look.flowSpeed, volume]);

  return <primitive ref={meshRef} object={mesh} />;
};
