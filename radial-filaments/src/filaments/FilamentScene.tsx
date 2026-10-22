import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Palette } from "./palettes";
import {
  BACKDROP_FRAGMENT,
  BACKDROP_VERTEX,
  POST_FRAGMENT,
  POST_VERTEX,
  FLOOR_FRAGMENT,
  FLOOR_VERTEX,
  STRAND_FRAGMENT,
  STRAND_VERTEX,
} from "./shaders";
import { buildStrandGeometry } from "./strands";

export type Vec3 = [number, number, number];

export type CameraState = {
  position: Vec3;
  target: Vec3;
  fovDeg: number;
  roll?: number; // radians
};

export type CameraRig = (frame: number, durationInFrames: number) => CameraState;

export type FieldLook = {
  strandWidth: number;
  minPixels: number;
  hump: number;
  wave: number;
  turbulence: number;
  intensity: number;
  floor: number;
  haze: number;
  hueSpin: number;
  bloom: number;
  longStrands: number;
  shortStrands: number;
};

export const DEFAULT_LOOK: FieldLook = {
  strandWidth: 0.0075,
  minPixels: 1.6,
  hump: 0.1,
  wave: 0.13,
  turbulence: 0.8,
  intensity: 0.9,
  floor: 0.2,
  haze: 1,
  hueSpin: 1,
  bloom: 0.45,
  longStrands: 1050,
  shortStrands: 220,
};

type Props = {
  palette: Palette;
  camera: CameraRig;
  look?: Partial<FieldLook>;
};

const BLOOM_LAYERS = [
  { divisor: 8, blur: 3, strength: 0.45 },
  { divisor: 16, blur: 6, strength: 0.4 },
  { divisor: 32, blur: 8, strength: 0.35 },
];

const RIM_RADIUS = 6.5;

type SceneState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  target: THREE.WebGLRenderTarget;
  post: THREE.Scene;
  postCamera: THREE.Camera;
  camera: THREE.PerspectiveCamera;
  uniforms: Record<string, THREE.IUniform>;
};

const createScene = (
  canvas: HTMLCanvasElement,
  look: FieldLook,
): SceneState => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.autoClear = true;
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  // Shared uniform objects so one update feeds every material.
  const uniforms: Record<string, THREE.IUniform> = {
    uPhase: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uColDeep: { value: new THREE.Color() },
    uColMid: { value: new THREE.Color() },
    uColA: { value: new THREE.Color() },
    uColB: { value: new THREE.Color() },
    uColHot: { value: new THREE.Color() },
    uBgTop: { value: new THREE.Color() },
    uBgHorizon: { value: new THREE.Color() },
    uHueSpin: { value: 1 },
    uWidth: { value: 0.01 },
    uMinPx: { value: 1.5 },
    uHump: { value: 0 },
    uWave: { value: 0 },
    uTurb: { value: 1 },
    uIntensity: { value: 1 },
    uFloor: { value: 1 },
    uHaze: { value: 1 },
    uCore: { value: new THREE.Vector2(0.5, 0.5) },
    uAspect: { value: 16 / 9 },
  };

  const scene = new THREE.Scene();

  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: BACKDROP_VERTEX,
      fragmentShader: BACKDROP_FRAGMENT,
      uniforms,
      depthTest: false,
      depthWrite: false,
    }),
  );
  backdrop.frustumCulled = false;
  backdrop.renderOrder = 0;
  scene.add(backdrop);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(RIM_RADIUS * 1.3, 160),
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FLOOR_VERTEX,
      fragmentShader: FLOOR_FRAGMENT,
      uniforms,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.05;
  floor.renderOrder = 1;
  scene.add(floor);

  const strands = new THREE.Mesh(
    buildStrandGeometry({
      longStrands: look.longStrands,
      shortStrands: look.shortStrands,
      segments: 140,
      rimRadius: RIM_RADIUS,
    }),
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: STRAND_VERTEX,
      fragmentShader: STRAND_FRAGMENT,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  strands.frustumCulled = false;
  strands.renderOrder = 2;
  scene.add(strands);

  // HDR buffer (multisampled) that the tone-mapping pass reads from.
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: 4,
    depthBuffer: false,
  });
  const post = new THREE.Scene();
  const postQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: POST_VERTEX,
      fragmentShader: POST_FRAGMENT,
      uniforms: {
        tScene: { value: target.texture },
        uWhiteMix: { value: 0.3 },
      },
      depthTest: false,
      depthWrite: false,
    }),
  );
  postQuad.frustumCulled = false;
  post.add(postQuad);

  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 100);
  return {
    renderer,
    scene,
    target,
    post,
    postCamera: new THREE.Camera(),
    camera,
    uniforms,
  };
};

export const FilamentScene: React.FC<Props> = ({ palette, camera, look }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SceneState | null>(null);
  const bloomRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const settings = useMemo(() => ({ ...DEFAULT_LOOK, ...look }), [look]);

  useEffect(() => {
    return () => {
      const state = stateRef.current;
      if (state) {
        state.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            (obj.material as THREE.Material).dispose();
          }
        });
        state.target.dispose();
        state.renderer.dispose();
        state.renderer.forceContextLoss();
      }
      stateRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const handle = delayRender("Rendering filament frame");
    const canvas = canvasRef.current!;
    if (!stateRef.current) {
      stateRef.current = createScene(canvas, settings);
    }
    const {
      renderer,
      scene,
      target,
      post,
      postCamera,
      camera: cam,
      uniforms: u,
    } = stateRef.current;
    renderer.setSize(width, height, false);
    target.setSize(width, height);

    const rig = camera(frame, durationInFrames);
    cam.fov = rig.fovDeg;
    cam.aspect = width / height;
    cam.position.set(...rig.position);
    cam.up.set(Math.sin(rig.roll ?? 0), Math.cos(rig.roll ?? 0), 0);
    cam.lookAt(...rig.target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    // Core position on screen, for the backdrop glow.
    const core = new THREE.Vector3(0, settings.hump, 0).project(cam);

    u.uPhase.value = frame / durationInFrames;
    (u.uRes.value as THREE.Vector2).set(width, height);
    (u.uColDeep.value as THREE.Color).setRGB(...palette.deep);
    (u.uColMid.value as THREE.Color).setRGB(...palette.mid);
    (u.uColA.value as THREE.Color).setRGB(...palette.tintA);
    (u.uColB.value as THREE.Color).setRGB(...palette.tintB);
    (u.uColHot.value as THREE.Color).setRGB(...palette.hot);
    (u.uBgTop.value as THREE.Color).setRGB(...palette.bgTop);
    (u.uBgHorizon.value as THREE.Color).setRGB(...palette.bgHorizon);
    u.uHueSpin.value = settings.hueSpin;
    u.uWidth.value = settings.strandWidth;
    u.uMinPx.value = settings.minPixels * (width / 3840) * 2;
    u.uHump.value = settings.hump;
    u.uWave.value = settings.wave;
    u.uTurb.value = settings.turbulence;
    u.uIntensity.value = settings.intensity * palette.exposure;
    u.uFloor.value = settings.floor;
    u.uHaze.value = settings.haze;
    (u.uCore.value as THREE.Vector2).set(core.x * 0.5 + 0.5, core.y * 0.5 + 0.5);
    u.uAspect.value = width / height;

    renderer.setRenderTarget(target);
    renderer.render(scene, cam);
    renderer.setRenderTarget(null);
    renderer.render(post, postCamera);
    renderer.getContext().finish();

    // Bloom: blurred low-resolution copies, screen-blended on top.
    BLOOM_LAYERS.forEach((layer, i) => {
      const target = bloomRefs.current[i];
      const ctx = target?.getContext("2d");
      if (!target || !ctx) {
        return;
      }
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.filter = `blur(${layer.blur}px)`;
      ctx.drawImage(canvas, 0, 0, target.width, target.height);
    });
    continueRender(handle);
  }, [frame, width, height, durationInFrames, camera, palette, settings]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width, height }} />
      {BLOOM_LAYERS.map((layer, i) => (
        <canvas
          key={layer.divisor}
          ref={(el) => {
            bloomRefs.current[i] = el;
          }}
          width={Math.round(width / layer.divisor)}
          height={Math.round(height / layer.divisor)}
          style={{
            position: "absolute",
            inset: 0,
            width,
            height,
            opacity: layer.strength * settings.bloom,
            mixBlendMode: "screen",
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
