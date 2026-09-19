import { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { createGlowTexture, createVesselTexture } from "./assets";
import type { BloodLook, CoreGlowSpec, VesselSpec } from "./looks";

/**
 * The vessel wall: a long open cylinder seen from the inside, with its
 * silhouette rippled so the tube has rings of light running down it rather
 * than reading as a clean CG pipe.
 */
const createTubeGeometry = (radius: number, length: number, ribs: number) => {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 56, 40, true);
  if (ribs > 0) {
    const position = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      const r = Math.hypot(x, z);
      if (r === 0) {
        continue;
      }
      const ripple =
        1 + ribs * 0.06 * (Math.sin(y * 0.55) + 0.6 * Math.sin(y * 1.7 + 1.3) + 0.35 * Math.sin(y * 4.1));
      position.setX(i, x * ripple);
      position.setZ(i, z * ripple);
    }
    position.needsUpdate = true;
  }
  // Cylinders are built along +Y; lay it down the Z axis to become a tunnel.
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
};

export const Vessel: React.FC<{ look: BloodLook; spec: VesselSpec }> = ({ look, spec }) => {
  // Long enough that the far opening sits well past the fog's extinction
  // distance. A shorter tube ends inside the shot, and the dark background
  // showing through that opening reads as a hard-edged disc behind the core
  // glow — the tunnel has to fade out, not stop.
  const length = look.depth * 3;

  const mesh = useMemo(() => {
    const texture = createVesselTexture(spec.color, spec.mottle, look.id);
    const map = texture.clone();
    map.needsUpdate = true;
    map.generateMipmaps = false;
    map.minFilter = THREE.LinearFilter;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(spec.repeat[0], spec.repeat[1]);

    const material = new THREE.MeshPhongMaterial({
      map,
      color: "#ffffff",
      emissive: new THREE.Color(spec.emissive).multiplyScalar(spec.emissiveIntensity),
      emissiveMap: map,
      side: THREE.BackSide,
      shininess: 8,
      specular: "#3a0a08",
    });

    const tube = new THREE.Mesh(createTubeGeometry(spec.radius, length, spec.ribs), material);
    tube.position.z = -(length / 2) + 8;
    tube.renderOrder = -1;
    return tube;
  }, [spec.color, spec.mottle, spec.repeat, spec.emissive, spec.emissiveIntensity, spec.radius, spec.ribs, length, look.id]);

  useLayoutEffect(() => {
    return () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    };
  }, [mesh]);

  return <primitive object={mesh} />;
};

/**
 * The bright core at the far end of the tunnel — the light the flow is heading
 * toward. A real object in the scene rather than a screen overlay, so cells
 * correctly eclipse it as they pass.
 */
export const CoreGlow: React.FC<{ look: BloodLook; spec: CoreGlowSpec }> = ({ look, spec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const meshRef = useRef<THREE.Mesh>(null);

  const mesh = useMemo(() => {
    const material = new THREE.MeshBasicMaterial({
      map: createGlowTexture(0.25),
      color: spec.color,
      transparent: true,
      opacity: spec.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      // Exempt from fog: this is the light source the tunnel recedes toward,
      // and fogging it flattens it into a grey disc.
      fog: false,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(spec.size, spec.size), material);
    plane.position.z = -look.depth + spec.inset;
    plane.renderOrder = -2;
    return plane;
  }, [spec.color, spec.opacity, spec.size, spec.inset, look.depth]);

  useLayoutEffect(() => {
    return () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    };
  }, [mesh]);

  useLayoutEffect(() => {
    if (!meshRef.current) {
      return;
    }
    const time = frame / fps;
    const material = meshRef.current.material as THREE.MeshBasicMaterial;
    // A slow heartbeat-rate swell keeps the core from looking like a still.
    material.opacity = spec.opacity * (1 + spec.pulse * Math.sin(time * 1.15));
  }, [frame, fps, spec.opacity, spec.pulse]);

  return <primitive ref={meshRef} object={mesh} />;
};
