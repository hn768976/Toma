import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { FieldParams, heightAt } from "./field";
import { DOF_FRAGMENT, DOF_VERTEX } from "./dof";

export const pinFieldSchema = z.object({
  camera: z.enum(["reference", "orbit-crane"]),
  /** Frames per full travel of the wave pattern (seamless loop length). */
  loopFrames: z.number().int().positive(),
  /** Optional overrides of LOOK values (look development only). */
  tune: z.record(z.string(), z.number()).optional(),
});
export type PinFieldProps = z.infer<typeof pinFieldSchema>;

// ---------------------------------------------------------------------------
// Look constants (tuned against the reference)
// ---------------------------------------------------------------------------
const GRID = 130; // pins per side
const SPACING = 1;

/** All tunable look values (tuned against the reference). */
const LOOK = {
  // Pins
  minRadius: 0.1, // flat pins read as small dots on the plate
  maxRadius: 0.5,
  minLength: 0.25, // flat pins: tiny heads on short stubs
  maxLength: 1.5, // stalk length of fully raised pins
  stalkRatio: 0.95, // stalk radius relative to head radius
  minStalk: 0.035,
  // Height field
  wavelength: 20,
  direction: 0.35,
  warp: 1.0,
  warpScale: 18,
  rippleX: -55,
  rippleY: 35,
  rippleWavelength: 40,
  rippleMix: 0.45,
  rippleSpeed: 1.5,
  edge0: 0.24,
  edge1: 0.5,
  cycles: 2, // band periods per loop (integer); ripple does cycles x rippleSpeed = 3,
  // so the combined pattern only repeats every full loop (gcd(2, 3) = 1)
  ease: 0.4, // speed modulation within each loop (0 = constant speed)
  // Reference camera (Version 1)
  distance: 30,
  elevationDeg: 37,
  azimuthDeg: 0,
  rollDeg: 62,
  fov: 32,
  focus: 27,
  targetX: 0,
  targetZ: 0,
  // Rendering
  exposure: 1.35,
  focusRange: 12,
  maxBlur: 18, // px at 2160p
};
type Look = typeof LOOK;

const fieldFrom = (L: Look): FieldParams => ({
  wavelength: L.wavelength,
  direction: L.direction,
  warp: L.warp,
  warpScale: L.warpScale,
  rippleCenter: [L.rippleX, L.rippleY],
  rippleWavelength: L.rippleWavelength,
  rippleMix: L.rippleMix,
  rippleSpeed: L.rippleSpeed,
  edge0: L.edge0,
  edge1: L.edge1,
});

const COLORS = {
  plate: "#bcc2cd",
  background: "#cdd3dc", // also the haze colour of the far field
  pin: "#f6f6f4",
  sky: "#ffffff",
  ground: "#5d6578",
};

type CameraPose = {
  target: THREE.Vector3;
  distance: number;
  elevation: number; // radians above the plate
  azimuth: number; // radians around the plate normal
  roll: number; // radians around the view axis
  fov: number; // vertical fov, degrees
  focus: number; // focus distance (world units) for depth of field
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);

const referencePose = (L: Look): CameraPose => ({
  target: new THREE.Vector3(L.targetX, 0, L.targetZ),
  distance: L.distance,
  elevation: THREE.MathUtils.degToRad(L.elevationDeg),
  azimuth: THREE.MathUtils.degToRad(L.azimuthDeg),
  roll: THREE.MathUtils.degToRad(L.rollDeg),
  fov: L.fov,
  focus: L.focus,
});

const poseAt = (
  camera: PinFieldProps["camera"],
  progress: number,
  L: Look,
): CameraPose => {
  if (camera === "reference") return referencePose(L);
  // Version 2: a slow orbit + crane-down move across the whole clip, ending
  // on a low grazing angle that shows the pins' height in profile.
  const t = easeInOut(progress);
  return {
    target: new THREE.Vector3(lerp(-4, 6, t), 0, lerp(4, -3, t)),
    distance: lerp(34, 24, t),
    elevation: THREE.MathUtils.degToRad(lerp(62, 24, t)),
    azimuth: THREE.MathUtils.degToRad(lerp(-70, 25, t)),
    roll: THREE.MathUtils.degToRad(lerp(-20, 4, t)),
    fov: 38,
    focus: lerp(31, 22, t),
  };
};

// ---------------------------------------------------------------------------
// Scene construction
// ---------------------------------------------------------------------------

type SceneState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  heads: THREE.InstancedMesh;
  stalks: THREE.InstancedMesh;
  gridXY: Float32Array;
  target: THREE.WebGLRenderTarget;
  post: { scene: THREE.Scene; camera: THREE.OrthographicCamera; material: THREE.ShaderMaterial };
  dispose: () => void;
};

const buildScene = (canvas: HTMLCanvasElement, width: number, height: number): SceneState => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.background);
  // Bright haze in the far field (as in the reference); it also guarantees
  // the edge of the pin grid is never visible.
  scene.fog = new THREE.Fog(COLORS.background, 38, 72);

  const camera = new THREE.PerspectiveCamera(38, width / height, 1, 400);

  // Lights: soft sky fill + a key light from the upper left that casts the
  // long soft shadows between the pins.
  const hemi = new THREE.HemisphereLight(COLORS.sky, COLORS.ground, 2.6);
  hemi.position.set(0, 1, 0);
  scene.add(hemi);
  const key = new THREE.DirectionalLight("#ffffff", 1.05);
  key.position.set(-10, 30, 48);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  const sc = key.shadow.camera;
  sc.left = -60;
  sc.right = 60;
  sc.top = 60;
  sc.bottom = -60;
  sc.near = 1;
  sc.far = 200;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 12;
  scene.add(key);

  // Base plate.
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ color: COLORS.plate, roughness: 0.92, metalness: 0 }),
  );
  plate.rotation.x = -Math.PI / 2;
  plate.receiveShadow = true;
  scene.add(plate);

  // Pins: a spherical head on a thin stalk. Per-instance matrices place,
  // scale and lift them every frame.
  const count = GRID * GRID;
  const headGeo = new THREE.SphereGeometry(1, 20, 14);
  const stalkGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
  stalkGeo.translate(0, 0.5, 0); // base at y = 0, top at y = 1
  const material = new THREE.MeshStandardMaterial({
    color: COLORS.pin,
    roughness: 0.42,
    metalness: 0,
  });
  const heads = new THREE.InstancedMesh(headGeo, material, count);
  const stalks = new THREE.InstancedMesh(stalkGeo, material, count);
  for (const mesh of [heads, stalks]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
  }
  const gridXY = new Float32Array(count * 2);
  const half = ((GRID - 1) * SPACING) / 2;
  let i = 0;
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      gridXY[i * 2] = gx * SPACING - half;
      gridXY[i * 2 + 1] = gy * SPACING - half;
      i++;
    }
  }

  // Depth-of-field post pass.
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    depthTexture: new THREE.DepthTexture(width, height),
  });
  const postMaterial = new THREE.ShaderMaterial({
    vertexShader: DOF_VERTEX,
    fragmentShader: DOF_FRAGMENT,
    uniforms: {
      tColor: { value: target.texture },
      tDepth: { value: target.depthTexture },
      uResolution: { value: new THREE.Vector2(width, height) },
      uNear: { value: camera.near },
      uFar: { value: camera.far },
      uFocus: { value: 25 },
      uFocusRange: { value: LOOK.focusRange },
      uMaxBlur: { value: (LOOK.maxBlur * height) / 2160 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const postScene = new THREE.Scene();
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial));

  return {
    renderer,
    scene,
    camera,
    heads,
    stalks,
    gridXY,
    target,
    post: { scene: postScene, camera: postCamera, material: postMaterial },
    dispose: () => {
      headGeo.dispose();
      stalkGeo.dispose();
      material.dispose();
      target.dispose();
      postMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
};

const applyPose = (cam: THREE.PerspectiveCamera, pose: CameraPose) => {
  const { target, distance, elevation, azimuth, roll, fov } = pose;
  cam.fov = fov;
  cam.position.set(
    target.x + distance * Math.cos(elevation) * Math.sin(azimuth),
    target.y + distance * Math.sin(elevation),
    target.z + distance * Math.cos(elevation) * Math.cos(azimuth),
  );
  cam.up.set(0, 1, 0);
  cam.lookAt(target);
  cam.rotateZ(roll);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
};

export const PinField: React.FC<PinFieldProps> = ({ camera, loopFrames, tune }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SceneState | null>(null);

  useEffect(() => {
    return () => {
      stateRef.current?.dispose();
      stateRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const handle = delayRender(`pin field frame ${frame}`);
    try {
      if (!stateRef.current && canvasRef.current) {
        stateRef.current = buildScene(canvasRef.current, width, height);
      }
      const s = stateRef.current;
      if (!s) throw new Error("Scene not initialised");

      const L: Look = { ...LOOK, ...tune };
      const field = fieldFrom(L);

      // Animate the pins. The phase advances `cycles` wave periods per loop;
      // `ease` modulates the speed within each loop (fastest early in it).
      // Both keep phase(t + 1) = phase(t) + cycles, so the loop stays seamless.
      const t = frame / loopFrames;
      const phase =
        L.cycles *
        (t + (L.ease / (2 * Math.PI)) * Math.sin(2 * Math.PI * (t - 0.13)));
      const hm = s.heads.instanceMatrix.array as Float32Array;
      const sm = s.stalks.instanceMatrix.array as Float32Array;
      const n = s.gridXY.length / 2;
      for (let i = 0; i < n; i++) {
        const x = s.gridXY[i * 2];
        const y = s.gridXY[i * 2 + 1];
        const h = heightAt(x, y, phase, field);
        const r = L.minRadius + (L.maxRadius - L.minRadius) * h;
        const len = L.minLength + (L.maxLength - L.minLength) * h;
        const sr = Math.max(r * L.stalkRatio, L.minStalk);
        const o = i * 16;
        // Head: uniform scale r, centred at stalk top.
        hm.fill(0, o, o + 16);
        hm[o] = r; hm[o + 5] = r; hm[o + 10] = r; hm[o + 15] = 1;
        hm[o + 12] = x; hm[o + 13] = len + r * 0.6; hm[o + 14] = y;
        // Stalk: radius sr, height len + small overlap into the head.
        sm.fill(0, o, o + 16);
        sm[o] = sr; sm[o + 5] = Math.max(len + r * 0.6, 0.001); sm[o + 10] = sr; sm[o + 15] = 1;
        sm[o + 12] = x; sm[o + 13] = 0; sm[o + 14] = y;
      }
      s.heads.instanceMatrix.needsUpdate = true;
      s.stalks.instanceMatrix.needsUpdate = true;

      const pose = poseAt(
        camera,
        durationInFrames > 1 ? frame / (durationInFrames - 1) : 0,
        L,
      );
      s.renderer.toneMappingExposure = L.exposure;
      s.post.material.uniforms.uFocusRange.value = L.focusRange;
      s.post.material.uniforms.uMaxBlur.value = (L.maxBlur * height) / 2160;
      applyPose(s.camera, pose);
      s.post.material.uniforms.uFocus.value = pose.focus;

      s.renderer.setRenderTarget(s.target);
      s.renderer.render(s.scene, s.camera);
      s.renderer.setRenderTarget(null);
      s.renderer.render(s.post.scene, s.post.camera);
      s.renderer.getContext().finish();
      continueRender(handle);
    } catch (err) {
      cancelRender(err as Error);
    }
  }, [frame, width, height, camera, loopFrames, durationInFrames, tune]);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width, height, display: "block" }}
      />
    </AbsoluteFill>
  );
};
