import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  HemisphereLight,
  PointLight,
  PerspectiveCamera,
  PostProcessing,
  Scene,
  Sprite,
  SpriteNodeMaterial,
  AdditiveBlending,
  WebGPURenderer,
} from "three/webgpu";
import { float, pass, texture, uv } from "three/tsl";
import { colorVec3 } from "./tsl-helpers";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import type { Palette } from "../palettes";
import { CAMERA } from "../constants";
import { installWebGPUCompat } from "../webgpu-compat";
import {
  makeFlareTexture,
  makeSoftDotTexture,
  makeStreakTexture,
} from "./textures";
import { buildEyeParticles, loadEyeGeometry } from "./eyeParticles";
import { buildHudIris } from "./hudIris";

export type EyeSceneOptions = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  palette: Palette;
  modelUrl: string;
  particleCount: number;
  wireframe: boolean;
  antialias: boolean;
  durationSeconds: number;
};

export type EyeScene = {
  /** Renders the frame for time `t` (seconds) and resolves once the GPU is done. */
  renderFrame: (t: number) => Promise<void>;
  dispose: () => void;
};

const easeInOut = (x: number) => x * x * (3 - 2 * x);

export const createEyeScene = async (
  options: EyeSceneOptions,
): Promise<EyeScene> => {
  const { canvas, width, height, palette } = options;
  installWebGPUCompat();

  const renderer = new WebGPURenderer({
    canvas,
    antialias: options.antialias,
    alpha: false,
    forceWebGL: false,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = palette.exposure;
  renderer.setClearColor(new Color(palette.background), 1);
  await renderer.init();

  const scene = new Scene();
  scene.background = new Color(palette.background);

  const camera = new PerspectiveCamera(
    CAMERA.fov,
    width / height,
    CAMERA.near,
    CAMERA.far,
  );
  camera.position.set(0, 0, CAMERA.distance);
  camera.lookAt(0, 0, 0);

  const textures = {
    dot: makeSoftDotTexture(64),
    flare: makeFlareTexture(256),
    streak: makeStreakTexture(512, 64),
  };

  // Soft glow behind the eye.
  const glowMaterial = new SpriteNodeMaterial();
  glowMaterial.transparent = true;
  glowMaterial.depthWrite = false;
  glowMaterial.blending = AdditiveBlending;
  glowMaterial.colorNode = texture(textures.dot, uv())
    .rgb.mul(colorVec3(palette.backgroundGlow))
    .mul(palette.light ? 0.9 : 1.0);
  glowMaterial.opacityNode = float(1);
  const glow = new Sprite(glowMaterial);
  glow.scale.set(2.6, 1.7, 1);
  glow.position.set(0.05, 0, -0.7);
  scene.add(glow);

  // Lighting for the solid eyeball / lids: key from the upper left, a low
  // fill, and the iris itself glowing onto the surrounding surfaces.
  const key = new DirectionalLight(new Color(palette.primary), palette.light ? 1.3 : 0.9);
  key.position.set(-0.9, 1.1, 1.4);
  scene.add(key);
  const fill = new HemisphereLight(new Color(palette.primary), new Color(palette.background), 0.45);
  scene.add(fill);
  const irisLight = new PointLight(new Color(palette.primary), palette.light ? 1.4 : 3.2, 1.6, 1.6);
  irisLight.position.set(0, 0, 0.02);
  scene.add(irisLight);

  const geometry = await loadEyeGeometry(options.modelUrl);
  const particles = buildEyeParticles(
    geometry,
    palette,
    {
      particleCount: options.particleCount,
      wireframe: options.wireframe,
      dotSize: 0.0034,
      seed: 1337,
    },
    textures.dot,
  );
  scene.add(particles.group);

  const iris = buildHudIris(palette, {
    flare: textures.flare,
    streak: textures.streak,
    dot: textures.dot,
  });
  scene.add(iris.group);

  // Post: scene + bloom. Tone mapping / sRGB output is applied by PostProcessing.
  const scenePass = pass(scene, camera);
  const scenePassColor = scenePass.getTextureNode("output");
  const bloomPass = bloom(
    scenePassColor,
    palette.bloomStrength,
    0.55,
    palette.bloomThreshold,
  );
  const post = new PostProcessing(renderer);
  post.outputNode = scenePassColor.add(bloomPass);

  const waitForGpu = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const backend = (renderer as any).backend;
    await backend?.device?.queue?.onSubmittedWorkDone?.();
  };

  const update = (t: number) => {
    particles.setTime(t);
    iris.setTime(t);
    // Slow orbit + push-in around the pupil. The look-at stays on the origin
    // so the HUD disc never leaves the centre of frame.
    const progress = Math.min(1, Math.max(0, t / options.durationSeconds));
    const dist = CAMERA.distance * (1.025 - 0.045 * easeInOut(progress));
    const az = 0.07 * Math.sin(t * 0.22 + 0.6);
    const el = 0.035 * Math.sin(t * 0.17 + 2.0);
    camera.position.set(
      dist * Math.sin(az) * Math.cos(el),
      dist * Math.sin(el),
      dist * Math.cos(az) * Math.cos(el),
    );
    camera.lookAt(0, 0, 0);
  };

  // Warm-up render so every pipeline exists before the first real frame.
  update(0);
  post.render();
  await waitForGpu();

  let chain: Promise<void> = Promise.resolve();
  const renderFrame = (t: number) => {
    chain = chain.then(async () => {
      update(t);
      post.render();
      await waitForGpu();
    });
    return chain;
  };

  const dispose = () => {
    renderer.dispose();
    textures.dot.dispose();
    textures.flare.dispose();
    textures.streak.dispose();
  };

  return { renderFrame, dispose };
};
