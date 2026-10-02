import { Rectangle, Texture } from "pixi.js";
import { drawIcon, NETWORK_ICONS } from "../../lib/icons";

// One canvas atlas (single TextureSource → usable by a ParticleContainer):
// 8 bokeh discs, 4 dashes, icons at 3 blur levels, squares, glow, chip.
export type BurstAtlas = {
  discs: Texture[]; // 0 = sharp point … 7 = widest, softest disc
  dashes: Texture[]; // blur 0..3
  icons: Texture[][]; // [blur][icon]
  tiles: Texture[][]; // [blur][icon] filled rounded tile with the glyph knocked out
  squares: Texture[]; // blur 0..2
  glow: Texture;
  chip: Texture;
};

const AW = 2048;
const AH = 1024;

export const buildBurstAtlas = (): BurstAtlas => {
  const cv = document.createElement("canvas");
  cv.width = AW;
  cv.height = AH;
  const c = cv.getContext("2d")!;
  c.clearRect(0, 0, AW, AH);
  const rects: Record<string, Rectangle> = {};

  // discs (row 0): white, premultiplied-friendly (drawn on transparent)
  for (let i = 0; i < 8; i++) {
    const x = i * 128 + 64,
      y = 64;
    if (i === 0) {
      const g = c.createRadialGradient(x, y, 0, x, y, 60);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.12, "rgba(255,255,255,0.9)");
      g.addColorStop(0.3, "rgba(255,255,255,0.25)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(x - 64, y - 64, 128, 128);
    } else {
      // bokeh disc: flat body, slightly brighter rim, softness growing with i
      const soft = 2 + i * 3;
      c.save();
      c.filter = `blur(${soft * 0.5}px)`;
      const rad = 54 - soft * 0.6;
      c.fillStyle = "rgba(255,255,255,0.78)";
      c.beginPath();
      c.arc(x, y, rad, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.35)";
      c.lineWidth = 4;
      c.beginPath();
      c.arc(x, y, rad - 2, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
    rects[`disc${i}`] = new Rectangle(i * 128, 0, 128, 128);
  }
  // dashes (row 1)
  for (let i = 0; i < 4; i++) {
    const x = i * 128,
      y = 128;
    c.save();
    c.filter = i ? `blur(${i * 2.5}px)` : "none";
    c.fillStyle = "white";
    const th = 10;
    c.beginPath();
    c.roundRect(x + 14, y + 16 - th / 2, 100, th, th / 2);
    c.fill();
    c.restore();
    rects[`dash${i}`] = new Rectangle(x, y, 128, 32);
  }
  // icons rows 2..4 (128 px cells)
  const blurs = [0, 4, 10];
  blurs.forEach((b, bi) => {
    NETWORK_ICONS.forEach((name, ii) => {
      const x = ii * 128,
        y = 256 + bi * 128;
      c.save();
      c.filter = b ? `blur(${b}px)` : "none";
      drawIcon(c, name, x + 64, y + 64, 84, "white", bi === 0 ? 3.0 : 2.4);
      c.restore();
      rects[`icon${bi}_${ii}`] = new Rectangle(x, y, 128, 128);
    });
  });
  // filled app tiles rows 5..6 (blur 0, 6)
  [0, 6].forEach((b, bi) => {
    NETWORK_ICONS.forEach((name, ii) => {
      const x = ii * 128,
        y = 896 - 128 * (1 - bi) - 0;
      const tile = document.createElement("canvas");
      tile.width = tile.height = 128;
      const tc = tile.getContext("2d")!;
      tc.fillStyle = "white";
      tc.beginPath();
      tc.roundRect(20, 20, 88, 88, 18);
      tc.fill();
      tc.globalCompositeOperation = "destination-out";
      drawIcon(tc, name, 64, 64, 62, "black", 2.6);
      c.save();
      c.filter = b ? `blur(${b}px)` : "none";
      c.drawImage(tile, x, y);
      c.restore();
      rects[`tile${bi}_${ii}`] = new Rectangle(x, y, 128, 128);
    });
  });
  // squares row 5
  for (let i = 0; i < 3; i++) {
    const x = 1536 + i * 64,
      y = 0;
    c.save();
    c.filter = i ? `blur(${i * 4}px)` : "none";
    c.fillStyle = "white";
    c.fillRect(x + 16, y + 16, 32, 32);
    c.restore();
    rects[`sq${i}`] = new Rectangle(x, y, 64, 64);
  }
  // glow
  {
    const x = 1152 + 128,
      y = 640 + 128;
    const g = c.createRadialGradient(x, y, 0, x, y, 128);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.08, "rgba(255,255,255,0.6)");
    g.addColorStop(0.3, "rgba(255,255,255,0.16)");
    g.addColorStop(0.6, "rgba(255,255,255,0.04)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(1152, 640, 256, 256);
    rects.glow = new Rectangle(1152, 640, 256, 256);
  }
  // chip: soft glowing square with a 3×3 grid of round cells and fine traces
  {
    const x = 1536,
      y = 640;
    c.save();
    c.filter = "blur(3px)";
    c.fillStyle = "rgba(255,255,255,0.28)";
    c.beginPath();
    c.roundRect(x + 36, y + 36, 184, 184, 16);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.9)";
    c.lineWidth = 6;
    c.stroke();
    c.restore();
    c.save();
    c.filter = "blur(1.5px)";
    for (let gx = 0; gx < 3; gx++)
      for (let gy = 0; gy < 3; gy++) {
        const cx = x + 80 + gx * 48,
          cy = y + 80 + gy * 48;
        const g = c.createRadialGradient(cx, cy, 0, cx, cy, 20);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.6, "rgba(255,255,255,0.85)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = g;
        c.fillRect(cx - 20, cy - 20, 40, 40);
      }
    c.strokeStyle = "rgba(0,0,0,0.6)";
    c.globalCompositeOperation = "destination-out";
    c.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      c.beginPath();
      c.moveTo(x + 56 + k * 48, y + 56);
      c.lineTo(x + 56 + k * 48, y + 200);
      c.moveTo(x + 56, y + 56 + k * 48);
      c.lineTo(x + 200, y + 56 + k * 48);
      c.stroke();
    }
    c.restore();
    rects.chip = new Rectangle(x, y, 256, 256);
  }

  const base = Texture.from(cv);
  base.source.scaleMode = "linear";
  const t = (k: string) => new Texture({ source: base.source, frame: rects[k] });
  return {
    discs: Array.from({ length: 8 }, (_, i) => t(`disc${i}`)),
    dashes: Array.from({ length: 4 }, (_, i) => t(`dash${i}`)),
    icons: blurs.map((_, bi) => NETWORK_ICONS.map((__, ii) => t(`icon${bi}_${ii}`))),
    tiles: [0, 1].map((bi) => NETWORK_ICONS.map((__, ii) => t(`tile${bi}_${ii}`))),
    squares: [0, 1, 2].map((i) => t(`sq${i}`)),
    glow: t("glow"),
    chip: t("chip"),
  };
};
