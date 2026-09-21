import {
  ACESFilmicToneMapping,
  Color,
  Group,
  Matrix3,
  Matrix4,
  Material,
  Mesh,
  MeshBasicNodeMaterial,
  NeutralToneMapping,
  NoToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PostProcessing,
  Scene,
  WebGPURenderer,
  type Node,
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
  vec4,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { fxaa } from "three/addons/tsl/display/FXAANode.js";
import { createEnvironmentTexture } from "./environment";
import { makeLensGeometry, makeRimGeometry } from "./geometry";
import {
  CAMERA,
  backdropGlow,
  cameraOffset,
  discTransform,
  environmentRotation,
} from "./layout";
import {
  createBackdropMaterial,
  createFilmMaterial,
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
  /** MSAA samples on the scene pass, where the backend honours them. */
  samples: number;
  /**
   * Renders at this multiple of the output size and filters back down.
   * 2 gives a true 2x2 supersample of the whole chain.
   */
  supersample: number;
  /**
   * Loop position of the first frame this engine will be asked for, used for
   * the warm-up so a missed paint cannot show the wrong image.
   */
  initialCycle: number;
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

/**
 * @types/three declares FXAANode as a bare TempNode, which loses the vec4 it
 * actually outputs. Narrow it once here rather than casting at the call site.
 */
const antialias = fxaa as unknown as (input: Node<"vec4">) => Node<"vec4">;

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

  // Supersampling is the antialiasing that actually works here. The rim
  // highlight saturates, and a clipped signal cannot be antialiased by
  // reshaping its falloff -- the visible edge is wherever it crosses white,
  // and that crossing is arbitrarily steep. Multisampling does not help
  // either: it resolves geometry coverage, not shading inside a triangle, and
  // this backend ignores the sample count on the pass target regardless.
  // Rendering oversized and filtering down averages the clipped result, which
  // is the only thing that removes the stepping.
  const scale = Math.max(1, Math.min(2, options.supersample));
  const renderWidth = Math.round(width * scale);
  const renderHeight = Math.round(height * scale);

  const { renderer, backend, canvas: glCanvas } = await createRenderer(
    renderWidth,
    renderHeight,
    preferWebGPU,
  );

  renderer.toneMapping =
    variant.toneMapping === "aces"
      ? ACESFilmicToneMapping
      : variant.toneMapping === "none"
        ? NoToneMapping
        : NeutralToneMapping;
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

  // Clear glass shares one material across every disc; tinted film cannot,
  // since each circle carries its own colour pair.
  const glassMaterial = createGlassMaterial(variant);
  const filmMaterials: MeshBasicNodeMaterial[] = [];
  const rim = createRimMaterial(variant, envTexture);

  // Tessellate to the delivery resolution rather than a fixed count: a fixed
  // count leaves the hero circle's silhouette visibly faceted at 1080p and
  // worse at 4K, and a faceted silhouette crawls once the disc moves.
  const pixelsPerWorldUnit =
    renderHeight / (2 * CAMERA.distance * Math.tan((CAMERA.fov * Math.PI) / 360));
  const segmentsFor = (radius: number) => {
    const circumferenceInPixels = 2 * Math.PI * radius * pixelsPerWorldUnit;
    return Math.min(4096, Math.max(256, Math.round(circumferenceInPixels / 2.5)));
  };

  const discs = variant.discs.map((spec) => {
    const group = new Group();
    const segments = segmentsFor(spec.radius);
    let bodyMaterial: Material = glassMaterial;
    if (variant.body === "film" && spec.tint) {
      const film = createFilmMaterial(variant, spec.radius, spec.tint);
      filmMaterials.push(film);
      bodyMaterial = film;
    }
    const lens = new Mesh(
      makeLensGeometry(spec.radius, spec.halfThickness, segments),
      bodyMaterial,
    );
    const rimMesh = new Mesh(
      makeRimGeometry(spec.radius, spec.halfThickness, segments),
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
    const p = screenUV.mul(vec2(renderWidth, renderHeight));
    return vec3(mx_noise_float(vec3(p.x, p.y, grainSeed))).mul(
      float(variant.grain),
    );
  })();

  // FXAA runs on the tone-mapped image, which is the only place the rim's
  // stepping actually exists: the highlight is clipped long before this, so
  // the stair steps are an artefact of the displayed values rather than of
  // the geometry. Grain is added afterwards so it does not get smoothed away.
  postProcessing.outputColorTransform = false;
  const antialiased = antialias(renderOutput(sceneColor.add(bloomPass)));
  postProcessing.outputNode = vec4(antialiased.rgb.add(grain), antialiased.a);

  const context = target.getContext("2d");
  if (!context) {
    throw new Error("Could not acquire a 2D context for the output canvas");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

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
    context.drawImage(
      glCanvas,
      0,
      0,
      renderWidth,
      renderHeight,
      0,
      0,
      width,
      height,
    );

    // Hand the blit to the compositor before reporting the frame as ready.
    // Without this the screenshot can capture whatever was last painted rather
    // than what was just drawn, which shows up as a frame carrying the
    // previous image -- most visibly on the first frame a render tab produces,
    // where the previous image is the warm-up.
    await waitForPaint();
  };

  // Warm-up. The first pass through this path builds the post-processing
  // pipelines and does not reach the visible canvas, which would otherwise cost
  // the first frame of every parallel render tab. The blit is part of the
  // warm-up deliberately: it is the step that comes up empty.
  //
  // It warms up on the frame actually being asked for rather than on cycle 0,
  // so that if the screenshot still beats the compositor the stale image it
  // captures is the right one. Waiting on paint alone proved too sensitive to
  // load: adding FXAA was enough to start losing the race again.
  await renderFrame(options.initialCycle);
  await renderFrame(options.initialCycle);

  const dispose = () => {
    for (const disc of discs) {
      disc.lens.geometry.dispose();
      disc.rimMesh.geometry.dispose();
    }
    backdropGeometry.dispose();
    backdrop.material.dispose();
    rim.material.dispose();
    glassMaterial.dispose();
    for (const film of filmMaterials) {
      film.dispose();
    }
    envTexture.dispose();
    envTarget.dispose();
    pmrem.dispose();
    renderer.dispose();
  };

  return { backend, renderFrame, dispose };
};
