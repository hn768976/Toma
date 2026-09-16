import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  InstancedMesh,
  Matrix4,
  MeshPhysicalNodeMaterial,
  Object3D,
  PerspectiveCamera,
  PointLight,
  PostProcessing,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu';
import {
  color,
  float,
  mix,
  normalView,
  pass,
  positionViewDirection,
  screenUV,
  smoothstep,
  vec2,
} from 'three/tsl';
import {bloom} from 'three/addons/tsl/display/BloomNode.js';
import type {Palette} from '../theme';
import {createEnvironment} from './environment';
import {createFrameGeometry, createLayerCells} from './lattice';
import {motionAtFrame} from './animation';

const FRONT_COLS = 5;
const FRONT_ROWS = 6;
const BACK_COLS = 4;
const BACK_ROWS = 4;
/** How far the second lattice sits behind the first, in world units. */
const BACK_OFFSET_Z = -1.35;

export type Backend = 'webgpu' | 'webgl2';

export type LatticeScene = {
  backend: Backend;
  renderFrame: (frame: number) => Promise<void>;
  dispose: () => void;
};

/**
 * Glass, as additive fresnel-weighted slabs.
 *
 * `MeshPhysicalNodeMaterial.transmission` is a no-op on the WebGL2 backend used
 * for headless renders — a solid probe mesh comes back fully opaque — so real
 * refraction is not available here. Additive blending gets the same read on a
 * dark field and is order independent, which matters for a woven lattice where
 * bars cross: every slab shows through every other, and crossings brighten,
 * exactly as in the reference.
 *
 * Opacity is fresnel weighted, so the flat faces stay faint and let what is
 * behind them through, while grazing angles — the slab edges and the inner
 * walls — go bright. That is where the reference gets its drawn-in-light look.
 */
const createGlassMaterial = (palette: Palette, options: {face: number; edge: number}) => {
  const material = new MeshPhysicalNodeMaterial({
    color: new Color(palette.glass),
    metalness: 0,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    specularIntensity: 1,
    envMapIntensity: 2.2,
  });

  material.transparent = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;

  const grazing = normalView.dot(positionViewDirection).abs().clamp(0, 1).oneMinus();
  material.opacityNode = mix(float(options.face), float(options.edge), grazing.pow(1.6));
  material.emissiveNode = color(palette.rimLight).mul(grazing.pow(3.5).mul(0.9));

  return material;
};

const buildLayer = (material: MeshPhysicalNodeMaterial, cols: number, rows: number) => {
  const cells = createLayerCells(cols, rows);
  const mesh = new InstancedMesh(createFrameGeometry(), material, cells.length);
  mesh.frustumCulled = false;

  const matrix = new Matrix4();
  const position = new Vector3();
  // The cell geometry is already a rhombus, so instances are unrotated; the
  // axis-aligned grid then makes neighbouring diamonds meet corner to corner.
  const rotation = new Quaternion();
  const scaleVector = new Vector3(1, 1, 1);

  cells.forEach((cell, i) => {
    position.set(cell.x, cell.y, cell.z);
    matrix.compose(position, rotation, scaleVector);
    mesh.setMatrixAt(i, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
};

export const createLatticeScene = async (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  palette: Palette,
  forceWebGL: boolean,
): Promise<LatticeScene> => {
  // `WebGPURenderer` runs the same TSL node graph on either backend, so the
  // WebGL2 fallback is pixel-comparable — see `resolveForceWebGL()`.
  let renderer = new WebGPURenderer({canvas, antialias: true, forceWebGL});
  try {
    await renderer.init();
  } catch (err) {
    if (forceWebGL) {
      throw err;
    }
    renderer.dispose();
    renderer = new WebGPURenderer({canvas, antialias: true, forceWebGL: true});
    await renderer.init();
    console.warn('WebGPU unavailable, using the WebGL2 backend:', (err as Error)?.message);
  }

  const backend: Backend = (renderer.backend as {isWebGPUBackend?: boolean} | undefined)?.isWebGPUBackend
    ? 'webgpu'
    : 'webgl2';

  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const background = new Color(palette.background);
  // Linear fog, tuned so the near lattice is untouched and the yawed far
  // side dissolves into the backdrop — that is the empty half of the frame.
  scene.fog = new Fog(background, 2.7, 5.2);

  // Radial falloff from a glow low on the lit side out to near black.
  const distance = screenUV.sub(vec2(0.24, 0.38)).mul(vec2(0.8, 1)).length();
  scene.backgroundNode = mix(
    color(palette.backgroundGlow),
    color(background),
    smoothstep(0.0, 0.62, distance),
  );

  scene.environment = await createEnvironment(renderer, palette.envTop, palette.envBottom);
  scene.environmentIntensity = 1.0;

  const camera = new PerspectiveCamera(32, width / height, 0.1, 100);

  const group = new Object3D();
  const frontMaterial = createGlassMaterial(palette, {face: 0.095, edge: 0.85});
  const backMaterial = createGlassMaterial(palette, {face: 0.045, edge: 0.3});
  backMaterial.roughness = 0.1;

  group.add(buildLayer(frontMaterial, FRONT_COLS, FRONT_ROWS));

  const back = buildLayer(backMaterial, BACK_COLS, BACK_ROWS);
  // Half a cell across keeps the rear lattice from lining up with the front one.
  back.position.set(0.68, 0.94, BACK_OFFSET_Z);
  group.add(back);
  scene.add(group);

  scene.add(new AmbientLight(new Color(palette.fillLight), 0.06));

  const key = new PointLight(new Color(palette.keyLight), 55, 0, 2);
  key.position.set(-2.7, 2.4, 2.9);
  scene.add(key);

  const fill = new PointLight(new Color(palette.fillLight), 14, 0, 2);
  fill.position.set(-1.8, -2.0, 1.8);
  scene.add(fill);

  const rim = new PointLight(new Color(palette.emissive), 14, 0, 2);
  rim.position.set(-0.4, 2.0, 0.9);
  scene.add(rim);

  // Non-attenuating raking light so every band, near or far, keeps the same
  // bright-to-dark gradient across its faces.
  const rake = new DirectionalLight(new Color(palette.keyLight), 0.55);
  rake.position.set(-3, 2.4, 2.2);
  scene.add(rake);

  const postProcessing = new PostProcessing(renderer);
  const scenePass = pass(scene, camera);
  const scenePassColor = scenePass.getTextureNode('output');
  postProcessing.outputNode = scenePassColor.add(bloom(scenePassColor, 1.3, 0.8, 0.45));

  const target = new Vector3();

  const renderFrame = async (frame: number) => {
    const motion = motionAtFrame(frame);
    group.rotation.set(...motion.groupRotation);
    group.position.set(...motion.groupPosition);
    camera.position.set(...motion.cameraPosition);
    camera.lookAt(target.set(...motion.cameraTarget));
    camera.updateMatrixWorld();
    await postProcessing.renderAsync();
  };

  const dispose = () => {
    postProcessing.dispose();
    renderer.dispose();
  };

  return {backend, renderFrame, dispose};
};
