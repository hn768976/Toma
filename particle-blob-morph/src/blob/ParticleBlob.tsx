import { useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import { cubeSphereLattice } from "./lattice";
import type { BlobPalette } from "./palettes";
import {
  BG_FRAG,
  BG_VERT,
  DOT_FRAG,
  DOT_VERT,
  SKIN_FRAG,
  SKIN_VERT,
} from "./shaders";

export type ParticleBlobProps = {
  palette: BlobPalette;
};

/** Grid resolution of each cube face before it is projected onto the sphere. */
const DOTS_PER_CUBE_EDGE = 46; // 6 * 46 * 46 = 12,696 dots
/** World-space diameter of each dot (unit sphere radius = 1). */
const DOT_SIZE = 0.0256;
const CAMERA_FOV = 30;
const CAMERA_Z = 4.75;

type SceneHandle = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  bgScene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  bgCamera: THREE.Camera;
  uniforms: Record<string, THREE.IUniform>;
  dispose: () => void;
};

const buildScene = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  palette: BlobPalette,
  loopSeconds: number,
): SceneHandle => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.1, 100);
  camera.position.set(0, 0, CAMERA_Z);
  camera.lookAt(0, 0, 0);

  const pixelScale = height / (2 * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV) / 2));

  const uniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
    uLoop: { value: loopSeconds },
    uFold: { value: 1 },
    uRot: { value: new THREE.Matrix3() },
    uDotSize: { value: DOT_SIZE },
    uPixelScale: { value: pixelScale },
    uInset: { value: DOT_SIZE * 0.35 },
    uDot: { value: new THREE.Vector3(...palette.dot) },
    uHi: { value: new THREE.Vector3(...palette.highlight) },
    uRim: { value: new THREE.Vector3(...palette.rim) },
    uAmb: { value: new THREE.Vector3(...palette.ambient) },
    uSkin: { value: new THREE.Vector3(...palette.skin) },
  };

  const scene = new THREE.Scene();

  // Dots
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute("position", new THREE.BufferAttribute(cubeSphereLattice(DOTS_PER_CUBE_EDGE), 3));
  dotGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
  const dotMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: DOT_VERT,
    fragmentShader: DOT_FRAG,
    uniforms,
  });
  scene.add(new THREE.Points(dotGeo, dotMat));

  // Dark skin beneath the dots (seen in the gaps between them)
  const skinGeo = new THREE.SphereGeometry(1, 360, 180);
  skinGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
  const skinMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: SKIN_VERT,
    fragmentShader: SKIN_FRAG,
    side: THREE.DoubleSide,
    uniforms,
  });
  scene.add(new THREE.Mesh(skinGeo, skinMat));

  // Background studio sweep
  const bgScene = new THREE.Scene();
  const bgCamera = new THREE.Camera();
  const stops = palette.background;
  const bgMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: BG_VERT,
    fragmentShader: BG_FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uAspect: { value: width / height },
      uCenter: { value: new THREE.Vector2(-0.03, 0.02) },
      uStopPos: { value: stops.map((s) => s[0]) },
      uStopCol: { value: stops.map((s) => new THREE.Vector3(...s[1])) },
    },
  });
  const bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bgQuad.frustumCulled = false;
  bgScene.add(bgQuad);

  return {
    renderer,
    scene,
    bgScene,
    camera,
    bgCamera,
    uniforms,
    dispose: () => {
      dotGeo.dispose();
      dotMat.dispose();
      skinGeo.dispose();
      skinMat.dispose();
      bgMat.dispose();
      renderer.dispose();
    },
  };
};

/** Fold intensity: strongest at the loop seam, calm and pebble-like mid-loop. */
const foldEnvelope = (t: number, loop: number) => {
  const c = 0.5 + 0.5 * Math.cos((2 * Math.PI * t) / loop);
  return 0.1 + 0.9 * Math.pow(c, 1.3);
};

export const ParticleBlob: React.FC<ParticleBlobProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const [initHandle] = useState(() => delayRender("Initialising WebGL scene"));
  const loopSeconds = durationInFrames / fps;

  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    const handle = buildScene(canvasRef.current, width, height, palette, loopSeconds);
    sceneRef.current = handle;
    continueRender(initHandle);
    return () => {
      handle.dispose();
      sceneRef.current = null;
    };
  }, [width, height, palette, loopSeconds, initHandle]);

  useLayoutEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const t = frame / fps;
    const phase = t / loopSeconds;
    s.uniforms.uTime.value = t;
    s.uniforms.uFold.value = foldEnvelope(t, loopSeconds);
    // Tumble: one full turn per loop plus periodic pitch / roll wobble and a
    // gentle anisotropic squash (tall <-> wide). Everything is periodic in the
    // loop length, so the clip still loops seamlessly.
    const TAU = 2 * Math.PI;
    const squash = 0.09 * Math.sin(TAU * phase + 0.6);
    const rot = new THREE.Matrix4()
      .makeRotationZ(0.28 * Math.sin(TAU * phase * 2 + 1.0))
      .multiply(new THREE.Matrix4().makeScale(1 + squash, 1 - squash, 1))
      .multiply(new THREE.Matrix4().makeRotationX(0.3 + 0.55 * Math.sin(TAU * phase)))
      .multiply(new THREE.Matrix4().makeRotationY(-TAU * phase));
    (s.uniforms.uRot.value as THREE.Matrix3).setFromMatrix4(rot);
    s.renderer.clear();
    s.renderer.render(s.bgScene, s.bgCamera);
    s.renderer.render(s.scene, s.camera);
    s.renderer.getContext().finish();
  }, [frame, fps, loopSeconds]);

  return (
    <AbsoluteFill>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
