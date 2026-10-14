import {
  autoDetectRenderer,
  CanvasSource,
  Container,
  Mesh,
  MeshGeometry,
  RenderTexture,
  Shader,
  Texture,
  UniformGroup,
  type Renderer,
} from "pixi.js";
import { BLUE_NOISE, BLUE_NOISE_SIZE } from "./blueNoise";
import { BLUR_FRAG, DOWN_FRAG, FULLSCREEN_VERT, finalFragment } from "./glsl";
import { DESIGN_H, DESIGN_W, LOOP } from "./loop";
import { bakeSpriteKit, type SpriteKit } from "./sprites";

export type Look = {
  /** GLSL declaring the look's uniforms and `vec3 background(vec2 p)` (p in 3840x2160 design px). */
  glsl: string;
  /** The look's own uniforms (names must match the GLSL). */
  uniforms: UniformGroup;
  /** Sprite layers, authored in design px. */
  sprites: Container;
  /** Pure function of the frame: sets particle and uniform values. */
  update: (frame: number) => void;
  post: {
    bloom1: number;
    bloom2: number;
    grain: number;
    dither: boolean;
    spriteGain: number;
    screen: boolean;
  };
};

export type LookFactory = (kit: SpriteKit) => Look;

const quad = (w: number, h: number) =>
  new MeshGeometry({
    positions: new Float32Array([0, 0, w, 0, w, h, 0, h]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  });

const pass = (w: number, h: number, fragment: string, resources: Record<string, unknown>) => {
  const shader = Shader.from({
    gl: { vertex: FULLSCREEN_VERT, fragment, name: "fullscreen-pass" },
    resources,
  });
  const mesh = new Mesh({ geometry: quad(w, h), shader });
  const root = new Container();
  root.addChild(mesh);
  return { root, shader };
};

const halfFloatTarget = (w: number, h: number, label: string) =>
  RenderTexture.create({
    width: w,
    height: h,
    resolution: 1,
    format: "rgba16float",
    scaleMode: "linear",
    addressMode: "clamp-to-edge",
    antialias: false,
    label,
  });

const blueNoiseTexture = () => {
  const n = BLUE_NOISE_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    const v = Math.min(255, Math.floor(BLUE_NOISE[i] * 256));
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const source = new CanvasSource({ resource: canvas, scaleMode: "nearest", addressMode: "repeat" });
  return new Texture({ source });
};

export class LightEngine {
  private renderer!: Renderer;
  private look!: Look;
  private spriteWrap = new Container();
  private rtSprites!: RenderTexture;
  private chain: { rt: RenderTexture; root: Container }[] = [];
  private final!: { root: Container; shader: Shader };
  private postUniforms!: UniformGroup;

  async init(canvas: HTMLCanvasElement, physW: number, physH: number, factory: LookFactory) {
    this.renderer = await autoDetectRenderer({
      preference: "webgl",
      canvas,
      width: physW,
      height: physH,
      resolution: 1,
      antialias: false,
      preserveDrawingBuffer: true,
      backgroundColor: 0x000000,
      backgroundAlpha: 1,
      powerPreference: "high-performance",
      hello: false,
    } as Parameters<typeof autoDetectRenderer>[0]);
    const kit = bakeSpriteKit();
    this.look = factory(kit);

    this.look.sprites.scale.set(physW / DESIGN_W, physH / DESIGN_H);
    this.spriteWrap.addChild(this.look.sprites);
    this.rtSprites = halfFloatTarget(physW, physH, "sprites");

    // Bloom chain: 1/2 -> 1/4 (blur = bloom1) -> 1/8 -> 1/16 (blur = bloom2).
    const sizes = [2, 4, 8, 16].map((d) => [Math.max(1, Math.ceil(physW / d)), Math.max(1, Math.ceil(physH / d))]);
    const downs: RenderTexture[] = sizes.map(([w, h], i) => halfFloatTarget(w, h, `down${i}`));
    const tmp4 = halfFloatTarget(sizes[1][0], sizes[1][1], "tmp4");
    const tmp16 = halfFloatTarget(sizes[3][0], sizes[3][1], "tmp16");
    const bloom1 = halfFloatTarget(sizes[1][0], sizes[1][1], "bloom1");
    const bloom2 = halfFloatTarget(sizes[3][0], sizes[3][1], "bloom2");
    const down = (src: RenderTexture, dst: RenderTexture) => ({
      rt: dst,
      root: pass(dst.width, dst.height, DOWN_FRAG, { uSrc: src.source }).root,
    });
    const blur = (src: RenderTexture, dst: RenderTexture, dx: number, dy: number) => ({
      rt: dst,
      root: pass(dst.width, dst.height, BLUR_FRAG, {
        uSrc: src.source,
        blurUniforms: new UniformGroup({ uStep: { value: new Float32Array([dx / src.width, dy / src.height]), type: "vec2<f32>" } }),
      }).root,
    });
    this.chain = [
      down(this.rtSprites, downs[0]),
      down(downs[0], downs[1]),
      blur(downs[1], tmp4, 1, 0),
      blur(tmp4, bloom1, 0, 1),
      down(downs[1], downs[2]),
      down(downs[2], downs[3]),
      blur(downs[3], tmp16, 1, 0),
      blur(tmp16, bloom2, 0, 1),
    ];

    const p = this.look.post;
    this.postUniforms = new UniformGroup({
      uFrame: { value: 0, type: "f32" },
      uPhase: { value: 0, type: "f32" },
      uPost: { value: new Float32Array([p.bloom1, p.bloom2, p.grain, p.dither ? 1 : 0]), type: "vec4<f32>" },
      uSpriteMix: { value: new Float32Array([p.spriteGain, p.screen ? 1 : 0, 0, 0]), type: "vec4<f32>" },
    });
    this.final = pass(physW, physH, finalFragment(this.look.glsl), {
      postUniforms: this.postUniforms,
      lookUniforms: this.look.uniforms,
      uSprites: this.rtSprites.source,
      uBloom1: bloom1.source,
      uBloom2: bloom2.source,
      uBlueNoise: blueNoiseTexture().source,
    });
  }

  /** Renders one Remotion frame. Every value is derived from `frame` alone. */
  render(frame: number) {
    const f = ((frame % LOOP) + LOOP) % LOOP;
    this.look.update(f);
    this.postUniforms.uniforms.uFrame = f;
    this.postUniforms.uniforms.uPhase = f / LOOP;
    const r = this.renderer;
    r.render({ container: this.spriteWrap, target: this.rtSprites, clear: true, clearColor: [0, 0, 0, 0] });
    if (this.look.post.bloom1 > 0 || this.look.post.bloom2 > 0) {
      for (const step of this.chain) r.render({ container: step.root, target: step.rt, clear: true, clearColor: [0, 0, 0, 0] });
    }
    r.render({ container: this.final.root, clear: true, clearColor: [0, 0, 0, 1] });
    const gl = (r as unknown as { gl?: WebGL2RenderingContext }).gl;
    gl?.finish();
  }

  get glInfo() {
    const gl = (this.renderer as unknown as { gl?: WebGL2RenderingContext }).gl;
    if (!gl) return "no-gl";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return `${gl.getParameter(gl.VERSION)} | ${ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "?"}`;
  }

  destroy() {
    this.renderer?.destroy();
  }
}
