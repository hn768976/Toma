import React, { useEffect, useLayoutEffect, useRef } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useDelayRender, useVideoConfig } from "remotion";
import {
  BloomEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
} from "postprocessing";
import * as THREE from "three";
import { GradeEffect, type GradeSettings } from "./GradeEffect";
import { MotionBlurEffect } from "./MotionBlurEffect";

export type Vec3 = [number, number, number];

/** Everything about the camera for one frame. Pure data, computed from the frame number. */
export type CameraState = {
  position: Vec3;
  target: Vec3;
  rollDeg: number;
  fovDeg: number;
  /** distance from the camera to the plane of sharp focus, world units */
  focusDistance: number;
};

export type LensSettings = {
  near: number;
  far: number;
  msaa: number;
  dof: { enabled: boolean; focusRange: number; bokehScale: number; resolutionScale: number };
  /** shutter is the open fraction of a frame (0.5 = 180 degrees) */
  motionBlur: { enabled: boolean; shutter: number; taps: number };
  bloom: {
    enabled: boolean;
    threshold: number;
    smoothing: number;
    intensity: number;
    radius: number;
    levels: number;
  };
};

/** A fully built, static scene. Only the camera moves. */
export type World = {
  root: THREE.Object3D;
  background: THREE.Color | null;
  fog: THREE.FogExp2 | null;
  /** rendered once into a PMREM environment map for image-based light */
  envScene: THREE.Scene | null;
  envIntensity: number;
  dispose: () => void;
};

/** camera as a function of a (fractional) frame number */
export type CameraPath = (frame: number) => CameraState;

type Rig = {
  render: (frame: number, path: CameraPath, width: number, height: number) => void;
  dispose: () => void;
};

const createRig = (
  gl: THREE.WebGLRenderer,
  world: World,
  lens: LensSettings,
  grade: GradeSettings,
): Rig => {
  // R3F's own render of its (empty) scene must not wipe our picture.
  gl.autoClear = false;
  gl.toneMapping = THREE.NoToneMapping;
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFShadowMap;
  // The scene is static: shadow maps are rendered exactly once.
  gl.shadowMap.autoUpdate = false;
  gl.shadowMap.needsUpdate = true;

  const scene = new THREE.Scene();
  scene.add(world.root);
  scene.background = world.background;
  scene.fog = world.fog;

  let envTarget: THREE.WebGLRenderTarget | null = null;
  if (world.envScene) {
    const pmrem = new THREE.PMREMGenerator(gl);
    envTarget = pmrem.fromScene(world.envScene, 0, 0.1, 500);
    pmrem.dispose();
    scene.environment = envTarget.texture;
    scene.environmentIntensity = world.envIntensity;
  }

  const camera = new THREE.PerspectiveCamera(30, 16 / 9, lens.near, lens.far);

  const composer = new EffectComposer(gl, {
    multisampling: lens.msaa,
    frameBufferType: THREE.HalfFloatType,
    stencilBuffer: false,
  });
  composer.addPass(new RenderPass(scene, camera));

  const dof = new DepthOfFieldEffect(camera, {
    focusDistance: 1,
    focusRange: lens.dof.focusRange,
    bokehScale: lens.dof.bokehScale,
    resolutionScale: lens.dof.resolutionScale,
  });
  const bloom = new BloomEffect({
    mipmapBlur: true,
    luminanceThreshold: lens.bloom.threshold,
    luminanceSmoothing: lens.bloom.smoothing,
    intensity: lens.bloom.intensity,
    radius: lens.bloom.radius,
    levels: lens.bloom.levels,
  });
  const gradeFx = new GradeEffect(grade);

  const motion = new MotionBlurEffect(lens.motionBlur.taps);
  if (lens.dof.enabled) composer.addPass(new EffectPass(camera, dof));
  if (lens.motionBlur.enabled) composer.addPass(new EffectPass(camera, motion));
  const tail = lens.bloom.enabled ? [bloom, gradeFx] : [gradeFx];
  composer.addPass(new EffectPass(camera, ...tail));

  const up = new THREE.Vector3(0, 1, 0);
  const target = new THREE.Vector3();
  let sizeKey = "";
  const place = (cam: CameraState, width: number, height: number) => {
    camera.fov = cam.fovDeg;
    camera.aspect = width / height;
    camera.near = lens.near;
    camera.far = lens.far;
    camera.position.set(...cam.position);
    camera.up.copy(up);
    camera.lookAt(target.set(...cam.target));
    camera.rotateZ(THREE.MathUtils.degToRad(cam.rollDeg));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  };
  const viewProj = (out: THREE.Matrix4) =>
    out.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const mPrev = new THREE.Matrix4();
  const mNext = new THREE.Matrix4();
  const mInv = new THREE.Matrix4();

  return {
    render: (frame, path, width, height) => {
      const cam = path(frame);
      const key = `${width}x${height}@${gl.getPixelRatio()}`;
      if (key !== sizeKey) {
        sizeKey = key;
        composer.setSize(width, height, false);
      }
      const bufferHeight = gl.getDrawingBufferSize(new THREE.Vector2()).y;

      // shutter-open and shutter-close cameras first, then the frame's own camera
      const half = lens.motionBlur.shutter / 2;
      place(path(frame - half), width, height);
      viewProj(mPrev);
      place(path(frame + half), width, height);
      viewProj(mNext);
      place(cam, width, height);
      mInv.copy(viewProj(new THREE.Matrix4())).invert();
      motion.setMatrices(mInv, mPrev, mNext, frame);

      // blur sizes are defined at 1080p and scale with the buffer, so 4K looks the same
      const resScale = bufferHeight / 1080;
      dof.cocMaterial.adoptCameraSettings(camera);
      dof.cocMaterial.focusDistance = cam.focusDistance;
      dof.cocMaterial.focusRange = lens.dof.focusRange;
      dof.bokehScale = lens.dof.bokehScale * resScale;
      gradeFx.setFrame(frame);

      // fixed delta: nothing in the chain may depend on wall-clock time
      composer.render(1 / 30);
    },
    dispose: () => {
      composer.dispose();
      envTarget?.dispose();
      scene.remove(world.root);
    },
  };
};

type PipelineProps = {
  world: World;
  /** camera path; must be a stable function (module level), it is called with fractional frames */
  camera: CameraPath;
  lens: LensSettings;
  grade: GradeSettings;
  frame: number;
};

/**
 * Renders the world through the post chain, once per Remotion frame, from an
 * effect keyed on the frame number. No useFrame, no requestAnimationFrame, no
 * clock: the picture is a pure function of `frame`.
 */
const Pipeline: React.FC<PipelineProps> = ({ world, camera, lens, grade, frame }) => {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const { delayRender, continueRender } = useDelayRender();
  const rig = useRef<Rig | null>(null);
  const hold = useRef<number | null>(null);

  // Hold the frame until our own render below has finished.
  useLayoutEffect(() => {
    hold.current = delayRender(`Rendering 3D frame ${frame}`);
    return () => {
      if (hold.current !== null) {
        continueRender(hold.current);
        hold.current = null;
      }
    };
  }, [frame, delayRender, continueRender, gl, world, lens, grade, camera, size]);

  useEffect(() => {
    const r = createRig(gl as unknown as THREE.WebGLRenderer, world, lens, grade);
    rig.current = r;
    return () => {
      r.dispose();
      rig.current = null;
    };
  }, [gl, world, lens, grade]);

  useEffect(() => {
    rig.current?.render(frame, camera, size.width, size.height);
    if (hold.current !== null) {
      continueRender(hold.current);
      hold.current = null;
    }
  }, [frame, camera, size, gl, world, lens, grade, continueRender]);

  return null;
};

export const Stage: React.FC<PipelineProps> = (props) => {
  const { width, height } = useVideoConfig();
  // --scale=0.5 gives devicePixelRatio 0.5: the GL buffer is then 1920x1080.
  const dpr = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio, 1);
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      flat
      gl={{
        antialias: false,
        alpha: false,
        stencil: false,
        depth: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      }}
      style={{ backgroundColor: "#000" }}
    >
      <Pipeline {...props} />
    </ThreeCanvas>
  );
};
