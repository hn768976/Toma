import {
  ACESFilmicToneMapping,
  CineonToneMapping,
  Color,
  InstancedMesh,
  MeshBasicNodeMaterial,
  NeutralToneMapping,
  Object3D,
  PerspectiveCamera,
  PostProcessing,
  Scene,
  SRGBColorSpace,
  WebGPURenderer,
} from 'three/webgpu';
import {
  abs,
  cameraPosition,
  clamp,
  cos,
  cross,
  dot,
  exp,
  float,
  floor,
  fract,
  instanceIndex,
  length,
  mat3,
  max,
  mix,
  mod,
  normalize,
  positionGeometry,
  sign,
  positionWorld,
  pow,
  reflect,
  screenUV,
  sin,
  smoothstep,
  step,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type Node from 'three/src/nodes/core/Node.js';
import type { WebGPURendererParameters } from 'three/src/renderers/webgpu/WebGPURenderer.js';
import { pass } from 'three/tsl';
import {
  GRID_N,
  LOOP_SECONDS,
  PITCH,
  TILE_CHAMFER,
  TILE_DEPTH,
  TILE_DOME_RISE,
  TILE_HEIGHT,
  TILE_SIZE,
  TILE_TILT_JITTER,
  TILE_TOP_SEGMENTS,
  WAVES,
} from './config';
import type { Theme } from './themes';
import { createTileGeometry } from './tile-geometry';
import { bloomGlow, depthOfField } from './post';

/** sRGB hex -> linear-working-space vec3 node. */
const rgb = (hex: string) => {
  const c = new Color().setStyle(hex, SRGBColorSpace);
  return vec3(c.r, c.g, c.b);
};


const TWO_PI = Math.PI * 2;

/** One full turn of the loop, in radians per second. */
const OMEGA = TWO_PI / LOOP_SECONDS;

/** Camera framing. Held in one place because all three versions share it. */
const CAMERA_FOV = 41;
const CAMERA_HEIGHT = 16;
const CAMERA_PITCH = 0.6; // ~34 degrees down
const CAMERA_YAW = 0.55; // ~31 degrees off the grid axis
const CAMERA_ROLL = -0.07;
const CAMERA_AIM_DISTANCE = 24;

export type TileFieldScene = {
  /** Advance the whole scene to an absolute time in seconds. Pure -- no state. */
  setTime: (seconds: number) => void;
  render: () => Promise<void>;
  setSize: (width: number, height: number) => void;
  dispose: () => void;
  /** Which backend actually ended up rasterising the scene. */
  backend: 'webgpu' | 'webgl2';
};

/**
 * Which backend to ask for.
 *
 * `auto` prefers WebGPU and silently drops to WebGL2 if the platform advertises
 * WebGPU but cannot actually drive it -- which is exactly what happens in a
 * headless CLI render on a machine with no GPU.
 */
export type BackendPreference = 'auto' | 'webgpu' | 'webgl2';

const buildScene = async (
  container: HTMLElement,
  theme: Theme,
  width: number,
  height: number,
  forceWebGL: boolean,
): Promise<TileFieldScene> => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const rendererParameters: WebGPURendererParameters = {
    canvas,
    antialias: true,
  };

  if (forceWebGL) {
    // Hand the WebGL2 backend a context we made ourselves, so we can set
    // preserveDrawingBuffer. Without it the headless screenshot can catch an
    // already-recycled drawing buffer and come out black.
    rendererParameters.forceWebGL = true;
    rendererParameters.context =
      canvas.getContext('webgl2', {
        antialias: true,
        alpha: true,
        depth: true,
        stencil: false,
        preserveDrawingBuffer: true,
      }) ?? undefined;
  }

  const renderer = new WebGPURenderer(rendererParameters);
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.toneMapping =
    theme.toneMapping === 'aces'
      ? ACESFilmicToneMapping
      : theme.toneMapping === 'cineon'
        ? CineonToneMapping
        : NeutralToneMapping;
  renderer.toneMappingExposure = theme.exposure;
  await renderer.init();

  const scene = new Scene();
  scene.background = new Color().setStyle(theme.fogColor, SRGBColorSpace);

  const camera = new PerspectiveCamera(CAMERA_FOV, width / height, 0.35, 300);

  // ---------------------------------------------------------------------
  // Uniforms
  // ---------------------------------------------------------------------
  const uTime = uniform(0);

  // ---------------------------------------------------------------------
  // The wave field, evaluated entirely on the GPU in TSL.
  //
  // Returns vec3(height, d/dx, d/dz) so the tile can be both lifted onto the
  // surface and rotated to sit flush with it.
  // ---------------------------------------------------------------------
  const waveField = (p: Node<'vec2'>) => {
    // `.add(0)` gives the accumulators the general float-node type, so they can
    // be reassigned by the loop below.
    let h = float(0).add(0);
    let gx = float(0).add(0);
    let gz = float(0).add(0);

    for (const w of WAVES) {
      const len = Math.hypot(w.dir[0], w.dir[1]) || 1;
      const k = TWO_PI / w.wavelength;
      const kx = (k * w.dir[0]) / len;
      const kz = (k * w.dir[1]) / len;
      // Integer harmonic of the loop frequency => seamless at t = LOOP_SECONDS.
      const omega = OMEGA * w.harmonic;

      const phase = p.x.mul(kx).add(p.y.mul(kz)).add(uTime.mul(omega)).add(w.phase);
      h = h.add(sin(phase).mul(w.amplitude));
      const c = cos(phase).mul(w.amplitude);
      gx = gx.add(c.mul(kx));
      gz = gz.add(c.mul(kz));
    }

    return vec3(h, gx, gz);
  };

  // ---------------------------------------------------------------------
  // Per-instance placement
  // ---------------------------------------------------------------------
  const idx = float(instanceIndex);
  const gridX = mod(idx, float(GRID_N));
  const gridZ = floor(idx.div(float(GRID_N)));
  const half = (GRID_N - 1) / 2;
  const cell = vec2(gridX.sub(half), gridZ.sub(half)).mul(PITCH);

  // Cheap per-tile hashes, used for tilt, height and colour variety.
  const hash = fract(sin(idx.mul(12.9898).add(78.233)).mul(43758.5453));
  const hash2 = fract(sin(idx.mul(7.137).add(21.71)).mul(24634.6345));

  const wave = waveField(cell);
  // Each tile is nudged off the ideal surface normal. Neighbouring tiles would
  // otherwise share a normal almost exactly, and the field would read as one
  // smooth sheet instead of thousands of separate plates.
  const tilt = vec3(hash.sub(0.5), 0.0, hash2.sub(0.5)).mul(TILE_TILT_JITTER);
  const surfaceNormal = normalize(vec3(wave.y.negate(), 1.0, wave.z.negate()).add(tilt));
  // The tile's frame, built so that tangentX x surfaceNormal = tangentZ. Getting
  // the handedness backwards mirrors every tile, which reverses its winding and
  // back-face-culls the tops -- leaving nothing on screen but the skirt walls.
  const tangentX = normalize(cross(surfaceNormal, vec3(0, 0, 1)));
  const tangentZ = cross(tangentX, surfaceNormal);
  const basis = mat3(tangentX, surfaceNormal, tangentZ);

  const tileOrigin = vec3(cell.x, wave.x.add(hash2.sub(0.5).mul(0.06)), cell.y);
  const worldPosition = basis.mul(positionGeometry).add(tileOrigin);

  // ---------------------------------------------------------------------
  // Shading normal, derived analytically from the tile-local position rather
  // than read from the normal attribute.
  //
  // The top of a tile is a pillow dome, and interpolating a handful of vertex
  // normals across it gives a faceted highlight. Rebuilding the normal from the
  // interpolated local position instead makes the dome smooth per pixel, and
  // lets the geometry stay coarse -- the mesh only has to carry the silhouette.
  // ---------------------------------------------------------------------
  const outerHalf = TILE_SIZE / 2;
  const innerHalf = outerHalf - TILE_CHAMFER;

  const local = varying(positionGeometry, 'vTileLocal');

  // Which of the four walls a skirt/chamfer fragment belongs to.
  const xDominant = step(abs(local.z), abs(local.x));
  const outward = vec3(
    sign(local.x).mul(xDominant),
    0.0,
    sign(local.z).mul(float(1).sub(xDominant)),
  );

  // Gradient of rise * (1 - u^2) * (1 - v^2), matching the geometry exactly.
  const u = local.x.div(innerHalf);
  const v = local.z.div(innerHalf);
  const domeNormal = normalize(
    vec3(
      u.mul(float(1).sub(v.mul(v))).mul((2 * TILE_DOME_RISE) / innerHalf),
      1.0,
      v.mul(float(1).sub(u.mul(u))).mul((2 * TILE_DOME_RISE) / innerHalf),
    ),
  );

  const chamferNormal = normalize(outward.add(vec3(0, 1, 0)));

  const onTop = step(TILE_HEIGHT - 1e-4, local.y);
  const onChamfer = step(TILE_HEIGHT - TILE_CHAMFER - 1e-4, local.y).mul(float(1).sub(onTop));
  const onSkirt = float(1).sub(onTop).sub(onChamfer);

  const localNormal = domeNormal
    .mul(onTop)
    .add(chamferNormal.mul(onChamfer))
    .add(outward.mul(onSkirt));

  // The tile's world-space frame, carried across as three varyings.
  //
  // Multiplying `basis` by the local normal directly would look equivalent, but
  // `basis` is built from `instanceIndex`, so that whole expression gets folded
  // back into the vertex stage -- and the per-pixel dome collapses to one normal
  // per tile. Interpolating the frame instead keeps the maths in the fragment.
  const vTangentX = varying(tangentX, 'vTileTangentX');
  const vTangentZ = varying(tangentZ, 'vTileTangentZ');
  const vSurfaceNormal = varying(surfaceNormal, 'vSurfaceNormal');
  const vHash = varying(hash, 'vTileHash');

  const worldNormal = vTangentX
    .mul(localNormal.x)
    .add(vSurfaceNormal.mul(localNormal.y))
    .add(vTangentZ.mul(localNormal.z));

  // ---------------------------------------------------------------------
  // Shading: a hand-rolled metal BRDF against a procedural environment.
  //
  // Doing it this way (rather than an IBL + PMREM) keeps the three colour
  // versions exactly retargetable from the palette in themes.ts, and keeps the
  // render deterministic frame to frame.
  // ---------------------------------------------------------------------
  const metal = rgb(theme.metal);
  const envZenith = rgb(theme.envZenith);
  const envHorizon = rgb(theme.envHorizon);
  const envGround = rgb(theme.envGround);
  const envBand = rgb(theme.envBand);
  const keyColor = rgb(theme.keyColor);
  const sunColor = rgb(theme.sunColor);
  const fogColor = rgb(theme.fogColor);

  const keyDir = normalize(vec3(...theme.keyDir));
  const sunDir = normalize(vec3(...theme.sunDir));

  const N = normalize(worldNormal);
  const V = normalize(cameraPosition.sub(positionWorld));
  const NdotV = max(dot(N, V), 0.0);
  const R = reflect(V.negate(), N);

  // Procedural environment, as a function of where the reflected ray points.
  // The camera looks down at the field, so a flat tile reflects at roughly
  // R.y = +0.55: the bright band is parked right there, and the wave tilt is
  // what sweeps each tile into and out of it.
  const bandLow = theme.envBandCenter - theme.envBandWidth;
  const bandHigh = theme.envBandCenter + theme.envBandWidth * 1.4;

  const belowBand = mix(envGround, envHorizon, smoothstep(-0.55, bandLow, R.y));
  const intoBand = mix(belowBand, envBand, smoothstep(bandLow, theme.envBandCenter, R.y));
  const gradient = mix(intoBand, envZenith, smoothstep(theme.envBandCenter, bandHigh, R.y));

  // Broad soft key: this is what paints the wide diagonal light bands as the
  // waves roll the tile normals through it.
  const keyLobe = pow(max(dot(R, keyDir), 0.0), theme.keyBroadness).mul(theme.keyIntensity);
  // Tight lobe: the sparkle in the far field.
  const sunLobe = pow(max(dot(R, sunDir), 0.0), theme.sunSharpness).mul(theme.sunIntensity);

  const environment = gradient
    .mul(theme.envIntensity)
    .add(keyColor.mul(keyLobe))
    .add(sunColor.mul(sunLobe));

  // Schlick, metal flavour: F0 is the metal colour, F90 is white.
  const fresnel = pow(float(1.0).sub(NdotV), 5.0);
  const tint = metal.mul(float(1.0).add(vHash.sub(0.5).mul(theme.metalVariance)));
  const reflectance = mix(tint, vec3(1, 1, 1), fresnel.mul(0.9));

  // Tile flanks are darker than the tops, and the deeper you go the darker.
  const facingUp = abs(dot(N, normalize(vSurfaceNormal)));
  const sideMask = smoothstep(0.55, 0.97, facingUp);
  const flank = mix(float(theme.sideDarkening), float(1.0), sideMask);
  const heightFactor = smoothstep(-TILE_DEPTH, TILE_HEIGHT, local.y);
  const ao = mix(float(theme.aoDepth), float(1.0), heightFactor);

  // Broad positional falloff across the field: one side sits in the light, the
  // other rolls off into shadow. This is what gives the frame its bright
  // upper-left and its near-black lower-right.
  const falloffLength = Math.hypot(theme.lightFalloffDir[0], theme.lightFalloffDir[1]) || 1;
  const falloffAxis = vec2(
    theme.lightFalloffDir[0] / falloffLength,
    theme.lightFalloffDir[1] / falloffLength,
  );
  const alongLight = positionWorld.x.mul(falloffAxis.x).add(positionWorld.z.mul(falloffAxis.y));
  const lightFalloff = mix(
    float(theme.lightFalloffNear),
    float(theme.lightFalloffFar),
    smoothstep(-8.0, 46.0, alongLight),
  );

  let color = environment.mul(reflectance).mul(flank).mul(ao).mul(lightFalloff);

  // Aerial perspective. Also the reason the far edge of the grid is never
  // visible -- it dissolves into the backdrop colour.
  //
  // Haze only starts beyond fogStart. Without that offset even a couple of
  // percent of a bright fog colour lands on the near shadows, and once it is
  // through the sRGB transfer those shadows are no longer black -- which is
  // most of what separates this from the reference.
  const dist = length(cameraPosition.sub(positionWorld));
  const hazeDistance = max(dist.sub(theme.fogStart), 0.0).mul(theme.fogDensity);
  const fogAmount = clamp(float(1.0).sub(exp(hazeDistance.mul(hazeDistance).negate())), 0.0, 1.0);
  color = mix(color, fogColor, fogAmount);

  const material = new MeshBasicNodeMaterial();
  material.positionNode = worldPosition;
  material.normalNode = basis.mul(localNormal);
  material.colorNode = vec4(color, 1.0);

  // ---------------------------------------------------------------------
  // Mesh
  // ---------------------------------------------------------------------
  const geometry = createTileGeometry({
    size: TILE_SIZE,
    height: TILE_HEIGHT,
    depth: TILE_DEPTH,
    chamfer: TILE_CHAMFER,
    domeRise: TILE_DOME_RISE,
    topSegments: TILE_TOP_SEGMENTS,
  });
  const count = GRID_N * GRID_N;
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;

  // Placement lives entirely in the shader, so every instance matrix is
  // identity; the attribute only exists to satisfy InstancedMesh.
  const identity = new Object3D();
  identity.updateMatrix();
  for (let i = 0; i < count; i++) {
    mesh.setMatrixAt(i, identity.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  // ---------------------------------------------------------------------
  // Post: depth of field, bloom, vignette, grain
  // ---------------------------------------------------------------------
  const postProcessing = new PostProcessing(renderer);
  const scenePass = pass(scene, camera);
  const sceneColor = scenePass.getTextureNode();
  const sceneViewZ = scenePass.getViewZNode();

  const uFocus = uniform(theme.focusDistance);
  const uFocusRange = uniform(theme.focusRange);
  const uBlurStrength = uniform(theme.blurStrength);

  const defocused = depthOfField({
    colorTexture: sceneColor,
    viewDistance: sceneViewZ.negate(),
    focusDistance: uFocus,
    focusRange: uFocusRange,
    blurStrength: uBlurStrength,
    aspect: width / height,
  });

  // Bloom is taken from the sharp scene rather than the defocused one: it is a
  // wide blur either way, and this keeps the gather from being run twice.
  const glow = bloomGlow({
    colorTexture: sceneColor,
    threshold: uniform(theme.bloomThreshold),
    strength: uniform(theme.bloomStrength),
    radius: uniform(theme.bloomRadius),
    aspect: width / height,
  });

  const bloomed = defocused.add(vec4(glow, 0.0));

  const centered = screenUV.sub(0.5);
  const vignette = float(1.0).sub(
    smoothstep(0.24, 0.78, length(centered.mul(vec2(1.06, 1.0)))).mul(theme.vignette),
  );

  // Grain. Deterministic in uTime, so a frame looks the same however Remotion
  // schedules it -- and seeded through sin/cos of the loop frequency rather
  // than raw time, so the noise pattern itself comes back around on the loop.
  const grainSeed = screenUV.x
    .mul(311.7)
    .add(screenUV.y.mul(191.999))
    .add(sin(uTime.mul(OMEGA)).mul(43.0))
    .add(cos(uTime.mul(OMEGA * 3)).mul(17.0));
  const grain = fract(sin(grainSeed).mul(43758.5453)).sub(0.5).mul(theme.grain);

  postProcessing.outputNode = bloomed.mul(vignette).add(grain);

  // ---------------------------------------------------------------------
  // Camera move -- a slow periodic drift so it settles back exactly on loop.
  // ---------------------------------------------------------------------
  const setTime = (seconds: number) => {
    const t = seconds * OMEGA;

    // Yawed off the grid axis, so the rows run diagonally across frame rather
    // than straight away from the camera -- as in the reference.
    const yaw = CAMERA_YAW + Math.sin(t) * 0.055;
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);

    const height = CAMERA_HEIGHT + Math.sin(t + 1.15) * 0.45;
    const drift = Math.sin(t) * 2.2 + Math.sin(t * 2 + 0.7) * 0.6;

    // Drift sideways along the camera's own right vector, so the move reads as
    // a slow lateral glide no matter which way the camera is facing.
    const posX = -forwardZ * drift;
    const posZ = forwardX * drift;

    camera.position.set(posX, height, posZ);

    // Aim well below the camera so the horizon falls above the top of frame --
    // the reference never shows it, the far field just dissolves into bloom.
    const aim = CAMERA_AIM_DISTANCE;
    camera.lookAt(
      posX + forwardX * aim,
      height - aim * Math.tan(CAMERA_PITCH) + Math.sin(t * 2 + 1.9) * 0.25,
      posZ + forwardZ * aim,
    );

    // A touch of roll, matching the tilted horizon of the reference.
    camera.rotation.z += CAMERA_ROLL + Math.sin(t + 0.4) * 0.016;
    camera.updateMatrixWorld();

    uTime.value = seconds;
  };

  const render = async () => {
    await postProcessing.renderAsync();
  };

  const setSize = (w: number, h: number) => {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const dispose = () => {
    geometry.dispose();
    material.dispose();
    mesh.dispose();
    postProcessing.dispose();
    renderer.dispose();
    canvas.remove();
  };

  setTime(0);

  return {
    setTime,
    render,
    setSize,
    dispose,
    backend: forceWebGL ? 'webgl2' : 'webgpu',
  };
};

/**
 * Does this platform actually have a *usable* WebGPU canvas?
 *
 * `navigator.gpu` existing is not enough. Headless Chrome without a GPU hands
 * back an adapter and a device and then fails to allocate the swapchain backing
 * for the canvas, which surfaces asynchronously ("Instance dropped in
 * popErrorScope") from inside the renderer where it cannot be caught. So this
 * drives a throwaway canvas through the whole path -- configure, acquire a
 * swapchain texture, clear it, wait for the queue to drain -- before the real
 * renderer is allowed to touch WebGPU.
 */
const probeWebGPU = async (): Promise<boolean> => {
  const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
  if (gpu === undefined) {
    return false;
  }

  let device: GPUDevice | undefined;

  try {
    const adapter = await gpu.requestAdapter();
    if (adapter === null) {
      return false;
    }

    device = await adapter.requestDevice();

    let deviceLost = false;
    void device.lost.then(() => {
      deviceLost = true;
    });

    const probeCanvas = document.createElement('canvas');
    probeCanvas.width = 64;
    probeCanvas.height = 64;

    const context = probeCanvas.getContext('webgpu');
    if (context === null) {
      return false;
    }

    context.configure({
      device,
      format: gpu.getPreferredCanvasFormat(),
      alphaMode: 'opaque',
    });

    device.pushErrorScope('validation');
    device.pushErrorScope('internal');

    const encoder = device.createCommandEncoder();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    renderPass.end();
    device.queue.submit([encoder.finish()]);

    await device.queue.onSubmittedWorkDone();

    const internalError = await device.popErrorScope();
    const validationError = await device.popErrorScope();

    context.unconfigure();

    return !deviceLost && internalError === null && validationError === null;
  } catch {
    return false;
  } finally {
    device?.destroy();
  }
};

/**
 * Build the scene, negotiating a backend.
 *
 * A platform can advertise `navigator.gpu` and still fail to produce a usable
 * device (headless Chrome without a GPU is the common case: the adapter comes
 * back, then the Dawn instance is dropped on the first submit). So WebGPU is
 * not trusted until it has actually rendered a frame -- if that trial render
 * throws, everything is torn down and rebuilt on WebGL2.
 */
export const createTileFieldScene = async (
  container: HTMLElement,
  theme: Theme,
  width: number,
  height: number,
  preference: BackendPreference = 'auto',
): Promise<TileFieldScene> => {
  const tryWebGPU =
    preference === 'webgpu' || (preference === 'auto' && (await probeWebGPU()));

  if (tryWebGPU) {
    let candidate: TileFieldScene | null = null;
    try {
      candidate = await buildScene(container, theme, width, height, false);
      await candidate.render();
      return candidate;
    } catch (error) {
      if (preference === 'webgpu') {
        throw error;
      }
      try {
        candidate?.dispose();
      } catch {
        // The device is already gone; nothing to reclaim.
      }
      container.replaceChildren();
      console.warn('[tile-field] WebGPU unusable, falling back to WebGL2:', error);
    }
  }

  return buildScene(container, theme, width, height, true);
};
