import {
  ACESFilmicToneMapping,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  InstancedMesh,
  MeshPhysicalNodeMaterial,
  Object3D,
  PerspectiveCamera,
  LinearSRGBColorSpace,
  PostProcessing,
  RenderTarget,
  Scene,
  SRGBColorSpace,
  UnsignedByteType,
  WebGPURenderer,
  type TubeGeometry,
  type Texture,
} from "three/webgpu";
import { pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import {
  AXIS_PITCH_DEG,
  AXIS_YAW_DEG,
  BEND_AMPLITUDE,
  BEND_WAVELENGTH_PLATES,
  BLOOM_RADIUS,
  BLOOM_STRENGTH,
  BLOOM_THRESHOLD,
  CAMERA_DISTANCE,
  CAMERA_FOV,
  DURATION_IN_FRAMES,
  LOOP_ADVANCE_PLATES,
  PLATE_TUBE_RADIUS,
  PLATE_COUNT,
  PLATE_OUTER_SIZE,
  PLATE_SPACING,
  TWIST_PER_PLATE,
} from "./constants";
import { createPlateGeometry } from "./plateGeometry";
import { createEnvironment } from "./environment";
import type { Variant } from "./variants";

const DEG = Math.PI / 180;

export type Backend = "webgpu" | "webgl2";

export type TwistTuning = {
  cameraFov?: number;
  cameraDistance?: number;
  axisYawDeg?: number;
  axisPitchDeg?: number;
  twistPerPlate?: number;
  plateSpacing?: number;
  plateOuterSize?: number;
  plateTubeRadius?: number;
  plateCount?: number;
};

export type TwistSceneOptions = {
  width: number;
  height: number;
  variant: Variant;
  /** Optional art-direction overrides; see GlassTwist's schema. */
  tuning?: TwistTuning;
};

// Resolved settings = constants, with any tuning override applied.
type Settings = {
  cameraFov: number;
  cameraDistance: number;
  axisYawDeg: number;
  axisPitchDeg: number;
  twistPerPlate: number;
  plateSpacing: number;
  plateOuterSize: number;
  plateTubeRadius: number;
  plateCount: number;
};

const resolveSettings = (tuning?: TwistTuning): Settings => ({
  cameraFov: tuning?.cameraFov ?? CAMERA_FOV,
  cameraDistance: tuning?.cameraDistance ?? CAMERA_DISTANCE,
  axisYawDeg: tuning?.axisYawDeg ?? AXIS_YAW_DEG,
  axisPitchDeg: tuning?.axisPitchDeg ?? AXIS_PITCH_DEG,
  twistPerPlate: tuning?.twistPerPlate ?? TWIST_PER_PLATE,
  plateSpacing: tuning?.plateSpacing ?? PLATE_SPACING,
  plateOuterSize: tuning?.plateOuterSize ?? PLATE_OUTER_SIZE,
  plateTubeRadius: tuning?.plateTubeRadius ?? PLATE_TUBE_RADIUS,
  plateCount: Math.round(tuning?.plateCount ?? PLATE_COUNT),
});

const createBackground = (variant: Variant): Texture => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 288;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // A soft haze sitting behind the shape, brightest where the stack
  // crosses the frame, so the black does not read as flat nothing.
  const glow = ctx.createRadialGradient(
    canvas.width * 0.5, canvas.height * 0.42, 0,
    canvas.width * 0.5, canvas.height * 0.42, canvas.width * 0.52,
  );
  glow.addColorStop(0, variant.glowColor);
  glow.addColorStop(0.55, "rgba(0,0,0,0.75)");
  glow.addColorStop(1, "#000000");
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

export class TwistScene {
  private readonly options: TwistSceneOptions;
  private readonly settings: Settings;
  private readonly dummy = new Object3D();

  private renderer!: WebGPURenderer;
  private canvas!: HTMLCanvasElement;
  private scene!: Scene;
  private camera!: PerspectiveCamera;
  private group!: Group;
  private mesh!: InstancedMesh;
  private geometry!: TubeGeometry;
  private material!: MeshPhysicalNodeMaterial;
  private environment?: { texture: Texture; dispose: () => void };
  private background?: Texture;
  private postProcessing?: PostProcessing;
  private readTarget?: RenderTarget;
  private pixels?: Uint8ClampedArray;

  /** Which backend actually ended up driving the render. */
  public backend: Backend = "webgpu";

  constructor(options: TwistSceneOptions) {
    this.options = options;
    this.settings = resolveSettings(options.tuning);
  }

  public get domElement(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Builds the scene on WebGPU, falling back to WebGL2 if anything in the
   * WebGPU path fails.
   *
   * A plain capability check is not enough here: headless Chrome reports a
   * WebGPU adapter and `renderer.init()` succeeds, but the render itself
   * can then blow up on a spec mismatch between the browser's WebGPU
   * implementation and three's. So the whole build *and* a probe render
   * run inside the try, and only a clean frame counts as success.
   */
  public async init(): Promise<void> {
    if (await TwistScene.webgpuAvailable()) {
      try {
        await this.build("webgpu");
        await this.renderFrame(0);
        this.backend = "webgpu";
        return;
      } catch (webgpuError) {
        console.warn(
          "[glass-twist] WebGPU backend failed, falling back to WebGL2:",
          webgpuError instanceof Error ? webgpuError.message : webgpuError,
        );
        this.disposeInternals();
      }
    }

    await this.build("webgl2");
    await this.renderFrame(0);
    this.backend = "webgl2";
  }

  private static async webgpuAvailable(): Promise<boolean> {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    if (!gpu) return false;
    try {
      return (await gpu.requestAdapter()) !== null;
    } catch {
      return false;
    }
  }

  private async build(mode: Backend): Promise<void> {
    const { width, height, variant } = this.options;

    // A fresh canvas per attempt: once a canvas has handed out a WebGPU
    // context it cannot hand out a WebGL2 one.
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;

    // On the WebGL2 path the context is created here rather than left to
    // three, purely so preserveDrawingBuffer can be set.
    //
    // Without it, reading the canvas -- which is what Remotion's
    // screenshot ultimately does -- hands back the last *composited*
    // contents rather than what was just drawn. The symptom is subtle and
    // nasty: stills freeze on the first frame and the video comes out
    // shifted one frame late, while still looking perfectly plausible.
    const rendererParameters: ConstructorParameters<typeof WebGPURenderer>[0] =
      { canvas: this.canvas, antialias: true, alpha: false };

    if (mode === "webgl2") {
      const gl = this.canvas.getContext("webgl2", {
        antialias: true,
        alpha: false,
        depth: true,
        stencil: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      });
      if (gl === null) throw new Error("WebGL2 is not available");
      rendererParameters.context = gl;
      rendererParameters.forceWebGL = true;
    }

    this.renderer = new WebGPURenderer(rendererParameters);
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.62;
    this.renderer.outputColorSpace = SRGBColorSpace;
    await this.renderer.init();

    const st = this.settings;
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(st.cameraFov, width / height, 0.1, 400);
    this.camera.position.set(0, 0, st.cameraDistance);
    this.camera.lookAt(0, 0, 0);

    this.background = createBackground(variant);
    this.scene.background = this.background;

    this.environment = createEnvironment(this.renderer, variant);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 1;

    this.geometry = createPlateGeometry(st.plateOuterSize, st.plateTubeRadius);
    this.material = new MeshPhysicalNodeMaterial({
      color: new Color(variant.glassColor),
      metalness: 0,
      roughness: 0.035,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      ior: 1.52,
      reflectivity: 1,
      envMapIntensity: 9.6,
      // Genuinely see-through glass: you can look through the near side
      // of a loop to its far side, and through each bar to the ones
      // stacked behind it.
      //
      // This only works because the bars are spaced well apart. At the
      // reference's tighter pitch, ~20 loops overlap on screen at once
      // and blending them stops reading as depth -- it collapses into a
      // wiry lattice -- which is why an earlier pass rendered them
      // opaque. Widening the gaps is what buys the transparency back.
      //
      // depthWrite is off so overlapping bars blend instead of clipping
      // each other; updateInstances() writes them back to front, which
      // is what makes that safe.
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });

    this.mesh = new InstancedMesh(this.geometry, this.material, st.plateCount);
    this.mesh.frustumCulled = false;

    // Mirroring flips the on-screen direction of the stack axis; combined
    // with the negated twist step in updateInstances, that is a true
    // reflection rather than just a different camera angle.
    this.group = new Group();
    this.group.rotation.order = "YXZ";
    this.group.rotation.y = st.axisYawDeg * DEG * variant.mirror;
    this.group.rotation.x = st.axisPitchDeg * DEG;
    this.group.add(this.mesh);
    this.scene.add(this.group);

    const key = new DirectionalLight(0xffffff, 0.35);
    key.position.set(-3, 4, 5);
    this.scene.add(key);
    const rim = new DirectionalLight(new Color(variant.innerGlowColor), 0.25);
    rim.position.set(4, -2, -4);
    this.scene.add(rim);

    // Bloom turns the hot specular streaks into the glow that bleeds
    // around the shape in the reference.
    const scenePass = pass(this.scene, this.camera);
    const scenePassColor = scenePass.getTextureNode("output");
    const bloomPass = bloom(
      scenePassColor,
      BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD,
    );
    this.postProcessing = new PostProcessing(this.renderer);
    this.postProcessing.outputNode = scenePassColor.add(bloomPass);

    // Frames are rendered into this target and read back on the CPU
    // rather than being taken off the canvas -- see renderFrame().
    // LinearSRGBColorSpace here means "no conversion on write". The
    // post-processing chain has already applied tone mapping and the
    // sRGB encode, so tagging the target as sRGB would encode it a
    // second time and wash the image out.
    this.readTarget = new RenderTarget(width, height, {
      type: UnsignedByteType,
      colorSpace: LinearSRGBColorSpace,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.pixels = new Uint8ClampedArray(width * height * 4);

    this.updateInstances(0);
  }

  private updateInstances(frame: number): void {
    const loopT = frame / DURATION_IN_FRAMES;

    // Advance along the stack, measured in plate notches. Only the
    // fractional part is needed: shifting by a whole notch maps the stack
    // exactly onto itself, so using the fraction keeps the stack centred
    // while the pattern flows through it -- and guarantees the last frame
    // joins back onto the first.
    const advance = LOOP_ADVANCE_PLATES * loopT;
    const u = advance - Math.floor(advance);

    const st = this.settings;
    const twist = st.twistPerPlate * this.options.variant.mirror;

    // Alpha blending needs the bars drawn back to front, and an
    // InstancedMesh draws strictly in index order with no depth sort. So
    // instance 0 has to be the bar furthest from the camera.
    //
    // Which end that is depends on where the stack axis points: the world
    // Z of the local +Z axis says whether walking up the stack walks
    // towards the camera or away from it. Deriving it here (rather than
    // hard-coding an order to match the current yaw) keeps the blending
    // correct if the framing is ever re-aimed.
    const axisWorldZ =
      Math.cos(st.axisYawDeg * DEG * this.options.variant.mirror) *
      Math.cos(st.axisPitchDeg * DEG);
    const higherSlotIsNearer = axisWorldZ > 0;
    const bendWavelength = BEND_WAVELENGTH_PLATES * st.plateSpacing;
    const centre = (st.plateCount - 1) / 2;

    // The bend is authored against the default plate size, so scale it if
    // the plate size is being tuned.
    const bendAmplitude =
      BEND_AMPLITUDE * (st.plateOuterSize / PLATE_OUTER_SIZE);

    for (let i = 0; i < st.plateCount; i++) {
      // Instance 0 must be the furthest bar. If walking up the stack
      // walks towards the camera, the lowest slot is furthest; otherwise
      // it is the highest.
      const k = higherSlotIsNearer ? i : st.plateCount - 1 - i;
      // u is subtracted rather than added so the pattern flows down the
      // axis towards the camera. That direction is measured off the
      // reference by correlating consecutive frames along the axis: its
      // pattern travels lower-left. Subtracting maps bar k onto bar k-1
      // after one whole notch instead of bar k+1, so the loop still
      // closes exactly.
      const t = k - centre - u;
      const z = t * st.plateSpacing;

      // A gentle travelling wave so the stack breathes rather than
      // sitting rigid.
      //
      // Both components must advance a whole number of cycles over the
      // loop or the last frame will not join the first. The vertical
      // component gets a slower *spatial* frequency to keep it from
      // looking like a copy of the horizontal one, but its time phase
      // still advances exactly 2*PI per loop -- halving that too (the
      // obvious way to write it) flips its sign across the loop point
      // and puts a visible jump in an otherwise seamless cycle.
      const spatialPhase = (z / bendWavelength) * Math.PI * 2;
      const timePhase = loopT * Math.PI * 2;
      const bendX =
        Math.sin(spatialPhase + timePhase) *
        bendAmplitude *
        this.options.variant.mirror;
      const bendY =
        Math.cos(spatialPhase * 0.5 + timePhase) * bendAmplitude * 0.42;

      this.dummy.position.set(bendX, bendY, z);
      this.dummy.rotation.set(0, 0, t * twist);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Renders one frame and returns it as pixel data, ready to be put
   * straight onto a 2D canvas.
   *
   * The readback is deliberate. The obvious approaches -- letting
   * Remotion screenshot the WebGL/WebGPU canvas, or copying it with
   * drawImage -- both silently hand back a stale frame here: three
   * renders through internal framebuffers, and what reaches the canvas
   * (and the compositor) lags a frame behind. The failure is quiet and
   * convincing: every still comes out as frame 0 and the video looks
   * animated but sits one frame late. Neither preserveDrawingBuffer nor
   * forcing the GPU to finish fixes it.
   *
   * Reading the render target's pixels takes the canvas and the browser's
   * compositor out of the loop entirely, so the frame Remotion captures
   * is exactly the frame that was asked for.
   */
  public async renderFrame(frame: number): Promise<ImageData> {
    const { width, height } = this.options;
    this.updateInstances(frame);

    this.renderer.setRenderTarget(this.readTarget!);
    this.postProcessing!.render();
    this.renderer.setRenderTarget(null);

    const data = (await this.renderer.readRenderTargetPixelsAsync(
      this.readTarget!,
      0,
      0,
      width,
      height,
    )) as Uint8Array;

    // The two backends disagree on row order: the WebGL path ends in
    // gl.readPixels, which returns bottom-up, while the WebGPU path
    // copies the texture and returns top-down. ImageData wants top-down.
    const out = this.pixels!;
    const rowBytes = width * 4;
    if (this.backend === "webgl2") {
      for (let y = 0; y < height; y++) {
        const src = (height - 1 - y) * rowBytes;
        out.set(data.subarray(src, src + rowBytes), y * rowBytes);
      }
    } else {
      out.set(data);
    }
    return new ImageData(out, width, height);
  }

  private disposeInternals(): void {
    this.geometry?.dispose();
    this.material?.dispose();
    this.mesh?.dispose();
    this.environment?.dispose();
    this.background?.dispose();
    this.postProcessing?.dispose();
    this.readTarget?.dispose();
    this.renderer?.dispose();
    this.environment = undefined;
    this.background = undefined;
    this.postProcessing = undefined;
    this.readTarget = undefined;
  }

  public dispose(): void {
    this.disposeInternals();
  }
}
