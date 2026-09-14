import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { interpolate } from "remotion";
import type { CameraSpec, LayerSpec, MaterialSpec, Preset } from "./presets";
import { buildLayer, buildSpheres, instanceMatrixAt } from "./swarm";
import { createBacillusMaterial, createMatteMaterial } from "./BacillusMaterial";

type SwarmProps = {
  geometry: THREE.BufferGeometry;
  spec: LayerSpec;
  material: MaterialSpec;
  seed: number;
  layerIndex: number;
  seconds: number;
  matte: boolean;
};

const Swarm: React.FC<SwarmProps> = ({
  geometry,
  spec,
  material,
  seed,
  layerIndex,
  seconds,
  matte,
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const instances = useMemo(
    () => buildLayer(spec, seed, layerIndex),
    [spec, seed, layerIndex],
  );

  // The per-instance shader inputs never change over the clip, so they
  // are baked into the geometry once rather than re-uploaded per frame.
  const instancedGeometry = useMemo(() => {
    const clone = geometry.clone();
    const seeds = new Float32Array(instances.length);
    const shades = new Float32Array(instances.length);
    instances.forEach((instance, i) => {
      seeds[i] = instance.seed;
      shades[i] = instance.shade;
    });
    clone.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
    clone.setAttribute("aShade", new THREE.InstancedBufferAttribute(shades, 1));
    return clone;
  }, [geometry, instances]);

  const shaderMaterial = useMemo(
    () => (matte ? createMatteMaterial() : createBacillusMaterial(material)),
    [material, matte],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }
    const matrix = new THREE.Matrix4();
    instances.forEach((instance, i) => {
      instanceMatrixAt(instance, seconds, matrix);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    // Instances roam well outside the mesh's own bounds; without this
    // the whole batch gets frustum-culled from a single stale sphere.
    mesh.frustumCulled = false;
  }, [instances, seconds]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[instancedGeometry, shaderMaterial, instances.length]}
    />
  );
};

const Spheres: React.FC<{
  preset: Preset;
  seconds: number;
  matte: boolean;
}> = ({ preset, seconds, matte }) => {
  const spheres = useMemo(
    () => buildSpheres(preset.spheres.count, preset.spheres.size, preset.seed),
    [preset],
  );

  if (spheres.length === 0) {
    return null;
  }

  const tau = Math.PI * 2;

  return (
    <>
      {spheres.map((sphere, i) => (
        <mesh
          key={i}
          position={[
            sphere.base.x +
              sphere.driftAmp.x *
                Math.sin((tau * seconds) / sphere.driftPeriod.x + sphere.driftPhase.x),
            sphere.base.y +
              sphere.driftAmp.y *
                Math.sin((tau * seconds) / sphere.driftPeriod.y + sphere.driftPhase.y),
            sphere.base.z +
              sphere.driftAmp.z *
                Math.sin((tau * seconds) / sphere.driftPeriod.z + sphere.driftPhase.z),
          ]}
        >
          <sphereGeometry args={[sphere.radius, 20, 16]} />
          <meshBasicMaterial
            color={matte ? "#ffffff" : preset.spheres.color}
            transparent
            opacity={matte ? 1 : preset.spheres.opacity}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
};

const cameraAt = (camera: CameraSpec, progress: number) => ({
  position: [
    camera.panX * progress,
    camera.panY * progress,
    interpolate(progress, [0, 1], camera.z),
  ] as [number, number, number],
  fov: camera.fov,
});

export type LayerCanvasProps = {
  preset: Preset;
  geometry: THREE.BufferGeometry;
  layerIndex: number;
  width: number;
  height: number;
  seconds: number;
  progress: number;
  matte: boolean;
  /** Draw the loose spheres on this layer only, so they appear once. */
  withSpheres: boolean;
};

const SHARP_SUPERSAMPLE = 1.4;

/**
 * How many pixels a slice is actually worth drawing, as a multiplier on
 * the frame's own pixel ratio.
 *
 * A layer about to be pushed through a 20px CSS blur cannot show detail
 * finer than that blur, so drawing it at full frame resolution is spent
 * work -- and those slices carry the most instances. The in-focus slice
 * goes the other way: it is the only one ever seen sharp, so it is
 * drawn oversized and downsampled on the way out. That supersample
 * replaces MSAA, which under a software rasteriser costs several times
 * more than the entire rest of the frame.
 *
 * This has to ride on the pixel ratio rather than on the canvas
 * element's size: R3F measures its own container and sets the GL
 * viewport from that, so resizing the element underneath it leaves the
 * viewport and the drawing buffer disagreeing, and the scene gets
 * silently cropped to the difference.
 */
const resolutionFactor = (blurPx: number) => {
  if (blurPx >= 14) return 0.34;
  if (blurPx >= 7) return 0.5;
  if (blurPx >= 2) return 0.7;
  return SHARP_SUPERSAMPLE;
};

/**
 * The composition is authored at 4K and a 1080p deliverable comes off
 * it via `--scale=0.5`, which Remotion applies as the page's device
 * pixel ratio -- the layout stays in 4K CSS pixels either way. R3F
 * already defaults to that ratio, so the per-layer factor multiplies it
 * and both resolutions stay correct from one set of numbers.
 */
const useDevicePixelRatio = () => {
  if (typeof window === "undefined") {
    return 1;
  }
  const dpr = window.devicePixelRatio;
  if (!Number.isFinite(dpr) || dpr <= 0) {
    return 1;
  }
  return Math.min(2, Math.max(0.25, dpr));
};

/**
 * One depth slice, on its own canvas.
 *
 * Splitting the swarm across three canvases and blurring the far ones
 * in CSS buys real, cheap depth of field -- the soft-focus falloff that
 * every one of these references leans on -- without paying for a full
 * post-processing pass at 4K.
 */
export const LayerCanvas: React.FC<LayerCanvasProps> = ({
  preset,
  geometry,
  layerIndex,
  width,
  height,
  seconds,
  progress,
  matte,
  withSpheres,
}) => {
  const spec = preset.layers[layerIndex];
  const camera = cameraAt(preset.camera, progress);

  const dpr = useDevicePixelRatio() * resolutionFactor(spec.blurPx);

  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      camera={camera}
      gl={{ antialias: false, alpha: true, preserveDrawingBuffer: true }}
      style={{ position: "absolute", top: 0, left: 0, width, height }}
    >
      <Swarm
        geometry={geometry}
        spec={spec}
        material={preset.material}
        seed={preset.seed}
        layerIndex={layerIndex}
        seconds={seconds}
        matte={matte}
      />
      {withSpheres ? (
        <Spheres preset={preset} seconds={seconds} matte={matte} />
      ) : null}
    </ThreeCanvas>
  );
};


export type MatteCanvasProps = {
  preset: Preset;
  geometry: THREE.BufferGeometry;
  width: number;
  height: number;
  seconds: number;
  progress: number;
};

/**
 * The matte pass, as a single canvas.
 *
 * Depth of field is what forced the colour pass onto three separate
 * canvases; the matte has no defocus at all, so every slice can share
 * one context. The cells overlap into a single solid key exactly as
 * they should, and the pass costs a third of what three full-resolution
 * canvases did.
 */
export const MatteCanvas: React.FC<MatteCanvasProps> = ({
  preset,
  geometry,
  width,
  height,
  seconds,
  progress,
}) => {
  const camera = cameraAt(preset.camera, progress);
  const dpr = useDevicePixelRatio() * SHARP_SUPERSAMPLE;

  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      camera={camera}
      gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true }}
      style={{ position: "absolute", top: 0, left: 0, width, height }}
    >
      <color attach="background" args={["#000000"]} />
      {preset.layers.map((spec, index) => (
        <Swarm
          key={index}
          geometry={geometry}
          spec={spec}
          material={preset.material}
          seed={preset.seed}
          layerIndex={index}
          seconds={seconds}
          matte
        />
      ))}
      <Spheres preset={preset} seconds={seconds} matte />
    </ThreeCanvas>
  );
};
