import * as THREE from "three";
import { mulberry32 } from "../lib/random";

// Paints a faceplate into three canvases at once: colour, roughness and
// height. The height canvas becomes a normal map (Sobel), so perforations,
// vents, grilles and screw heads catch the moving highlight. Coordinates
// are in panel units (1 U = 100, a 19" panel = 1080 wide).

export type Paint = {
  color?: string; // sRGB hex
  rough?: number; // 0..1
  height?: number; // 0 = deep hole, 0.5 = face, 1 = raised
};

export class Painter {
  readonly w: number;
  readonly h: number;
  readonly s: number; // texture px per panel unit
  col: CanvasRenderingContext2D;
  rough: CanvasRenderingContext2D;
  height: CanvasRenderingContext2D;
  private canvases: HTMLCanvasElement[];

  constructor(wUnits: number, hUnits: number, pxPerUnit: number) {
    this.s = pxPerUnit;
    this.w = Math.round(wUnits * pxPerUnit);
    this.h = Math.round(hUnits * pxPerUnit);
    this.canvases = [0, 1, 2].map(() => {
      const c = document.createElement("canvas");
      c.width = this.w;
      c.height = this.h;
      return c;
    });
    [this.col, this.rough, this.height] = this.canvases.map((c) => {
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.scale(pxPerUnit, pxPerUnit);
      return ctx;
    });
  }

  private apply(p: Paint, fn: (ctx: CanvasRenderingContext2D) => void) {
    if (p.color) {
      this.col.fillStyle = p.color;
      fn(this.col);
    }
    if (p.rough !== undefined) {
      const v = Math.round(p.rough * 255);
      this.rough.fillStyle = `rgb(${v},${v},${v})`;
      fn(this.rough);
    }
    if (p.height !== undefined) {
      const v = Math.round(p.height * 255);
      this.height.fillStyle = `rgb(${v},${v},${v})`;
      fn(this.height);
    }
  }

  rect(x: number, y: number, w: number, h: number, p: Paint) {
    this.apply(p, (c) => c.fillRect(x, y, w, h));
  }

  rrect(x: number, y: number, w: number, h: number, r: number, p: Paint) {
    this.apply(p, (c) => {
      c.beginPath();
      const rr = Math.min(r, w / 2, h / 2);
      c.moveTo(x + rr, y);
      c.arcTo(x + w, y, x + w, y + h, rr);
      c.arcTo(x + w, y + h, x, y + h, rr);
      c.arcTo(x, y + h, x, y, rr);
      c.arcTo(x, y, x + w, y, rr);
      c.closePath();
      c.fill();
    });
  }

  circle(x: number, y: number, r: number, p: Paint) {
    this.apply(p, (c) => {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    });
  }

  // A raised or recessed plate with a bevelled rim.
  plate(x: number, y: number, w: number, h: number, base: Paint, rim = 1.2) {
    this.rrect(x, y, w, h, rim * 1.5, { ...base, height: (base.height ?? 0.5) + 0.12 });
    this.rrect(x + rim, y + rim, w - 2 * rim, h - 2 * rim, rim, base);
  }

  // Grid of rounded slots (perforated vent).
  slotGrid(
    x: number,
    y: number,
    w: number,
    h: number,
    cols: number,
    rows: number,
    fill = 0.62,
    stagger = false,
    holeColor = "#040405",
  ) {
    const cw = w / cols;
    const rh = h / rows;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const off = stagger && r % 2 ? cw / 2 : 0;
        const cx = x + c * cw + off;
        if (cx + cw * fill > x + w + 0.01) continue;
        const sw = cw * fill;
        const sh = rh * fill;
        this.rrect(cx + (cw - sw) / 2, y + r * rh + (rh - sh) / 2, sw, sh, Math.min(sw, sh) / 2, {
          color: holeColor,
          rough: 0.9,
          height: 0.05,
        });
      }
  }

  // Round-hole perforation.
  holes(x: number, y: number, w: number, h: number, pitch: number, r: number) {
    for (let yy = y + pitch / 2, row = 0; yy < y + h; yy += pitch * 0.866, row++)
      for (let xx = x + pitch / 2 + (row % 2 ? pitch / 2 : 0); xx < x + w - r; xx += pitch)
        this.circle(xx, yy, r, { color: "#040405", rough: 0.9, height: 0.05 });
  }

  // Horizontal slats (a grille).
  slats(x: number, y: number, w: number, h: number, n: number, p: Paint) {
    const gap = h / n;
    for (let i = 0; i < n; i++) {
      this.rect(x, y + i * gap, w, gap * 0.55, p);
      this.rect(x, y + i * gap + gap * 0.55, w, gap * 0.45, { color: "#050506", rough: 0.9, height: 0.15 });
    }
  }

  screw(x: number, y: number, r: number) {
    this.circle(x, y, r, { color: "#6A6E76", rough: 0.35, height: 0.85 });
    this.rect(x - r * 0.7, y - r * 0.15, r * 1.4, r * 0.3, { color: "#202226", height: 0.55 });
    this.rect(x - r * 0.15, y - r * 0.7, r * 0.3, r * 1.4, { color: "#202226", height: 0.55 });
  }

  // Subtle brushed streaks and grime in the colour and roughness.
  brushed(seed: number, amount = 0.06) {
    const rnd = mulberry32(seed);
    const wU = this.w / this.s;
    const hU = this.h / this.s;
    for (let i = 0; i < 260; i++) {
      const y = rnd() * hU;
      const x = rnd() * wU;
      const len = 20 + rnd() * 200;
      const a = amount * (0.3 + rnd());
      this.col.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${a * 0.18})` : `rgba(0,0,0,${a * 0.5})`;
      this.col.fillRect(x, y, len, 0.25 + rnd() * 0.4);
      this.rough.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
      this.rough.fillRect(x, y, len, 0.4 + rnd() * 0.8);
    }
  }

  // Builds the three textures. Roughness goes in the green channel (three's
  // convention for roughnessMap).
  textures(anisotropy: number, normalStrength = 2.5) {
    const { w, h } = this;
    const hd = this.height.getImageData(0, 0, w, h).data;
    const rd = this.rough.getImageData(0, 0, w, h).data;
    const nc = document.createElement("canvas");
    nc.width = w;
    nc.height = h;
    const nctx = nc.getContext("2d")!;
    const nimg = nctx.createImageData(w, h);
    const H = (x: number, y: number) => {
      const xx = Math.min(w - 1, Math.max(0, x));
      const yy = Math.min(h - 1, Math.max(0, y));
      return hd[(yy * w + xx) * 4] / 255;
    };
    const k = normalStrength;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx =
          H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x - 1, y) - H(x - 1, y + 1);
        const dy =
          H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x, y - 1) - H(x + 1, y - 1);
        let nx = -dx * k;
        let ny = dy * k; // canvas y points down, tangent space y points up
        let nz = 1;
        const l = Math.hypot(nx, ny, nz);
        nx /= l;
        ny /= l;
        nz /= l;
        const i = (y * w + x) * 4;
        nimg.data[i] = Math.round((nx * 0.5 + 0.5) * 255);
        nimg.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        nimg.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        nimg.data[i + 3] = 255;
      }
    nctx.putImageData(nimg, 0, 0);
    // Roughness into G, height-derived cavity darkening into R (unused).
    const rc = document.createElement("canvas");
    rc.width = w;
    rc.height = h;
    const rctx = rc.getContext("2d")!;
    const rimg = rctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      rimg.data[i * 4] = 255;
      rimg.data[i * 4 + 1] = rd[i * 4];
      rimg.data[i * 4 + 2] = 0;
      rimg.data[i * 4 + 3] = 255;
    }
    rctx.putImageData(rimg, 0, 0);
    const mk = (c: HTMLCanvasElement, srgb: boolean) => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = anisotropy;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      return t;
    };
    return {
      map: mk(this.canvases[0], true),
      roughnessMap: mk(rc, false),
      normalMap: mk(nc, false),
    };
  }
}
