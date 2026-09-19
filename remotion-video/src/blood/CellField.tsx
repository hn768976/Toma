import { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { createCellEmissiveTexture } from "./assets";
import { createFlowField, flowFade, flowZ, frustumRadius, wobbleOffset } from "./flow";
import type { BloodLook } from "./looks";

type Props = {
  look: BloodLook;
  geometry: THREE.BufferGeometry;
  count: number;
  seed: number;
  /** Multiplier on cell size — used by the defocused foreground layer. */
  sizeScale?: number;
  /** Disc thickness as a fraction of diameter. The .glb is plumper than the
   * lathed cell, so the hero population squashes further to match. */
  thickness?: number;
  /** Restricts the population to the slice of the slab nearest the camera. */
  nearOnly?: boolean;
  /** Renders flat white on black for the alpha-matte pass. */
  matte?: boolean;
};

const scratch = new THREE.Object3D();

/**
 * A population of tumbling red blood cells drifting toward the camera.
 *
 * All instances share one draw call; positions are recomputed from scratch each
 * frame out of the deterministic flow field, so nothing depends on the previous
 * frame having been rendered.
 */
export const CellField: React.FC<Props> = ({
  look,
  geometry,
  count,
  seed,
  sizeScale = 1,
  thickness = 0.78,
  nearOnly = false,
  matte = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const aspect = width / height;
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const depth = nearOnly ? look.depth * 0.22 : look.depth;
  // Where the cone flattens off, as a fraction of the slab depth.
  const minDistance = Math.max(4, look.depth * 0.17);

  const particles = useMemo(
    () =>
      createFlowField({
        count,
        seed,
        depth,
        size: look.cellSize,
        tumble: look.tumble,
        speedJitter: 0.35,
        color: look.cellColor,
        colorSpread: look.cellColorSpread,
      }),
    [count, seed, look.cellSize, look.tumble, look.cellColor, look.cellColorSpread, depth],
  );

  const material = useMemo(() => {
    if (matte) {
      return new THREE.MeshBasicMaterial({ color: "#ffffff" });
    }
    // The emissive map carries both the ambient inner glow and the gold
    // speckles, so a single emissive slot covers both looks.
    const glow = new THREE.Color(look.cellEmissive).multiplyScalar(
      look.cellEmissiveIntensity * (0.55 + 0.45 * look.translucency),
    );
    return new THREE.MeshPhongMaterial({
      color: "#ffffff",
      emissive: "#ffffff",
      emissiveMap: createCellEmissiveTexture(glow.getStyle(), look.speckleColor, look.speckle),
      specular: new THREE.Color(look.specular).multiplyScalar(0.3 + 0.7 * look.translucency),
      shininess: look.shininess,
    });
  }, [
    matte,
    look.cellEmissive,
    look.cellEmissiveIntensity,
    look.translucency,
    look.speckleColor,
    look.speckle,
    look.specular,
    look.shininess,
  ]);

  const mesh = useMemo(() => {
    const instanced = new THREE.InstancedMesh(geometry, material, count);
    // Instances are repositioned every frame, so three's cached bounds are
    // always stale — culling them would drop cells at the edges of frame.
    instanced.frustumCulled = false;
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      color.copy(matte ? new THREE.Color("#ffffff") : particles[i].tint);
      instanced.setColorAt(i, color);
    }
    if (instanced.instanceColor) {
      instanced.instanceColor.needsUpdate = true;
    }
    return instanced;
  }, [geometry, material, count, particles, matte]);

  useLayoutEffect(() => {
    return () => {
      mesh.dispose();
      material.dispose();
    };
  }, [mesh, material]);

  // Layout effect, not effect: @remotion/three advances the renderer in a
  // passive effect, and layout effects flush first — so the matrices written
  // here are the ones that get drawn for this frame, not the previous one.
  useLayoutEffect(() => {
    const instanced = meshRef.current;
    if (!instanced) {
      return;
    }
    const time = frame / fps;
    const speed = look.flowSpeed * (nearOnly ? 1.35 : 1);

    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      const z = flowZ(particle, time, speed, depth) + (nearOnly ? 1.5 : 0);
      const [dx, dy] = wobbleOffset(particle, time, look.wobble);
      const fade = flowFade(z, depth);
      const radius = frustumRadius(
        z,
        look.fov,
        aspect,
        look.fill * (nearOnly ? 0.85 : 1),
        minDistance,
      );

      scratch.position.set(particle.x * radius + dx, particle.y * radius + dy, z);
      scratch.rotation.set(
        particle.rot[0] + time * particle.spin[0],
        particle.rot[1] + time * particle.spin[1],
        particle.rot[2] + time * particle.spin[2],
      );
      const scale = particle.size * sizeScale * fade;
      // Cells are discs: keep the face round and squash the thickness.
      scratch.scale.set(scale, scale, scale * thickness);
      scratch.updateMatrix();
      instanced.setMatrixAt(i, scratch.matrix);
    }

    instanced.instanceMatrix.needsUpdate = true;
  }, [frame, fps, particles, look.flowSpeed, look.wobble, look.fov, look.fill, aspect, sizeScale, thickness, depth, nearOnly, minDistance]);

  return <primitive ref={meshRef} object={mesh} />;
};
