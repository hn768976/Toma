import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SKY_SHOTS, SkyShotId } from "./cameraPaths";
import { SKY_FRAGMENT, SKY_VERTEX } from "./shaders";
import { SkyPalette } from "./palettes";

// Colours are authored as display (sRGB) values and written straight to the
// canvas, so disable three's linear-workflow conversion.
THREE.ColorManagement.enabled = false;

type SceneState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sky: THREE.ShaderMaterial;
};

const deg = Math.PI / 180;

const createScene = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): SceneState => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    preserveDrawingBuffer: true,
    alpha: false,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 10);
  camera.rotation.order = "YXZ";

  // full-screen triangle; the fragment shader ray-casts the sky dome
  const skyGeo = new THREE.BufferGeometry();
  skyGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  );
  const sky = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uInvProj: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      uMoonDir: { value: new THREE.Vector3() },
      uMoonRadius: { value: 0.1 },
      uPixelAngle: { value: 0.001 },
      uTime: { value: 0 },
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uLowSky: { value: new THREE.Color() },
      uMilkyWay: { value: new THREE.Color() },
      uMilkyWayNormal: { value: new THREE.Vector3() },
      uMoonGlow: { value: new THREE.Color() },
      uMoonLight: { value: new THREE.Color() },
      uMoonShadow: { value: new THREE.Color() },
    },
  });
  const skyMesh = new THREE.Mesh(skyGeo, sky);
  skyMesh.frustumCulled = false;
  scene.add(skyMesh);

  return { renderer, scene, camera, sky };
};

export type MoonlitSkyProps = {
  shotId: SkyShotId;
  palette: SkyPalette;
};

export const MoonlitSky: React.FC<MoonlitSkyProps> = ({ shotId, palette }) => {
  const shot = SKY_SHOTS[shotId];
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SceneState | null>(null);

  useLayoutEffect(() => {
    return () => {
      stateRef.current?.renderer.dispose();
      stateRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!stateRef.current) {
      stateRef.current = createScene(canvas, width, height);
    }
    const s = stateRef.current;
    const t = frame / fps;
    const pose = shot.pose(t, durationInFrames / fps);

    const cam = s.camera;
    cam.fov = pose.fovY;
    cam.aspect = width / height;
    cam.rotation.set(pose.pitch, -pose.yaw, -pose.roll);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);

    const az = shot.moonAzimuth * deg;
    const el = shot.moonElevation * deg;
    const moonDir = new THREE.Vector3(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      -Math.cos(az) * Math.cos(el),
    ).normalize();

    const su = s.sky.uniforms;
    su.uInvProj.value.copy(cam.projectionMatrixInverse);
    su.uCamWorld.value.copy(cam.matrixWorld);
    su.uMoonDir.value.copy(moonDir);
    su.uMoonRadius.value = palette.moonRadiusDeg * deg;
    su.uPixelAngle.value = (2 * Math.tan((pose.fovY * deg) / 2)) / height;
    su.uTime.value = t;
    su.uZenith.value.set(palette.zenith);
    su.uHorizon.value.set(palette.horizon);
    su.uLowSky.value.set(palette.lowSky);
    su.uMilkyWay.value.set(palette.milkyWay);
    // milky way band runs from the upper left down towards the moon
    const mwA = new THREE.Vector3().setFromSphericalCoords(1, (90 - 19) * deg, (180 + 45) * deg);
    const mwB = new THREE.Vector3().setFromSphericalCoords(1, (90 - 2) * deg, (180 - 25) * deg);
    su.uMilkyWayNormal.value.crossVectors(mwA, mwB).normalize();
    su.uMoonGlow.value.set(palette.moonGlow);
    su.uMoonLight.value.set(palette.moonLight);
    su.uMoonShadow.value.set(palette.moonShadow);

    s.renderer.render(s.scene, cam);
    s.renderer.getContext().finish();
  }, [frame, fps, width, height, durationInFrames, shot, palette]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
