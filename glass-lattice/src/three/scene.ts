import {
  ACESFilmicToneMapping,
  Fog,
  AmbientLight,
  DirectionalLight,
  Color,
  Euler,
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
import {color, mix, normalView, pass, positionViewDirection, screenUV, smoothstep, vec2} from 'three/tsl';
import {bloom} from 'three/addons/tsl/display/BloomNode.js';
import type {Palette} from '../theme';
import {createEnvironment} from './environment';
import {createFrameGeometry, createLayerCells} from './lattice';
import {motionAtFrame} from './animation';

const FRONT_COLS = 5;
const FRONT_ROWS = 8;
const BACK_COLS = 5;
const BACK_ROWS = 6;
/** How far the second lattice sits behind the first, in world units. */
const BACK_OFFSET_Z = -1.35;

export type Backend = 'webgpu' | 'webgl2';

export type LatticeScene = {
  backend: Backend;
  renderFrame: (frame: number) => Promise<void>;
  dispose: () => void;
};

/**
 * Fresnel-driven emission in two bands.
 *
 * A very tight term paints a near-white line along every silhouette and bevel —
 * the strongest read in the reference — and a much broader, dimmer term lets
 * colour bleed through the body of the glass. Facing surfaces stay dark, so the
 * contrast between the lit edges and the flat faces survives.
 */
const createGlassMaterial = (palette: Palette, gain: number) => {
  const material = new MeshPhysicalNodeMaterial({
    color: new Color(palette.glass),
    metalness: 0,
    roughness: 0.05,
    clearcoat: 0.85,
    clearcoatRoughness: 0.1,
    envMapIntensity: 3.0,
  });

  const grazing = normalView.dot(positionViewDirection).abs().clamp(0, 1).oneMinus();
  const edge = grazing.pow(6).mul(1.5 * gain);
  const body = grazing.pow(1.6).mul(0.22 * gain);
  material.emissiveNode = color(palette.rimLight)
    .mul(edge)
    .add(color(palette.emissive).mul(body));

  return material;
};

const buildLayer = (
  material: MeshPhysicalNodeMaterial,
  cols: number,
  rows: number,
  scale: number,
) => {
  const cells = createLayerCells(cols, rows);
  const mesh = new InstancedMesh(createFrameGeometry(), material, cells.length);
  mesh.frustumCulled = false;

  const matrix = new Matrix4();
  const position = new Vector3();
  // Each frame is a square turned 45deg into a diamond; the grid itself stays
  // axis aligned, so neighbouring diamonds meet corner to corner.
  const rotation = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 4));
  const scaleVector = new Vector3(scale, scale, scale);

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
  // WebGL2 fallback is pixel-comparable — see `resolveBackend()`.
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
  renderer.toneMappingExposure = 1.22;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const background = new Color(palette.background);
  // Linear fog, tuned so the near lattice is untouched and the yawed far
  // side dissolves into the backdrop — that is the empty half of the frame.
  scene.fog = new Fog(background, 2.3, 6.0);

  // Radial falloff from a glow low on the lit side out to near black.
  const distance = screenUV.sub(vec2(0.34, 0.46)).mul(vec2(0.78, 1)).length();
  scene.backgroundNode = mix(
    color(palette.backgroundGlow),
    color(background),
    smoothstep(0.0, 0.72, distance),
  );

  scene.environment = await createEnvironment(renderer, palette.envTop, palette.envBottom);
  scene.environmentIntensity = 1;

  const camera = new PerspectiveCamera(32, width / height, 0.1, 100);

  const group = new Object3D();
  const frontMaterial = createGlassMaterial(palette, 1.2);
  const backMaterial = createGlassMaterial(palette, 0.5);
  backMaterial.roughness = 0.16;
  backMaterial.envMapIntensity = 0.9;

  group.add(buildLayer(frontMaterial, FRONT_COLS, FRONT_ROWS, 1));

  const back = buildLayer(backMaterial, BACK_COLS, BACK_ROWS, 1);
  // Half a cell across keeps the rear lattice from lining up with the front one.
  back.position.set(0.66, 0.66, BACK_OFFSET_Z);
  group.add(back);
  scene.add(group);

  scene.add(new AmbientLight(new Color(palette.fillLight), 0.06));

  const key = new PointLight(new Color(palette.keyLight), 45, 0, 2);
  key.position.set(-2.8, 1.8, 2.8);
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
  postProcessing.outputNode = scenePassColor.add(bloom(scenePassColor, 1.0, 0.75, 0.5));

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
