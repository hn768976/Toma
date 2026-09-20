import {
  ACESFilmicToneMapping,
  Color,
  Group,
  Matrix3,
  Matrix4,
  Mesh,
  NeutralToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PostProcessing,
  Scene,
  WebGPURenderer,
} from "three/webgpu";
import {
  Fn,
  float,
  mx_noise_float,
  pass,
  renderOutput,
  screenUV,
  uniform,
  vec2,
  vec3,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { createEnvironmentTexture } from "./environment";
import { makeLensGeometry, makeRimGeometry } from "./geometry";
import {
  CAMERA,
  DISCS,
  GLASS_HALF_THICKNESS,
  backdropGlow,
  cameraOffset,
  discTransform,
  environmentRotation,
} from "./layout";
import {
  createBackdropMaterial,
  createGlassMaterial,
  createRimMaterial,
} from "./materials";
import { osc } from "./loop";
import type { GlassVariant } from "./variants";

export type Backend = "webgpu" | "webgl";

export type GlassEngine = {
  backend: Backend;
  /** Renders one frame. `cycle` runs 0..1 across the clip. */
  renderFrame: (cycle: number) => Promise<void>;
  dispose: () => void;
};

export type EngineOptions = {
  /** Visible 2D canvas the rendered frame is blitted into. */
  target: HTMLCanvasElement;
  width: number;
  height: number;
  variant: GlassVariant;
  /** Try WebGPU first; WebGL2 is used automatically when it is unavailable. */
  preferWebGPU: boolean;
  /** MSAA samples on the scene pass. */
  samples: number;
};

/**
 * Resolves once the browser has actually painted.
 *
 * A canvas that has only ever been drawn to within a single task may not have
 * been composited yet, and a screenshot taken at that point captures nothing.
 * Falls back to a timer so it can never stall a render.
 */
const waitForPaint = (): Promise<void> =>
  new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    const timer = setTimeout(finish, 250);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        clearTimeout(timer);
        finish();
      });
    });
  });

const BACKDROP_Z = -4;
const BACKDROP_WIDTH = 22;
const BACKDROP_HEIGHT = 13;

type CreatedRenderer = { renderer: WebGPURenderer; backend: Backend; canvas: HTMLCanvasElement };

/**
 * Confirms WebGPU can actually present to a canvas, on a throwaway 64x64
 * surface.
 *
 * A WebGPU adapter and device can initialise successfully on machines where the
 * canvas swap chain still cannot be allocated -- headless and software-rendered
 * environments in particular. That failure is silent: rendering "succeeds" and
 * the canvas stays blank. Clearing to a known colour and reading it back is the
 * only reliable way to catch it.
 *
 * The probe is deliberately tiny and disposed before the real renderer is
 * built, so a rejected WebGPU attempt does not hold a graphics context that the
 * WebGL fallback then fails to acquire.
 */
const probeWebGPUPresentation = async (): Promise<boolean> => {
  let renderer: WebGPURenderer | null = null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    renderer = new WebGPURenderer({ canvas, antialias: false, alpha: false });
    renderer.setPixelRatio(1);
    renderer.setSize(64, 64, false);
    await renderer.init();

    if (!(renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend) {
      return false;
    }

    renderer.setClearColor(new Color(0x3366cc), 1);
    await renderer.clearAsync();

    const probe = document.createElement("canvas");
    probe.width = 4;
    probe.height = 4;
    const probeContext = probe.getContext("2d", { willReadFrequently: true });
    if (!probeContext) {
      return false;
    }
    probeContext.drawImage(canvas, 0, 0, 64, 64, 0, 0, 4, 4);
    const { data } = probeContext.getImageData(0, 0, 4, 4);
    // A swap chain that cannot present reads back transparent or black.
    return data[3] > 0 && data[0] + data[1] + data[2] > 0 && data[2] > data[0];
  } catch {
    return false;
  } finally {
    renderer?.dispose();
  }
};

/**
 * Creates the renderer on the backend that was found to work.
 *
 * Each attempt gets a fresh canvas: a canvas can only ever hand out one kind of
 * drawing context, so a spent attempt would poison it for the next one.
 */
const createRenderer = async (
  width: number,
  height: number,
  preferWebGPU: boolean,
): Promise<CreatedRenderer> => {
  const build = async (forceWebGL: boolean) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const renderer = new WebGPURenderer({
      canvas,
      antialias: false,
      alpha: false,
      forceWebGL,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    await renderer.init();
    return { renderer, canvas };
  };

  if (preferWebGPU && (await probeWebGPUPresentation())) {
    try {
      const built = await build(false);
      return { ...built, backend: "webgpu" };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("WebGPU renderer failed to build, using WebGL2:", error);
    }
  }

  // Acquiring a software WebGL2 context can transiently fail when several
  // render tabs start at once, so give it a few attempts.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const built = await build(true);
      return { ...built, backend: "webgl" };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw new Error(`Could not create a WebGL2 renderer: ${String(lastError)}`);
};

export const createEngine = async (
  options: EngineOptions,
): Promise<GlassEngine> => {
  const { target, width, height, variant, preferWebGPU, samples } = options;

  const { renderer, backend, canvas: glCanvas } = await createRenderer(
    width,
    height,
    preferWebGPU,
  );

  renderer.toneMapping =
    variant.toneMapping === "aces" ? ACESFilmicToneMapping : NeutralToneMapping;
  renderer.toneMappingExposure = variant.exposure;
  renderer.setClearColor(new Color(variant.clearColor), 1);

  const scene = new Scene();
  const camera = new PerspectiveCamera(CAMERA.fov, width / height, 0.1, 100);
  camera.position.set(0, 0, CAMERA.distance);

  // Image-based lighting, prefiltered so roughness reads correctly.
  const envTexture = createEnvironmentTexture(variant);
  const pmrem = new PMREMGenerator(renderer);
  const envTarget = pmrem.fromEquirectangular(envTexture);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = variant.environment.intensity;

  const backdrop = createBackdropMaterial(variant, BACKDROP_WIDTH, BACKDROP_HEIGHT);
  const backdropGeometry = new PlaneGeometry(BACKDROP_WIDTH, BACKDROP_HEIGHT);
  const backdropMesh = new Mesh(backdropGeometry, backdrop.material);
  backdropMesh.position.z = BACKDROP_Z;
  scene.add(backdropMesh);

  const glassMaterial = createGlassMaterial(variant);
  const rim = createRimMaterial(variant, envTexture);

  const discs = DISCS.map((spec) => {
    const group = new Group();
    // Enough radial segments that even the hero circle's silhouette is smooth.
    const segments = Math.max(128, Math.round(spec.radius * 160));
    const lens = new Mesh(
      makeLensGeometry(spec.radius, GLASS_HALF_THICKNESS, segments),
      glassMaterial,
    );
    const rimMesh = new Mesh(
      makeRimGeometry(spec.radius, GLASS_HALF_THICKNESS, segments),
      rim.material,
    );
    rimMesh.renderOrder = 10;
    group.add(lens);
    group.add(rimMesh);
    scene.add(group);
    return { spec, group, lens, rimMesh };
  });

  // Post chain: HDR scene -> bloom -> tone map -> grain.
  const grainSeed = uniform(0);
  const postProcessing = new PostProcessing(renderer);
  const scenePass = pass(scene, camera, { samples });
  const sceneColor = scenePass.getTextureNode("output");
  const bloomPass = bloom(
    sceneColor,
    variant.bloom.strength,
    variant.bloom.radius,
    variant.bloom.threshold,
  );

  // Grain is applied after the tone map so its strength is perceptual rather
  // than swamping the shadows of the dark variant.
  const grain = Fn(() => {
    const p = screenUV.mul(vec2(width, height));
    return vec3(mx_noise_float(vec3(p.x, p.y, grainSeed))).mul(
      float(variant.grain),
    );
  })();

  postProcessing.outputColorTransform = false;
  postProcessing.outputNode = renderOutput(sceneColor.add(bloomPass)).add(grain);

  const context = target.getContext("2d");
  if (!context) {
    throw new Error("Could not acquire a 2D context for the output canvas");
  }

  const envEuler = new Matrix4();
  const envMatrix = new Matrix3();

  const updateScene = (cycle: number) => {
    const [camX, camY] = cameraOffset(cycle);
    camera.position.set(camX, camY, CAMERA.distance);
    camera.lookAt(camX * 0.4, camY * 0.4, 0);

    for (const disc of discs) {
      const transform = discTransform(disc.spec, cycle);
      disc.group.position.set(...transform.position);
      disc.group.rotation.set(...transform.rotation);
    }

    const [ex, ey, ez] = environmentRotation(cycle);
    scene.environmentRotation.set(ex, ey, ez);
    envEuler.makeRotationFromEuler(scene.environmentRotation);
    envMatrix.setFromMatrix4(envEuler);
    rim.setEnvironmentRotation(envMatrix);

    const [glowX, glowY] = backdropGlow(cycle);
    backdrop.setGlow(glowX, glowY);

    // Periodic so the grain loops with everything else.
    grainSeed.value = 64 * osc(cycle, 1, 0);
  };

  const renderFrame = async (cycle: number) => {
    updateScene(cycle);
    await postProcessing.renderAsync();

    // The WebGPU/WebGL canvas is never attached to the document, so its
    // drawing buffer survives; blitting into a 2D canvas guarantees Remotion's
    // screenshot captures the frame.
    context.drawImage(glCanvas, 0, 0);
  };

  // Warm-up. The first pass through this path builds the post-processing
  // pipelines and does not reach the visible canvas, which would otherwise cost
  // the first frame of every parallel render tab. The blit is part of the
  // warm-up deliberately: it is the step that comes up empty.
  await renderFrame(0);
  await waitForPaint();
  await renderFrame(0);
  await waitForPaint();

  const dispose = () => {
    for (const disc of discs) {
      disc.lens.geometry.dispose();
      disc.rimMesh.geometry.dispose();
    }
    backdropGeometry.dispose();
    backdrop.material.dispose();
    rim.material.dispose();
    glassMaterial.dispose();
    envTexture.dispose();
    envTarget.dispose();
    pmrem.dispose();
    renderer.dispose();
  };

  return { backend, renderFrame, dispose };
};
