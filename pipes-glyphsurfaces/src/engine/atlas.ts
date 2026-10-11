import * as THREE from "three";
import { staticFile } from "remotion";

/**
 * Glyph atlas, drawn once in Canvas 2D from JetBrains Mono (OFL).
 * Slots: A-Z (0-25), a-z (26-51), 0-9 (52-61), & @ ? % (62-65),
 *        padlock closed (66), padlock open (67).
 */
export const GLYPHS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&@?%".split("");
export const LOCK_CLOSED = 66;
export const LOCK_OPEN = 67;
export const SLOT_COUNT = 68;
export const ATLAS_COLS = 16;
export const ATLAS_ROWS = 5;
export const SLOT = 192; // px per slot; nearest sharp glyphs stay >= 1:1 at 4K

const idx = (ch: string) => GLYPHS.indexOf(ch);
export const SET_ALL = Array.from({ length: 66 }, (_, i) => i);
export const SET_HEX = "0123456789ABCDEF".split("").map(idx);
export const SET_BINARY = ["0", "1"].map(idx);

let fontPromise: Promise<void> | null = null;
export const loadFont = () => {
  if (!fontPromise) {
    const face = new FontFace("JetBrains Mono Atlas", `url(${staticFile("fonts/JetBrainsMono-Bold.ttf")})`, {
      weight: "700",
    });
    fontPromise = face.load().then((f) => {
      (document.fonts as unknown as { add: (f: FontFace) => void }).add(f);
    });
  }
  return fontPromise;
};

const drawLock = (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, open: boolean) => {
  const bw = s * 0.62, bh = s * 0.46, by = cy - s * 0.02;
  const r = s * 0.07;
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2 + r, by);
  ctx.arcTo(cx + bw / 2, by, cx + bw / 2, by + bh, r);
  ctx.arcTo(cx + bw / 2, by + bh, cx - bw / 2, by + bh, r);
  ctx.arcTo(cx - bw / 2, by + bh, cx - bw / 2, by, r);
  ctx.arcTo(cx - bw / 2, by, cx + bw / 2, by, r);
  ctx.closePath();
  ctx.fill();
  // keyhole
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, by + bh * 0.42, s * 0.065, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - s * 0.028, by + bh * 0.42, s * 0.056, bh * 0.32);
  ctx.restore();
  // shackle
  const sr = bw * 0.32;
  const lw = s * 0.085;
  ctx.lineWidth = lw;
  ctx.lineCap = "butt";
  const lift = open ? s * 0.13 : 0;
  const top = by - s * 0.2 - lift;
  ctx.beginPath();
  ctx.moveTo(cx - sr, open ? by - lift - s * 0.02 : by + 1);
  ctx.lineTo(cx - sr, top);
  ctx.arc(cx, top, sr, Math.PI, 0);
  ctx.lineTo(cx + sr, open ? top + s * 0.06 : by + 1);
  ctx.stroke();
};

let atlasTex: THREE.CanvasTexture | null = null;
export const getAtlas = () => {
  if (atlasTex) return atlasTex;
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_COLS * SLOT;
  canvas.height = ATLAS_ROWS * SLOT;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 ${Math.round(SLOT * 0.78)}px "JetBrains Mono Atlas"`;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const cx = (i % ATLAS_COLS) * SLOT + SLOT / 2;
    const cy = Math.floor(i / ATLAS_COLS) * SLOT + SLOT / 2;
    if (i < GLYPHS.length) ctx.fillText(GLYPHS[i], cx, cy + SLOT * 0.28);
    else drawLock(ctx, cx, cy + SLOT * 0.06, SLOT * 0.86, i === LOCK_OPEN);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.flipY = false;
  tex.needsUpdate = true;
  atlasTex = tex;
  return tex;
};

export const ATLAS_GLSL = /* glsl */ `
uniform sampler2D uAtlas;
// local in [0,1]^2 (y down), returns coverage
float glyphMask(float slot, vec2 local) {
  vec2 cell = vec2(mod(slot, ${ATLAS_COLS}.0), floor(slot / ${ATLAS_COLS}.0));
  vec2 uv = (cell + clamp(local, 0.0, 1.0)) / vec2(${ATLAS_COLS}.0, ${ATLAS_ROWS}.0);
  return texture(uAtlas, uv).r;
}
`;
