import React, { useMemo } from "react";
import * as THREE from "three";
import type { BackgroundSpec } from "./types";

/**
 * Enclosing gradient sphere.
 *
 * This lives inside the scene rather than as a CSS layer behind the canvas
 * precisely because the glass is transmissive: MeshPhysicalMaterial refracts
 * whatever is in the scene's transmission render target, so a DOM gradient
 * would refract as empty space and the spheres would read as plastic.
 *
 * The gradient is baked into a linear float DataTexture rather than drawn by a
 * ShaderMaterial. A raw shader would have to re-implement three's tone mapping
 * and output-colour-space chunks by hand to stay consistent with the PBR
 * materials next to it; letting MeshBasicMaterial do that is both correct and
 * one less shader to keep in sync.
 */

const WIDTH = 512;
const HEIGHT = 256;

const buildBackdropTexture = (
  spec: BackgroundSpec,
  exposure: number,
): THREE.DataTexture => {
  const top = new THREE.Color(spec.top);
  const mid = new THREE.Color(spec.mid);
  const bottom = new THREE.Color(spec.bottom);
  const glow = new THREE.Color(spec.glowColor);
  const glowDir = new THREE.Vector3(...spec.glowDir).normalize();

  const data = new Float32Array(WIDTH * HEIGHT * 4);
  const smoothstep = (t: number) => t * t * (3 - 2 * t);

  for (let row = 0; row < HEIGHT; row++) {
    // DataTexture ignores flipY, so row 0 is uv.y = 0. SphereGeometry writes
    // uv.y = 1 - v, hence v = 1 - uv.y and theta = v * PI.
    const uvY = (row + 0.5) / HEIGHT;
    const theta = (1 - uvY) * Math.PI;
    const sinTheta = Math.sin(theta);
    const dirY = Math.cos(theta);

    const t = dirY * 0.5 + 0.5;
    const base = new THREE.Color();
    if (t < 0.5) {
      base.copy(bottom).lerp(mid, smoothstep(t * 2));
    } else {
      base.copy(mid).lerp(top, smoothstep((t - 0.5) * 2));
    }

    for (let col = 0; col < WIDTH; col++) {
      const phi = ((col + 0.5) / WIDTH) * Math.PI * 2;
      const dirX = -Math.cos(phi) * sinTheta;
      const dirZ = Math.sin(phi) * sinTheta;

      const d = dirX * glowDir.x + dirY * glowDir.y + dirZ * glowDir.z;
      const g = d > 0 ? Math.pow(d, spec.glowSize) * spec.glowStrength : 0;

      const i = (row * WIDTH + col) * 4;
      data[i] = (base.r + glow.r * g) * exposure;
      data[i + 1] = (base.g + glow.g * g) * exposure;
      data[i + 2] = (base.b + glow.b * g) * exposure;
      data[i + 3] = 1;
    }
  }

  const texture = new THREE.DataTexture(
    data,
    WIDTH,
    HEIGHT,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
};

export const Backdrop: React.FC<{ spec: BackgroundSpec; exposure: number }> = ({
  spec,
  exposure,
}) => {
  const map = useMemo(() => buildBackdropTexture(spec, exposure), [spec, exposure]);

  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[80, 64, 40]} />
      <meshBasicMaterial map={map} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  );
};
