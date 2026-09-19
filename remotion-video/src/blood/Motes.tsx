import { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { createGlowTexture } from "./assets";
import { createFlowField, flowFade, flowZ, frustumRadius, wobbleOffset } from "./flow";
import type { BloodLook, MoteSpec } from "./looks";

const scratch = new THREE.Object3D();

/**
 * Plasma debris: the fine sparkle in the crimson reference and the wide
 * defocused bokeh discs in the ember one, which are the same thing at different
 * softness. Camera-facing quads with additive blending, one draw call.
 */
export const Motes: React.FC<{ look: BloodLook; spec: MoteSpec; seed: number }> = ({
  look,
  spec,
  seed,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const aspect = width / height;
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const particles = useMemo(
    () =>
      createFlowField({
        count: spec.count,
        seed,
        depth: look.depth,
        size: spec.size,
        tumble: 0,
        speedJitter: 0.5,
      }),
    [spec.count, spec.size, seed, look.depth],
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
    const instanced = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, spec.count);
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
    const speed = look.flowSpeed * spec.drift;

    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      const z = flowZ(particle, time, speed, look.depth);
      const [dx, dy] = wobbleOffset(particle, time, look.wobble * 1.6);
      // Defocus grows as a mote approaches the camera, the way a real shallow
      // depth of field swells out-of-focus highlights into discs.
      const nearness = Math.max(0, (z + look.depth) / look.depth);
      const scale =
        particle.size * flowFade(z, look.depth) * (1 + nearness * nearness * spec.softness * 5);

      const radius = frustumRadius(z, look.fov, aspect, look.fill * 1.1, Math.max(4, look.depth * 0.17));
      scratch.position.set(particle.x * radius + dx, particle.y * radius + dy, z);
      scratch.rotation.set(0, 0, 0);
      scratch.scale.set(scale, scale, 1);
      scratch.updateMatrix();
      instanced.setMatrixAt(i, scratch.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
  }, [frame, fps, particles, look.flowSpeed, look.depth, look.wobble, look.fov, look.fill, aspect, spec.drift, spec.softness]);

  return <primitive ref={meshRef} object={mesh} />;
};
