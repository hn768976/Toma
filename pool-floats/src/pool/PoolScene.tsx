import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import type { RGB, SceneConfig } from "./config";
import { RING_FLATTEN, RING_R, RING_r } from "./config";
import { cameraPose, ringPose } from "./motion";
import { FLOAT_FRAGMENT, FLOAT_VERTEX, WATER_FRAGMENT, WATER_VERTEX } from "./shaders";

/** sRGB 0-255 -> linear 0-1 */
const lin = (c: RGB) =>
  new THREE.Vector3(...c.map((v) => Math.pow(v / 255, 2.2)) as [number, number, number]);

const SUN_DIR = new THREE.Vector3(0.13, 1.0, -1.4).normalize();
const LIGHT_POS = new THREE.Vector3(5.5, 60.0, -67.0);

type SceneHandles = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  ring: THREE.Mesh;
  uniforms: Record<string, THREE.IUniform>;
  dispose: () => void;
};

const buildScene = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  config: SceneConfig,
): SceneHandles => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const p = config.palette;
  // shared uniform objects: both materials reference the same instances
  const uniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
    uCam: { value: new THREE.Vector3() },
    uSunDir: { value: SUN_DIR.clone() },
    uLightPos: { value: LIGHT_POS.clone() },
    uRing: { value: new THREE.Matrix4() },
    uRingInv: { value: new THREE.Matrix4() },
    uKind: { value: config.kind === "stripes" ? 0 : 1 },
    uFloatA: { value: lin(p.floatA) },
    uFloatB: { value: lin(p.floatB) },
    uFloatC: { value: lin(p.floatC) },
    uSeeds: { value: lin(p.seeds) },
    uSky: { value: lin(p.sky) },
    uWaterTint: { value: lin(p.waterTint) },
    uFloorLit: { value: lin(p.floorLit) },
    uFloorDark: { value: lin(p.floorDark) },
    uShadow: { value: lin(p.shadow) },
    uCaustic: { value: lin(p.caustic) },
    uCausticGain: { value: 0.7 },
  };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 200);

  const waterMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    vertexShader: WATER_VERTEX,
    fragmentShader: WATER_FRAGMENT,
  });
  const waterGeo = new THREE.PlaneGeometry(90, 90, 1, 1);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, waterMat);
  scene.add(water);

  const ringGeo = new THREE.TorusGeometry(RING_R, RING_r, 96, 320);
  ringGeo.rotateX(-Math.PI / 2); // lie flat: local Y is up, matching the GLSL SDF
  const ringMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    vertexShader: FLOAT_VERTEX,
    fragmentShader: FLOAT_FRAGMENT,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  scene.add(ring);

  return {
    renderer,
    scene,
    camera,
    ring,
    uniforms,
    dispose: () => {
      waterGeo.dispose();
      ringGeo.dispose();
      waterMat.dispose();
      ringMat.dispose();
      renderer.dispose();
    },
  };
};

export const PoolScene: React.FC<{ config: SceneConfig }> = ({ config }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [handles, setHandles] = useState<SceneHandles | null>(null);

  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    const h = buildScene(canvasRef.current, width, height, config);
    setHandles(h);
    return () => h.dispose();
  }, [width, height, config]);

  useLayoutEffect(() => {
    if (!handles) return;
    const t = frame / fps;
    const { renderer, scene, camera, ring, uniforms } = handles;

    const pose = ringPose(t);
    ring.position.copy(pose.position);
    ring.quaternion.copy(pose.quaternion);
    ring.scale.set(1, RING_FLATTEN, 1);
    ring.updateMatrixWorld(true);

    const cam = cameraPose(config.camera, t);
    camera.fov = cam.fov;
    camera.aspect = width / height;
    camera.position.copy(cam.position);
    camera.lookAt(cam.target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    uniforms.uTime.value = t;
    (uniforms.uCam.value as THREE.Vector3).copy(cam.position);
    (uniforms.uRing.value as THREE.Matrix4).copy(ring.matrixWorld);
    (uniforms.uRingInv.value as THREE.Matrix4).copy(ring.matrixWorld).invert();

    renderer.render(scene, camera);
  }, [handles, frame, fps, width, height, config]);

  // surface GL errors in the render log instead of silently producing black frames
  useEffect(() => {
    if (!handles) return;
    const gl = handles.renderer.getContext();
    const err = gl.getError();
    if (err !== gl.NO_ERROR) {
      console.error("WebGL error", err);
    }
  }, [handles, frame]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#7cc4ec" }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
