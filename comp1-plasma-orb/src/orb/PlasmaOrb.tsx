import { useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CameraPose, orbitCamera, staticCamera } from "./camera";
import { CYAN_PLASMA, Palette } from "./palette";
import { buildDust, buildMotes, buildSparks, buildStrands } from "./particles";
import {
  COMPOSITE_FRAG,
  FULLSCREEN_VERT,
  POINTS_FRAG,
  POINTS_VERT,
  VOLUME_FRAG,
} from "./shaders";

export type PlasmaOrbProps = {
  variant: "match" | "orbit";
};

type Engine = {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  volumeRT: THREE.WebGLRenderTarget;
  pointsRT: THREE.WebGLRenderTarget;
  // Second set of targets for the loop crossfade (scene state one loop earlier).
  volumeRT2: THREE.WebGLRenderTarget;
  pointsRT2: THREE.WebGLRenderTarget;
  compositeMat: THREE.ShaderMaterial;
  volumeScene: THREE.Scene;
  pointsScene: THREE.Scene;
  compositeScene: THREE.Scene;
  quadCamera: THREE.Camera;
  volumeMat: THREE.ShaderMaterial;
  pointMats: THREE.ShaderMaterial[];
  dispose: () => void;
};

const fullscreenQuad = (material: THREE.Material) => {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  return mesh;
};

const createEngine = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  palette: Palette,
): Engine => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.05, 100);

  // The emissive gas is low-frequency; marching it at half resolution and
  // upsampling bilinearly is visually identical and 4x cheaper.
  const volumeRT = new THREE.WebGLRenderTarget(width / 2, height / 2, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });
  const pointsRT = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });
  const volumeRT2 = volumeRT.clone();
  const pointsRT2 = pointsRT.clone();

  const quadCamera = new THREE.Camera();

  const volumeMat = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: VOLUME_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uInvViewProj: { value: new THREE.Matrix4() },
      uResolution: { value: new THREE.Vector2(width / 2, height / 2) },
    },
    depthTest: false,
    depthWrite: false,
  });
  const volumeScene = new THREE.Scene();
  volumeScene.add(fullscreenQuad(volumeMat));

  const focalPx = (fov: number) => (height / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const pointsScene = new THREE.Scene();
  const layers: [THREE.BufferGeometry, number][] = [
    [buildDust(480), 3],
    [buildMotes(420), 0],
    [buildStrands(26, 300), 1],
    [buildSparks(600), 2],
  ];
  const pointMats = layers.map(([geometry, layer]) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: POINTS_VERT,
      fragmentShader: POINTS_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uLayer: { value: layer },
        uFocalPx: { value: focalPx(50) },
        uMaxSize: { value: 64 * (height / 2160) },
      },
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    const pts = new THREE.Points(geometry, mat);
    pts.frustumCulled = false;
    pointsScene.add(pts);
    return mat;
  });

  const compositeMat = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: COMPOSITE_FRAG,
    uniforms: {
      uVolume: { value: volumeRT.texture },
      uPoints: { value: pointsRT.texture },
      uVolumeB: { value: volumeRT2.texture },
      uPointsB: { value: pointsRT2.texture },
      uMix: { value: 0 },
      uGain: { value: 1 },
      uFrame: { value: 0 },
      uRamp: {
        value: palette.colors.map(
          ([r, g, b]) => new THREE.Vector3(r / 255, g / 255, b / 255),
        ),
      },
      uStops: { value: palette.stops },
      uExposure: { value: 1.15 },
      uHotColor: {
        value: new THREE.Vector3(...palette.hot.map((c) => c / 255)),
      },
    },
    depthTest: false,
    depthWrite: false,
  });
  const compositeScene = new THREE.Scene();
  compositeScene.add(fullscreenQuad(compositeMat));

  return {
    renderer,
    camera,
    volumeRT,
    pointsRT,
    volumeRT2,
    pointsRT2,
    compositeMat,
    volumeScene,
    pointsScene,
    compositeScene,
    quadCamera,
    volumeMat,
    pointMats,
    dispose: () => {
      volumeRT.dispose();
      pointsRT.dispose();
      volumeRT2.dispose();
      pointsRT2.dispose();
      [volumeScene, pointsScene, compositeScene].forEach((s) =>
        s.traverse((o) => {
          if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
            o.geometry.dispose();
            (o.material as THREE.Material).dispose();
          }
        }),
      );
      renderer.dispose();
    },
  };
};

const applyCamera = (engine: Engine, pose: CameraPose) => {
  const { camera } = engine;
  camera.fov = pose.fov;
  camera.position.set(...pose.position);
  camera.up.set(Math.sin(pose.roll), Math.cos(pose.roll), 0);
  camera.lookAt(new THREE.Vector3(...pose.target));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
};

/** Time-scale relative to real time; tuned so the churn speed matches the reference. */
const SPEED = 1.4;

/**
 * Slow "breathing" of the plasma brightness, as in the reference. Every term
 * completes whole cycles over the clip so the loop stays seamless.
 */
const pulse = (t01: number) =>
  1 +
  0.24 * Math.sin(2 * Math.PI * 2 * t01 + 0.6) +
  0.1 * Math.sin(2 * Math.PI * 5 * t01 + 2.1) +
  0.05 * Math.sin(2 * Math.PI * 9 * t01 + 4.0);

const renderScene = (
  engine: Engine,
  time: number,
  volumeRT: THREE.WebGLRenderTarget,
  pointsRT: THREE.WebGLRenderTarget,
) => {
  const { renderer, camera } = engine;
  engine.volumeMat.uniforms.uTime.value = time;
  for (const m of engine.pointMats) {
    m.uniforms.uTime.value = time;
  }
  renderer.setRenderTarget(volumeRT);
  renderer.clear();
  renderer.render(engine.volumeScene, engine.quadCamera);
  renderer.setRenderTarget(pointsRT);
  renderer.clear();
  renderer.render(engine.pointsScene, camera);
};

type FrameParams = {
  time: number;
  /** When > 0, crossfade towards the scene state at `loopTime`. */
  loopMix: number;
  loopTime: number;
  gain: number;
  frame: number;
};

const renderFrame = (engine: Engine, pose: CameraPose, p: FrameParams) => {
  const { renderer, camera } = engine;
  applyCamera(engine, pose);

  const viewProj = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  );
  engine.volumeMat.uniforms.uCamPos.value.copy(camera.position);
  engine.volumeMat.uniforms.uInvViewProj.value.copy(viewProj).invert();

  renderer.setClearColor(0x000000, 1);
  renderScene(engine, p.time, engine.volumeRT, engine.pointsRT);
  if (p.loopMix > 0) {
    renderScene(engine, p.loopTime, engine.volumeRT2, engine.pointsRT2);
  }
  engine.compositeMat.uniforms.uMix.value = p.loopMix;
  engine.compositeMat.uniforms.uGain.value = p.gain;
  engine.compositeMat.uniforms.uFrame.value = p.frame;

  renderer.setRenderTarget(null);
  renderer.clear();
  renderer.render(engine.compositeScene, engine.quadCamera);
  renderer.getContext().finish();
};

/** Frames over which V1 crossfades into its own start so the clip loops. */
const LOOP_FADE_FRAMES = 36;

export const PlasmaOrb: React.FC<PlasmaOrbProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [initHandle] = useState(() => delayRender("Initialising WebGL"));

  // Layout effects run in declaration order, so the engine exists before the
  // per-frame render effect below runs on the very first commit.
  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    engineRef.current = createEngine(canvasRef.current, width, height, CYAN_PLASMA);
    continueRender(initHandle);
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [width, height, initHandle]);

  useLayoutEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const handle = delayRender(`Rendering frame ${frame}`);
    const pose =
      variant === "orbit" ? orbitCamera(frame, durationInFrames) : staticCamera();
    const t01 = frame / durationInFrames;
    // V1 matches the looping reference: over the last frames, crossfade to the
    // scene state one loop earlier, so the last frame flows into frame 0.
    const fadeStart = durationInFrames - LOOP_FADE_FRAMES;
    const x = variant === "match" ? Math.max(0, (frame - fadeStart + 1) / LOOP_FADE_FRAMES) : 0;
    const loopMix = x * x * (3 - 2 * x);
    renderFrame(engine, pose, {
      time: (SPEED * frame) / fps,
      loopTime: (SPEED * (frame - durationInFrames)) / fps,
      loopMix,
      gain: pulse(t01),
      frame,
    });
    continueRender(handle);
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
