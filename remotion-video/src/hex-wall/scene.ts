/**
 * The three.js scene, driven by a WebGPURenderer.
 *
 * Headless Chrome has a GPU but no display compositor, so a WebGPU canvas
 * swap chain has nowhere to present to. Instead the renderer draws into an
 * offscreen render target, the pixels are read back, and the frame is written
 * onto a plain 2D canvas - which is what Remotion screenshots. Tone mapping
 * and the sRGB conversion still run because the target is installed as the
 * renderer's *output* target rather than as an intermediate one.
 */

import {
  AmbientLight,
  Color,
  CylinderGeometry,
  DirectionalLight,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardNodeMaterial,
  NeutralToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  RenderTarget,
  Scene,
  SRGBColorSpace,
  WebGPURenderer,
} from "three/webgpu";

import {
  CAMERA_FOV,
  HEX_DEPTH,
  HEX_FILL,
  HEX_RADIUS,
  VIEW_HEIGHT,
} from "./constants";
import { buildGrid, type Tile } from "./grid";
import { HEX_WALL_THEMES, type HexWallThemeName } from "./themes";
import { tileHeight } from "./wave";

export type SceneOptions = {
  readonly width: number;
  readonly height: number;
  readonly theme: HexWallThemeName;
  /** Multiplier on shadow map resolution, raised for the 4K composition. */
  readonly quality: number;
};

/** Front face of a resting tile - the plane the camera is framed against. */
const WALL_FRONT_Z = 0;

export class HexWallScene {
  private readonly options: SceneOptions;
  private readonly glCanvas: HTMLCanvasElement;
  private readonly tiles: Tile[] = buildGrid();
  private readonly matrix = new Matrix4();

  private renderer: WebGPURenderer | null = null;
  private target: RenderTarget | null = null;
  private pixels: Uint8ClampedArray | null = null;
  private scene: Scene | null = null;
  private camera: PerspectiveCamera | null = null;
  private instances: InstancedMesh | null = null;

  public constructor(options: SceneOptions) {
    this.options = options;
    this.glCanvas = document.createElement("canvas");
    this.glCanvas.width = options.width;
    this.glCanvas.height = options.height;
  }

  /** `true` once the renderer is up, telling us which backend we landed on. */
  public get backend(): string {
    const backend = this.renderer?.backend as
      | { isWebGPUBackend?: boolean }
      | undefined;
    if (!backend) {
      return "uninitialised";
    }
    return backend.isWebGPUBackend ? "WebGPU" : "WebGL2";
  }

  public async init(): Promise<void> {
    const { width, height, theme, quality } = this.options;
    const palette = HEX_WALL_THEMES[theme];

    const renderer = new WebGPURenderer({
      canvas: this.glCanvas,
      antialias: true,
      alpha: false,
      // Keep WebGPU as the primary backend; three falls back to WebGL2 by
      // itself when the browser has no adapter to hand out.
      forceWebGL: false,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.setClearColor(new Color(palette.background), 1);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = NeutralToneMapping;
    renderer.toneMappingExposure = palette.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;

    await renderer.init();

    // Everything is drawn into this target and read back frame by frame.
    const target = new RenderTarget(width, height, {
      samples: 4,
      depthBuffer: true,
      stencilBuffer: false,
    });
    renderer.setOutputRenderTarget(target);

    this.renderer = renderer;
    this.target = target;
    this.pixels = new Uint8ClampedArray(width * height * 4);

    const scene = new Scene();
    scene.background = new Color(palette.background);

    const camera = new PerspectiveCamera(CAMERA_FOV, width / height, 1, 300);
    const distance = VIEW_HEIGHT / 2 / Math.tan((CAMERA_FOV * Math.PI) / 360);
    camera.position.set(0, 0, WALL_FRONT_Z + distance);
    camera.lookAt(0, 0, 0);

    // --- the hexagonal prisms -------------------------------------------
    // A 6-sided cylinder is a hexagonal prism; rotating it a quarter turn
    // about X stands it up facing the camera, pointy side up.
    const geometry = new CylinderGeometry(
      HEX_RADIUS * HEX_FILL,
      HEX_RADIUS * HEX_FILL,
      HEX_DEPTH,
      6,
      1,
    );
    geometry.rotateX(-Math.PI / 2);
    // Park the front face on z = 0 so a resting tile is flush with the panel
    // behind it and the wall reads as one unbroken surface.
    geometry.translate(0, 0, -HEX_DEPTH / 2);

    const material = new MeshStandardNodeMaterial({
      color: new Color(palette.tile),
      roughness: palette.roughness,
      metalness: 0,
      flatShading: true,
    });

    const instances = new InstancedMesh(geometry, material, this.tiles.length);
    instances.castShadow = true;
    instances.receiveShadow = true;
    instances.frustumCulled = false;
    scene.add(instances);
    this.instances = instances;

    // --- the panel the tiles sit in front of -----------------------------
    const backdrop = new Mesh(
      new PlaneGeometry(220, 140),
      new MeshStandardNodeMaterial({
        color: new Color(palette.backdrop),
        roughness: 0.9,
        metalness: 0,
      }),
    );
    backdrop.position.z = -0.008;
    backdrop.receiveShadow = true;
    scene.add(backdrop);

    // --- studio lighting --------------------------------------------------
    const key = new DirectionalLight(
      new Color(palette.keyLight.color),
      palette.keyLight.intensity,
    );
    key.position.set(-26, 32, 46);
    key.castShadow = true;
    const shadowSize = Math.round(3072 * quality);
    key.shadow.mapSize.set(shadowSize, shadowSize);
    key.shadow.camera.left = -40;
    key.shadow.camera.right = 40;
    key.shadow.camera.top = 30;
    key.shadow.camera.bottom = -30;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 160;
    key.shadow.bias = -0.0012;
    key.shadow.normalBias = 0.04;
    key.shadow.radius = 3;
    key.shadow.intensity = 0.7;
    scene.add(key);

    const fill = new DirectionalLight(
      new Color(palette.fillLight.color),
      palette.fillLight.intensity,
    );
    fill.position.set(34, -14, 40);
    scene.add(fill);

    const rim = new DirectionalLight(
      new Color(palette.rimLight.color),
      palette.rimLight.intensity,
    );
    rim.position.set(6, 30, -18);
    scene.add(rim);

    scene.add(
      new AmbientLight(
        new Color(palette.ambient.color),
        palette.ambient.intensity,
      ),
    );
    scene.add(
      new HemisphereLight(
        new Color(palette.hemisphere.sky),
        new Color(palette.hemisphere.ground),
        palette.hemisphere.intensity,
      ),
    );

    this.scene = scene;
    this.camera = camera;

    // Put the tiles somewhere sensible before the first draw.
    this.update(0);
  }

  /** Move every tile to where it should be at `seconds`. */
  private update(seconds: number) {
    const instances = this.instances;
    if (!instances) {
      return;
    }

    for (let i = 0; i < this.tiles.length; i++) {
      const tile = this.tiles[i];
      const z = tileHeight(tile.radius, seconds, tile.jitter);
      this.matrix.makeTranslation(tile.x, tile.y, z);
      instances.setMatrixAt(i, this.matrix);
    }

    instances.instanceMatrix.needsUpdate = true;
  }

  /** Draw `seconds` and write the result onto `canvas`. */
  public async renderFrame(
    seconds: number,
    canvas: HTMLCanvasElement,
  ): Promise<void> {
    const { renderer, scene, camera, target, pixels } = this;
    if (!renderer || !scene || !camera || !target || !pixels) {
      throw new Error("HexWallScene.renderFrame called before init()");
    }

    const { width, height } = this.options;

    this.update(seconds);
    await renderer.renderAsync(scene, camera);

    const read = (await renderer.readRenderTargetPixelsAsync(
      target,
      0,
      0,
      width,
      height,
    )) as Uint8Array;

    // The readback starts at the bottom row of the target, so walk it
    // backwards into the image buffer.
    const stride = width * 4;
    for (let row = 0; row < height; row++) {
      pixels.set(
        read.subarray((height - 1 - row) * stride, (height - row) * stride),
        row * stride,
      );
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get a 2D context for the output canvas");
    }
    ctx.putImageData(new ImageData(pixels, width, height), 0, 0);
  }

  public dispose() {
    this.instances?.geometry.dispose();
    this.target?.dispose();
    this.renderer?.dispose();
    this.target = null;
    this.pixels = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.instances = null;
  }
}
