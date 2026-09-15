import React, { useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

export type EnvLight = {
  /** Azimuth in degrees, 0 = +X, increasing towards +Z. */
  readonly azimuth: number;
  /** Elevation in degrees, +90 = straight up. */
  readonly elevation: number;
  /** Angular radius of the source, in degrees. */
  readonly size: number;
  readonly color: string;
  readonly intensity: number;
};

export type EnvSpec = {
  readonly top: string;
  readonly horizon: string;
  readonly bottom: string;
  readonly lights: readonly EnvLight[];
};

const RESOLUTION = 128;

const dirOf = (azimuthDeg: number, elevationDeg: number) => {
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const el = THREE.MathUtils.degToRad(elevationDeg);
  const c = Math.cos(el);
  return new THREE.Vector3(c * Math.cos(az), Math.sin(el), c * Math.sin(az));
};

/**
 * Builds an equirectangular HDR-ish environment in memory.
 *
 * Shipping a real .hdr would mean a network fetch at render time and a much
 * larger repo; these scenes only ever need a soft studio gradient plus two or
 * three broad sources, which is cheap to rasterise directly.
 */
const buildEquirect = (spec: EnvSpec): THREE.DataTexture => {
  const width = RESOLUTION * 2;
  const height = RESOLUTION;
  const data = new Float32Array(width * height * 4);

  const top = new THREE.Color(spec.top).convertSRGBToLinear();
  const horizon = new THREE.Color(spec.horizon).convertSRGBToLinear();
  const bottom = new THREE.Color(spec.bottom).convertSRGBToLinear();

  const lights = spec.lights.map((light) => ({
    dir: dirOf(light.azimuth, light.elevation),
    inner: Math.cos(THREE.MathUtils.degToRad(light.size * 0.35)),
    outer: Math.cos(THREE.MathUtils.degToRad(light.size)),
    color: new THREE.Color(light.color).convertSRGBToLinear(),
    intensity: light.intensity,
  }));

  const dir = new THREE.Vector3();
  const colour = new THREE.Color();

  for (let y = 0; y < height; y++) {
    const theta = ((y + 0.5) / height) * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    // 0 at the bottom of the sphere, 1 at the top.
    const vertical = cosTheta * 0.5 + 0.5;

    if (vertical > 0.5) {
      colour.copy(horizon).lerp(top, (vertical - 0.5) * 2);
    } else {
      colour.copy(bottom).lerp(horizon, vertical * 2);
    }
    const baseR = colour.r;
    const baseG = colour.g;
    const baseB = colour.b;

    for (let x = 0; x < width; x++) {
      const phi = ((x + 0.5) / width) * Math.PI * 2;
      dir.set(sinTheta * Math.cos(phi), cosTheta, sinTheta * Math.sin(phi));

      let r = baseR;
      let g = baseG;
      let b = baseB;
      for (const light of lights) {
        const d = dir.dot(light.dir);
        if (d <= light.outer) {
          continue;
        }
        const t = THREE.MathUtils.smoothstep(d, light.outer, light.inner);
        const w = t * t * light.intensity;
        r += light.color.r * w;
        g += light.color.g * w;
        b += light.color.b * w;
      }

      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 1;
    }
  }

  const texture = new THREE.DataTexture(
    data,
    width,
    height,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

/**
 * Installs a pre-filtered version of `spec` as `scene.environment`, so that
 * MeshPhysicalMaterial gets roughness-correct reflections without any external
 * HDRI. Never sets `scene.background` - every version paints its own backdrop.
 */
export const StudioEnvironment: React.FC<{
  readonly spec: EnvSpec;
  readonly intensity?: number;
}> = ({ spec, intensity = 1 }) => {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const source = useMemo(() => buildEquirect(spec), [spec]);

  useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();
    const target = pmrem.fromEquirectangular(source);
    scene.environment = target.texture;
    scene.environmentIntensity = intensity;
    pmrem.dispose();
    return () => {
      scene.environment = null;
      target.dispose();
    };
  }, [gl, scene, source, intensity]);

  useLayoutEffect(() => () => source.dispose(), [source]);

  return null;
};

/** A clean, neutral studio: broad key from above-front, cool fill from behind. */
export const WHITE_STUDIO: EnvSpec = {
  top: "#ffffff",
  horizon: "#c9d8e6",
  bottom: "#54657a",
  lights: [
    { azimuth: 40, elevation: 62, size: 46, color: "#ffffff", intensity: 2.6 },
    { azimuth: 215, elevation: 22, size: 64, color: "#cfe4ff", intensity: 1.1 },
    { azimuth: 130, elevation: -18, size: 70, color: "#9fb6cc", intensity: 0.4 },
  ],
};

/** Cooler, bluer room for the clinical / on-blue versions. */
export const BLUE_STUDIO: EnvSpec = {
  top: "#eaf5ff",
  horizon: "#9dc4e8",
  bottom: "#3d6187",
  lights: [
    { azimuth: 35, elevation: 58, size: 42, color: "#ffffff", intensity: 3.0 },
    { azimuth: 225, elevation: 18, size: 58, color: "#bfe0ff", intensity: 1.4 },
    { azimuth: 300, elevation: 40, size: 34, color: "#eaf6ff", intensity: 0.9 },
  ],
};

/** Near-black room lit only by hard rim sources - for the dark HUD scenes. */
export const DARK_STUDIO: EnvSpec = {
  top: "#0d1726",
  horizon: "#08101c",
  bottom: "#03060c",
  lights: [
    { azimuth: 55, elevation: 40, size: 26, color: "#8fd6ff", intensity: 3.4 },
    { azimuth: 245, elevation: 14, size: 30, color: "#5f8cff", intensity: 2.2 },
    { azimuth: 150, elevation: 70, size: 20, color: "#ffffff", intensity: 1.6 },
  ],
};
