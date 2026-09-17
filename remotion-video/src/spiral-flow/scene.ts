import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Mesh,
  MeshPhysicalNodeMaterial,
  PerspectiveCamera,
  PointLight,
  PostProcessing,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGPURenderer,
} from "three/webgpu";
import {
  float,
  length,
  mix,
  oneMinus,
  pass,
  rand,
  screenUV,
  smoothstep,
  uniform,
  vec2,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { gaussianBlur } from "three/addons/tsl/display/GaussianBlurNode.js";
import {
  buildSpiralSurface,
  DEFAULT_SURFACE,
  type SurfaceParams,
} from "./surface";
import { GRADES, type GradeName } from "./palette";
import { canDriveCanvasWithWebGPU } from "./backend";

export type SceneOptions = {
  /** The scene owns its canvas: a failed backend needs a fresh one. */
  container: HTMLElement;
  width: number;
  height: number;
  grade: GradeName;
  durationInFrames: number;
  /** Multiplies the polar grid density. 1 is tuned for 1080p, 1.4 for UHD. */
  meshDetail: number;
  /** MSAA sample count for the scene pass. */
  samples: number;
  /** `true` pins the WebGL2 fallback backend even where WebGPU is available. */
  forceWebGL: boolean;
  /**
   * Called if the graphics device is lost mid-render. Software GL can run out
   * of memory part-way through a long 4K sequence, and the canvas then keeps
   * screenshotting as a blank frame — silently corrupt output. Renders must
   * fail on this, not ship it.
   */
  onDeviceLost: (reason: string) => void;
};

export type SceneHandle = {
  /** Draws one frame and resolves once the GPU work has completed. */
  renderFrame: (frame: number) => Promise<void>;
  /** `"webgpu"` or `"webgl2"` — whichever backend actually initialised. */
  backend: string;
  dispose: () => void;
};

const TAU = Math.PI * 2;

/** Lens focus, in world units from the camera. */
const DOF = { focus: 5.0, range: 4.5 };

/**
 * Height of the core lamp above the sphere's centre. Held well clear of the
 * pole so it washes the whole cap evenly; sitting it close to the surface put a
 * hard specular blob on the pole, where the reference has a broad diffuse glow.
 */
const CORE_Y = 8.5;

/**
 * Camera rig. Fixed for the whole shot — set once, never animated.
 *
 * The camera sits at a fixed elevation and distance and aims straight at the
 * sphere's centre. Framing is then set by a lens shift rather than by aiming
 * off-centre: `core` says where the convergence point should sit in frame as a
 * fraction of width/height, and `setViewOffset` slides the principal point to
 * put it there. Aiming off-centre would have skewed the perspective of the
 * foreground tubes; a lens shift does not.
 */
const RIG = {
  /** Degrees above the sphere's equator. */
  elevation: 40,
  azimuth: 0,
  distance: 10.5,
  fov: 34,
  /**
   * Camera roll, in degrees. Turns the sphere's limb in frame so it runs
   * diagonally out of the top-left the way the reference does, leaving the
   * backdrop wedge above it.
   */
  roll: -8,
  /** Where the tubes converge, in frame. Matches the reference plate. */
  core: { x: 0.65, y: 1.17 },
};

const DEG = Math.PI / 180;

/**
 * Builds the whole shot.
 *
 * Exactly one thing animates: the sphere spins about its pole by one rib period
 * across the loop. The camera, the lights and the grade are all fixed, so the
 * globe holds its size and its place in frame throughout. The height field is
 * rib-periodic, so that single rotation returns the mesh to its starting
 * appearance at `u = 1` and the render loops seamlessly.
 */
const buildScene = async (
  options: SceneOptions,
  forceWebGL: boolean,
): Promise<SceneHandle> => {
  const grade = GRADES[options.grade];

  // A canvas keeps whichever context type it was first given, and two live
  // contexts in one page can leave the second without one at all. Clearing the
  // container guarantees exactly one canvas even if the component remounts.
  options.container.replaceChildren();

  const canvas = options.container.ownerDocument.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  options.container.appendChild(canvas);

  canvas.addEventListener("webglcontextlost", (event) => {
    // Without preventDefault the context can never be restored; either way the
    // frames from here on would be blank, so the render has to stop.
    event.preventDefault();
    options.onDeviceLost("WebGL context lost");
  });

  const surface: SurfaceParams = {
    ...DEFAULT_SURFACE,
    polarSegments: Math.round(
      DEFAULT_SURFACE.polarSegments * options.meshDetail,
    ),
    angularSegments: Math.round(
      DEFAULT_SURFACE.angularSegments * options.meshDetail,
    ),
  };

  const renderer = new WebGPURenderer({
    canvas,
    antialias: true,
    samples: options.samples,
    alpha: false,
    forceWebGL,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(options.width, options.height, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;

  await renderer.init();

  // The WebGPU backend reports loss through the device rather than the canvas.
  const device = (renderer.backend as { device?: GPUDevice }).device;
  if (device) {
    device.lost.then((info) => {
      options.onDeviceLost(`WebGPU device lost: ${info.message || info.reason}`);
    });
  }

  const scene = new Scene();
  scene.fog = new FogExp2(new Color(grade.fog).getHex(), 0.052);

  // Backdrop: a diagonal three-stop wash, deep on the left and pale towards the
  // top right where the core sits. Built as a node so it is part of the HDR
  // render pass and therefore picks up bloom and tone mapping like the geometry.
  const backdropA = uniform(new Color(grade.backdrop[0]));
  const backdropB = uniform(new Color(grade.backdrop[1]));
  const backdropC = uniform(new Color(grade.backdrop[2]));
  // `screenUV.y` is 0 at the bottom, so this runs 0 at the bottom-right corner
  // to 1 at the top-left — the direction the reference's sky ramps along.
  const wash = oneMinus(screenUV.x).mul(0.55).add(screenUV.y.mul(0.45));
  scene.backgroundNode = mix(
    mix(backdropC, backdropB, smoothstep(0.34, 0.78, wash)),
    backdropA,
    smoothstep(0.84, 1.0, wash),
  );

  const camera = new PerspectiveCamera(
    RIG.fov,
    options.width / options.height,
    0.1,
    120,
  );

  const geometry = buildSpiralSurface(surface);
  const material = new MeshPhysicalNodeMaterial({
    color: new Color(grade.surface),
    roughness: 0.42,
    metalness: 0,
    sheen: 0.85,
    sheenRoughness: 0.55,
    sheenColor: new Color(grade.sheen),
    clearcoat: 0.14,
    clearcoatRoughness: 0.62,
  });
  const ribbon = new Mesh(geometry, material);
  scene.add(ribbon);

  // Hot core. Quadratic decay just above the point where the tubes converge is
  // what blows the middle of frame out to white once ACES and bloom are applied.
  const core = new PointLight(new Color(grade.core), 30, 40, 1.6);
  core.position.set(0, CORE_Y, 0);
  scene.add(core);

  // Coloured key raking across the tubes from the left, plus the opposing fill
  // that paints the foreground. Both are directional: parallel light gives the
  // tubes an even band of shading all the way out to the rim, where a point
  // light would fall off and flatten the foreground.
  const key = new DirectionalLight(new Color(grade.key), 3.6);
  key.position.set(-10, 2.4, 4);
  scene.add(key);

  const fill = new DirectionalLight(new Color(grade.fill), 3.3);
  fill.position.set(8, 1.5, 6.5);
  scene.add(fill);

  scene.add(
    new HemisphereLight(new Color(grade.sheen), new Color(grade.bounce), 0.08),
  );

  // --- Post chain: depth of field -> bloom -> vignette -> grain -----------
  const scenePass = pass(scene, camera);
  const colour = scenePass.getTextureNode();

  // Depth of field. The reference plate is shot wide open: only a band through
  // the foreground tubes is sharp and everything beyond it dissolves. Two blur
  // taps at different sigmas, cross-faded on the circle of confusion, give a
  // smoother falloff than a single tap and cost little — both run at reduced
  // resolution.
  const depth = scenePass.getViewZNode().negate();
  const coc = smoothstep(float(DOF.focus), float(DOF.focus + DOF.range), depth);
  // `resolutionScale` is what GaussianBlurNode reads at runtime; the shipped
  // @types/three still calls the field `resolution`, hence the cast.
  const halfRes = { resolutionScale: 0.5 } as Record<string, number>;
  const quarterRes = { resolutionScale: 0.25 } as Record<string, number>;
  const softBlur = gaussianBlur(colour, null, 5, halfRes);
  const wideBlur = gaussianBlur(colour, null, 14, quarterRes);
  const focused = mix(
    mix(colour, softBlur, coc.mul(1.25).clamp(0, 1)),
    wideBlur,
    smoothstep(0.42, 1.0, coc),
  );

  const glow = bloom(colour, 0.8, 1.1, 0.62);

  // Very gentle corner falloff; the reference is barely vignetted.
  const radius = length(screenUV.sub(vec2(0.5, 0.5)));
  const vignette = oneMinus(smoothstep(0.34, 0.95, radius)).mul(0.16).add(0.84);

  // Per-frame dither. Eight-bit H.264 bands badly across gradients this smooth,
  // and a sub-LSB of noise is the cheapest fix. The seed is derived from the
  // wrapped frame so the grain loops with everything else.
  const grainSeed = uniform(0);
  const grain = rand(screenUV.add(vec2(grainSeed, grainSeed.mul(1.37))))
    .sub(0.5)
    .mul(float(0.014));

  const postProcessing = new PostProcessing(renderer);
  postProcessing.outputNode = focused.add(glow).mul(vignette).add(grain);

  // The camera is placed once and never moves again. An earlier cut drifted it
  // through a slow orbit across the loop, but the radial component of that
  // drift read as the globe swelling and shrinking rather than as camera move,
  // so the rig is now locked and the spin carries the whole animation.
  const elevation = RIG.elevation * DEG;
  const azimuth = RIG.azimuth * DEG;
  camera.position.set(
    RIG.distance * Math.cos(elevation) * Math.sin(azimuth),
    RIG.distance * Math.sin(elevation),
    RIG.distance * Math.cos(elevation) * Math.cos(azimuth),
  );
  camera.lookAt(new Vector3(0, 0, 0));
  camera.rotateZ(RIG.roll * DEG);

  // Lens shift: move the principal point so the core lands where the reference
  // puts it instead of dead centre.
  camera.setViewOffset(
    options.width,
    options.height,
    (0.5 - RIG.core.x) * options.width,
    (0.5 - RIG.core.y) * options.height,
    options.width,
    options.height,
  );
  camera.updateProjectionMatrix();

  const renderFrame = async (frame: number) => {
    const wrapped = ((frame % options.durationInFrames) + options.durationInFrames) %
      options.durationInFrames;
    const u = wrapped / options.durationInFrames;

    // One rib period of rigid spin across the loop. The height field is
    // rib-periodic, so the frame after the last is identical to the first.
    //
    // This is the only thing that moves. The camera and the lights are fixed,
    // so the globe holds its size and its place in frame and simply turns.
    ribbon.rotation.y = -u * (TAU / surface.ribs);

    grainSeed.value = (wrapped * 0.6180339887) % 1;

    await postProcessing.renderAsync();
  };

  return {
    renderFrame,
    // `isWebGPUBackend` is set by WebGPUBackend but is absent from the shared
    // `Backend` typing, so it is read defensively.
    backend: (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend
      ? "webgpu"
      : "webgl2",
    dispose: () => {
      geometry.dispose();
      material.dispose();
      postProcessing.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
};

/**
 * Builds the scene on the backend this machine will actually render with.
 * See `backend.ts` for why `navigator.gpu` alone is not a safe signal.
 */
export const createSpiralScene = async (
  options: SceneOptions,
): Promise<SceneHandle> => {
  const useWebGL =
    options.forceWebGL ||
    !(await canDriveCanvasWithWebGPU(
      options.container.ownerDocument,
      options.width,
      options.height,
    ));
  return buildScene(options, useWebGL);
};
