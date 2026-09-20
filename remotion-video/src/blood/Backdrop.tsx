import { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { createGlowTexture, createTissueTexture } from "./assets";
import type { BackdropSpec, BloodLook, CoreGlowSpec } from "./looks";

/** Half-extents of the view frustum at a given distance from the lens. */
const frustumExtents = (distance: number, fov: number, aspect: number) => {
  const halfHeight = distance * Math.tan((fov * Math.PI) / 360);
  return { halfHeight, halfWidth: halfHeight * aspect };
};

/**
 * Far wall of tissue.
 *
 * This replaces the vessel tube an earlier version used. A tube has to be
 * either wide enough to contain the whole cell box — in which case its wall is
 * outside the frame and invisible — or narrower, in which case cells pass
 * straight through it. Neither is acceptable now that cells travel sideways as
 * well as in depth, so the wall became a plane that sits behind everything and
 * cannot be reached.
 */
export const Backdrop: React.FC<{ look: BloodLook; spec: BackdropSpec }> = ({ look, spec }) => {
  const { width, height } = useVideoConfig();
  const aspect = width / height;

  const mesh = useMemo(() => {
    const distance = look.depth + 6;
    const { halfWidth, halfHeight } = frustumExtents(distance, look.fov, aspect);

    const texture = createTissueTexture(spec.color, spec.mottle, look.id);
    const map = texture.clone();
    map.needsUpdate = true;
    map.generateMipmaps = false;
    map.minFilter = THREE.LinearFilter;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(spec.repeat[0], spec.repeat[1]);

    const material = new THREE.MeshBasicMaterial({
      map,
      color: new THREE.Color(spec.emissive).multiplyScalar(1 + spec.emissiveIntensity),
      toneMapped: true,
    });

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(halfWidth * 2.2, halfHeight * 2.2),
      material,
    );
    plane.position.z = -distance;
    plane.renderOrder = -3;
    return plane;
  }, [spec.color, spec.mottle, spec.repeat, spec.emissive, spec.emissiveIntensity, look.id, look.depth, look.fov, aspect]);

  useLayoutEffect(() => {
    return () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    };
  }, [mesh]);

  return <primitive object={mesh} />;
};

/**
 * The light in the scene behind the cells.
 *
 * A real object rather than a screen overlay, so cells correctly eclipse it as
 * they pass. `aspect` stretches it into a horizontal band and `offset` moves it
 * off centre — V2 wants a low, wide, barely-there glow sunk into the
 * background, V3 wants a bright white one up in the corner.
 */
export const CoreGlow: React.FC<{ look: BloodLook; spec: CoreGlowSpec }> = ({ look, spec }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const aspect = width / height;
  const meshRef = useRef<THREE.Mesh>(null);

  const mesh = useMemo(() => {
    const distance = look.depth - spec.inset;
    const extents = frustumExtents(distance, look.fov, aspect);

    const material = new THREE.MeshBasicMaterial({
      map: createGlowTexture(0.25),
      color: spec.color,
      transparent: true,
      opacity: spec.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      // Exempt from fog: this is a light source, and fogging it turns it into
      // a flat grey disc.
      fog: false,
    });

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(spec.size * spec.aspect, spec.size),
      material,
    );
    plane.position.set(
      spec.offset[0] * extents.halfWidth,
      spec.offset[1] * extents.halfHeight,
      -distance,
    );
    plane.renderOrder = -2;
    return plane;
  }, [spec.color, spec.opacity, spec.size, spec.aspect, spec.offset, spec.inset, look.depth, look.fov, aspect]);

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
    // A slow heartbeat-rate swell keeps the light from looking like a still.
    material.opacity = spec.opacity * (1 + spec.pulse * Math.sin(time * 1.15));
  }, [frame, fps, spec.opacity, spec.pulse]);

  return <primitive ref={meshRef} object={mesh} />;
};
