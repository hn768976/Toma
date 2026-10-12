import * as THREE from "three";

// A Canvas 2D surface used as a screen texture. Drawing happens in design
// units (`designW` wide); the backing store is `designW * scale` pixels,
// where scale follows the render size (1.0 at 4K), so the texture is about
// 4096 px wide at 4K and shrinks with previews. Redrawn from scratch every
// frame; mipmaps + anisotropic filtering keep fine lines from crawling.
export class ScreenCanvas {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly texture: THREE.CanvasTexture;
  readonly scale: number;

  constructor(
    readonly designW: number,
    readonly designH: number,
    scale: number,
    maxAniso: number,
    maxTex = 8192,
  ) {
    this.scale = Math.min(scale, maxTex / designW, maxTex / designH);
    this.canvas = document.createElement("canvas");
    this.canvas.width = Math.max(2, Math.round(designW * this.scale));
    this.canvas.height = Math.max(2, Math.round(designH * this.scale));
    const ctx = this.canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D context unavailable");
    this.ctx = ctx;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.anisotropy = maxAniso;
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
  }

  begin(bg: string): CanvasRenderingContext2D {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
  }

  commit() {
    this.texture.needsUpdate = true;
  }
}
