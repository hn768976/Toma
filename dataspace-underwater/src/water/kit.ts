// Shared PixiJS water kit: background, god rays, Snell's window, half-float
// scene target and the final dither/grain pass. Used by Looks 2 and 3.

import {
  Application,
  BufferImageSource,
  Container,
  Geometry,
  GlProgram,
  Mesh,
  Rectangle,
  RenderTexture,
  Shader,
  Texture,
  UniformGroup,
} from "pixi.js";
import { BLUE_NOISE_SIZE, blueNoiseOffset, getBlueNoiseRGBA } from "../lib/blueNoise";
import { loopFrame, loopTheta } from "../lib/loop";
import { hexToRgb, WaterPalette } from "./palettes";
import { FINAL_FRAG, FULLSCREEN_VERT, RAYS_FRAG, SNELL_FRAG, WATER_BG_FRAG } from "./shaders";
import { ATLAS_H, ATLAS_W, getSpriteAtlas, Sprite, spriteFrame } from "./sprites";

export type WaterLook = {
  /** Sun patch centre in uv (y down). */
  sun: [number, number];
  sunR: number;
  rayDensity: number;
  rayReach: number;
  rayGain: number;
  surface: number;
  lift: number;
  /** Flare amount 0..1 as a function of θ (must be whole-cycle periodic). */
  flare: (theta: number) => number;
  grain: number;
};

const quad = () =>
  new Geometry({
    attributes: { aPosition: [-1, -1, 1, -1, 1, 1, -1, 1] },
    indexBuffer: [0, 1, 2, 0, 2, 3],
  });

export class WaterKit {
  readonly sceneRT: RenderTexture;
  readonly bg: Mesh<Geometry, Shader>;
  readonly rays: Mesh<Geometry, Shader>;
  readonly snell: Mesh<Geometry, Shader>;
  readonly final: Mesh<Geometry, Shader>;
  readonly finalRoot = new Container();
  readonly atlas: Texture;
  private readonly waterU: UniformGroup;
  private readonly bgU: UniformGroup;
  private readonly finalU: UniformGroup;
  private readonly textures = new Map<number, Texture>();
  /** Current camera drift (uv units), set by setFrame. */
  drift: [number, number] = [0, 0];

  constructor(
    private app: Application,
    readonly pw: number,
    readonly ph: number,
    palette: WaterPalette,
    readonly look: WaterLook,
  ) {
    this.sceneRT = RenderTexture.create({
      width: pw,
      height: ph,
      format: "rgba16float",
      antialias: false,
      resolution: 1,
    });

    this.waterU = new UniformGroup({
      uTheta: { value: 0, type: "f32" },
      uRes: { value: new Float32Array([pw, ph]), type: "vec2<f32>" },
      uDeep: { value: new Float32Array(hexToRgb(palette.deep)), type: "vec3<f32>" },
      uMid: { value: new Float32Array(hexToRgb(palette.mid)), type: "vec3<f32>" },
      uTop: { value: new Float32Array(hexToRgb(palette.top)), type: "vec3<f32>" },
      uRayCol: { value: new Float32Array(hexToRgb(palette.rays)), type: "vec3<f32>" },
      uSunCol: { value: new Float32Array(hexToRgb(palette.sun)), type: "vec3<f32>" },
      uSun: { value: new Float32Array(look.sun), type: "vec2<f32>" },
      uSunR: { value: look.sunR, type: "f32" },
      uFlare: { value: 0, type: "f32" },
      uRayGain: { value: look.rayGain * palette.rayGain, type: "f32" },
      uRayDensity: { value: look.rayDensity, type: "f32" },
      uRayReach: { value: look.rayReach, type: "f32" },
      uSurface: { value: look.surface, type: "f32" },
      uLift: { value: look.lift, type: "f32" },
    });

    const bnSource = new BufferImageSource({
      resource: getBlueNoiseRGBA(),
      width: BLUE_NOISE_SIZE,
      height: BLUE_NOISE_SIZE,
      format: "rgba8unorm",
      alphaMode: "no-premultiply-alpha",
      addressMode: "repeat",
      scaleMode: "nearest",
    });
    this.bgU = new UniformGroup({
      uBNOffset: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
    });

    const mk = (frag: string, name: string, extra: Record<string, unknown> = {}) =>
      new Mesh({
        geometry: quad(),
        shader: new Shader({
          glProgram: GlProgram.from({ vertex: FULLSCREEN_VERT, fragment: frag, name }),
          resources: { waterUniforms: this.waterU, ...extra },
        }),
      });

    this.bg = mk(WATER_BG_FRAG, "water-bg", { bgUniforms: this.bgU, uBN: bnSource });
    this.rays = mk(RAYS_FRAG, "water-rays");
    this.rays.blendMode = "add";
    this.snell = mk(SNELL_FRAG, "water-snell");
    this.snell.blendMode = "add";

    this.finalU = new UniformGroup({
      uLoopFrame: { value: 0, type: "f32" },
      uGrain: { value: look.grain, type: "f32" },
      uFlipY: { value: 1, type: "f32" },
      uCA: { value: 1.6, type: "f32" },
    });
    this.final = new Mesh({
      geometry: quad(),
      shader: new Shader({
        glProgram: GlProgram.from({ vertex: FULLSCREEN_VERT, fragment: FINAL_FRAG, name: "water-final" }),
        resources: { finalUniforms: this.finalU, uScene: this.sceneRT.source },
      }),
    });
    this.final.blendMode = "none";
    this.finalRoot.addChild(this.final);

    const atlasSource = new BufferImageSource({
      resource: getSpriteAtlas(),
      width: ATLAS_W,
      height: ATLAS_H,
      format: "rgba8unorm",
      alphaMode: "premultiplied-alpha",
      autoGenerateMipmaps: true,
      scaleMode: "linear",
      mipmapFilter: "linear",
      addressMode: "clamp-to-edge",
    });
    this.atlas = new Texture({ source: atlasSource });
  }

  /** Sub-texture of the sprite atlas (all share one source → one ParticleContainer each). */
  sprite(s: Sprite): Texture {
    let t = this.textures.get(s);
    if (!t) {
      const f = spriteFrame(s);
      t = new Texture({ source: this.atlas.source, frame: new Rectangle(f.x, f.y, f.w, f.h) });
      this.textures.set(s, t);
    }
    return t;
  }

  setFrame(frame: number) {
    const f = loopFrame(frame);
    const th = loopTheta(frame);
    const u = this.waterU.uniforms as Record<string, unknown>;
    u.uTheta = th;
    u.uFlare = this.look.flare(th);
    // Slow, closed camera drift (whole cycles): everything shifts together.
    this.drift = [0.007 * Math.sin(th + 0.6), 0.004 * Math.sin(2 * th + 1.9)];
    (u.uSun as Float32Array).set([this.look.sun[0] + this.drift[0], this.look.sun[1] + this.drift[1]]);
    const [ox, oy] = blueNoiseOffset(f);
    (this.bgU.uniforms.uBNOffset as Float32Array).set([ox, oy]);
    (this.finalU.uniforms as Record<string, unknown>).uLoopFrame = f;
    this.waterU.update();
    this.bgU.update();
    this.finalU.update();
  }

  /** Render `scene` into the half-float target, then the final pass to the canvas. */
  draw(scene: Container) {
    const r = this.app.renderer;
    r.render({ container: scene, target: this.sceneRT, clear: true, clearColor: [0, 0, 0, 1] });
    r.render({ container: this.finalRoot, clear: true });
  }

  destroy() {
    this.sceneRT.destroy(true);
    this.atlas.destroy(true);
  }
}
