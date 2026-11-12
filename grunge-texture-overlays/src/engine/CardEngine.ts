import * as THREE from "three";
import * as brush from "p5.brush/standalone";
import { BLEED, CARD_CACHE_SIZE } from "../settings";
import { rngFor, seedFor } from "../lib/rng";
import { activePersist, type Schedule } from "../lib/schedule";
import { cardFrag, FULLSCREEN_VERT } from "../gl/shaders";
import type { CardUniforms, Frame, LookDef } from "../looks/types";

// p5.brush scales its built-in brushes cumulatively; remember what is applied so far (one page = one module).
let appliedBrushScale = 1;
const setBrushScale = (s: number) => {
  brush.scaleBrushes(s / appliedBrushScale);
  appliedBrushScale = s;
};

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/**
 * Renders texture cards on demand (Canvas 2D line work + p5.brush strokes + a WebGL2 fragment
 * shader, merged into one render target) and keeps the last CARD_CACHE_SIZE of them.
 */
export class CardEngine {
  readonly F: Frame;
  private readonly look: LookDef;
  private readonly lookSeed: string;
  private readonly density: number;
  private readonly gl: THREE.WebGLRenderer;

  private readonly linesCanvas: HTMLCanvasElement;
  private readonly linesCtx: CanvasRenderingContext2D;
  private readonly linesTex: THREE.CanvasTexture;
  private readonly brushCanvases: HTMLCanvasElement[] = [];
  private readonly brushTex: THREE.Texture[] = [];
  private readonly persistCanvas: HTMLCanvasElement;
  private readonly persistCtx: CanvasRenderingContext2D;
  readonly persistTex: THREE.CanvasTexture;
  private persistSlot = -1;

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: THREE.RawShaderMaterial;
  private readonly cache: { card: number; rt: THREE.WebGLRenderTarget }[] = [];

  constructor(gl: THREE.WebGLRenderer, look: LookDef, lookSeed: string, frameW: number, frameH: number, density: number) {
    this.gl = gl;
    this.look = look;
    this.lookSeed = lookSeed;
    this.density = density;
    const cw = Math.round(frameW * (1 + 2 * BLEED));
    const ch = Math.round(frameH * (1 + 2 * BLEED));
    this.F = { W: frameW, H: frameH, cw, ch, ox: (cw - frameW) / 2, oy: (ch - frameH) / 2, u: frameH / 1000 };

    this.linesCanvas = makeCanvas(cw, ch);
    this.linesCtx = this.linesCanvas.getContext("2d", { alpha: false })!;
    this.linesTex = this.canvasTexture(this.linesCanvas);

    this.persistCanvas = makeCanvas(cw, ch);
    this.persistCtx = this.persistCanvas.getContext("2d", { alpha: false })!;
    this.persistCtx.fillStyle = "#000";
    this.persistCtx.fillRect(0, 0, cw, ch);
    this.persistTex = this.canvasTexture(this.persistCanvas);

    for (let i = 0; i < 4; i++) {
      if (i < look.brushLayers) {
        const c = makeCanvas(cw, ch);
        this.brushCanvases.push(c);
        this.brushTex.push(this.canvasTexture(c));
      } else {
        const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
        t.needsUpdate = true;
        this.brushTex.push(t);
      }
    }

    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: cardFrag(look.shader, look.clearCentre, look.brushLayers),
      uniforms: {
        uLines: { value: this.linesTex },
        uBrush0: { value: this.brushTex[0] },
        uBrush1: { value: this.brushTex[1] },
        uBrush2: { value: this.brushTex[2] },
        uBrush3: { value: this.brushTex[3] },
        uAspect: { value: frameW / frameH },
        uBleed: { value: BLEED },
        uPx: { value: 1 / frameH },
        uSeed: { value: 0 },
        uP: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  private canvasTexture(c: HTMLCanvasElement) {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }

  /** The render target holding card `card`, rendering it if it is not cached. */
  getCard(card: number): THREE.Texture {
    const idx = this.cache.findIndex((c) => c.card === card);
    if (idx >= 0) {
      const [hit] = this.cache.splice(idx, 1);
      this.cache.push(hit); // most recently used last
      return hit.rt.texture;
    }
    let rt: THREE.WebGLRenderTarget;
    if (this.cache.length >= CARD_CACHE_SIZE) {
      rt = this.cache.shift()!.rt;
    } else {
      rt = new THREE.WebGLRenderTarget(this.F.cw, this.F.ch, {
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        type: THREE.UnsignedByteType,
        format: THREE.RGBAFormat,
        colorSpace: THREE.NoColorSpace,
      });
    }
    this.renderCard(card, rt);
    this.cache.push({ card, rt });
    return rt.texture;
  }

  private renderCard(card: number, rt: THREE.WebGLRenderTarget) {
    const { look, F } = this;
    const id = this.lookSeed;
    const cu: CardUniforms = look.cardUniforms(rngFor(id, "uniforms", card), this.density, card);

    // 1. Canvas 2D line work
    const ctx = this.linesCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, F.cw, F.ch);
    look.drawLines(ctx, F, rngFor(id, "lines", card), cu, this.density);
    this.linesTex.needsUpdate = true;

    // 2. p5.brush strokes, painted once per card (one canvas per layer)
    if (look.paintBrush) {
      const rb = rngFor(id, "brush", card);
      this.brushCanvases.forEach((canvas, layer) => {
        brush.load(canvas);
        setBrushScale(F.H / 360);
        brush.seed(`${id}:${card}:${layer}`);
        brush.noiseSeed(`${id}:${card}:${layer}:noise`);
        brush.clear("#ffffff");
        brush.push();
        brush.translate(-F.cw / 2, -F.ch / 2); // standalone origin is the canvas centre; use top-left
        look.paintBrush!(F, rb, cu, this.density, layer);
        brush.pop();
        brush.render();
        this.brushTex[layer].needsUpdate = true;
      });
    }

    // 3. shader pass merges everything into the card render target
    this.material.uniforms.uSeed.value = seedFor(id, "shader", card) % 100000;
    const uP = this.material.uniforms.uP.value as THREE.Vector4[];
    cu.p.forEach((v, i) => uP[i].set(v[0], v[1], v[2], v[3]));
    const prev = this.gl.getRenderTarget();
    this.gl.setRenderTarget(rt);
    this.gl.render(this.scene, this.camera);
    this.gl.setRenderTarget(prev);
  }

  /** Redraws the persistent line marks for a hold (only when the hold changes). */
  updatePersist(sched: Schedule, slotIndex: number) {
    if (slotIndex === this.persistSlot) return;
    this.persistSlot = slotIndex;
    const { F } = this;
    const ctx = this.persistCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, F.cw, F.ch);
    for (const { ev, age } of activePersist(sched, slotIndex)) {
      if (ev.kind !== 0) continue;
      ctx.setTransform(1, 0, 0, 1, ev.driftX * age * F.W, ev.driftY * age * F.H);
      this.look.drawPersist(ctx, F, ev, rngFor(this.lookSeed, "persist", ev.seed));
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.persistTex.needsUpdate = true;
  }

  dispose() {
    this.cache.forEach((c) => c.rt.dispose());
    this.cache.length = 0;
    this.linesTex.dispose();
    this.brushTex.forEach((t) => t.dispose());
    this.persistTex.dispose();
    this.material.dispose();
  }
}
