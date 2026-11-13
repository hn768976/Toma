/**
 * Pre-rendered sprites (glows, bokeh discs, UI icons). Everything is drawn once
 * into small offscreen canvases and then stamped many times per frame with
 * additive blending, which keeps a 4K Canvas 2D frame affordable.
 */

export const PALETTE = {
  cyan: "#5fd8ff",
  ice: "#c9f3ff",
  white: "#ffffff",
  blue: "#3b8cff",
  teal: "#3fe0c8",
  pink: "#ff7f9a",
  salmon: "#ff9a6b",
  yellow: "#ffd76a",
  green: "#8cff9a",
  gold: "#ffb52e",
  amber: "#ff8a2a",
  navy: "#2457b8",
} as const;
export type ColorName = keyof typeof PALETTE;
export const COLOR_NAMES = Object.keys(PALETTE) as ColorName[];

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const glowCache = new Map<string, HTMLCanvasElement>();
/** Soft radial glow (bright core, long falloff). */
export const glowSprite = (color: ColorName): HTMLCanvasElement => {
  const key = `g-${color}`;
  const hit = glowCache.get(key);
  if (hit) return hit;
  const S = 128;
  const c = makeCanvas(S, S);
  const g = c.getContext("2d")!;
  const [r, gg, b] = hexToRgb(PALETTE[color]);
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, `rgba(255,255,255,1)`);
  grad.addColorStop(0.08, `rgba(${r},${gg},${b},0.9)`);
  grad.addColorStop(0.25, `rgba(${r},${gg},${b},0.35)`);
  grad.addColorStop(0.55, `rgba(${r},${gg},${b},0.08)`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  glowCache.set(key, c);
  return c;
};

/** Out-of-focus bokeh disc: flat interior with a soft, slightly brighter rim. */
export const bokehSprite = (color: ColorName): HTMLCanvasElement => {
  const key = `b-${color}`;
  const hit = glowCache.get(key);
  if (hit) return hit;
  const S = 128;
  const c = makeCanvas(S, S);
  const g = c.getContext("2d")!;
  const [r, gg, b] = hexToRgb(PALETTE[color]);
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, `rgba(${r},${gg},${b},0.55)`);
  grad.addColorStop(0.72, `rgba(${r},${gg},${b},0.6)`);
  grad.addColorStop(0.86, `rgba(${r},${gg},${b},0.7)`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  glowCache.set(key, c);
  return c;
};

// ---------------------------------------------------------------- icons ----
type Glyph = (g: CanvasRenderingContext2D) => void; // draws in a 0..100 box

const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
};

const GLYPHS: Record<string, Glyph> = {
  heart: (g) => {
    g.beginPath();
    g.moveTo(50, 86);
    g.bezierCurveTo(10, 60, 6, 38, 14, 26);
    g.bezierCurveTo(24, 10, 44, 14, 50, 30);
    g.bezierCurveTo(56, 14, 76, 10, 86, 26);
    g.bezierCurveTo(94, 38, 90, 60, 50, 86);
    g.fill();
  },
  play: (g) => {
    rr(g, 8, 18, 84, 64, 12);
    g.fill();
    g.globalCompositeOperation = "destination-out";
    g.beginPath();
    g.moveTo(40, 34);
    g.lineTo(66, 50);
    g.lineTo(40, 66);
    g.closePath();
    g.fill();
    g.globalCompositeOperation = "source-over";
  },
  mail: (g) => {
    rr(g, 8, 22, 84, 58, 6);
    g.fill();
    g.globalCompositeOperation = "destination-out";
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(12, 28);
    g.lineTo(50, 56);
    g.lineTo(88, 28);
    g.stroke();
    g.globalCompositeOperation = "source-over";
  },
  thumb: (g) => {
    rr(g, 10, 44, 16, 44, 3);
    g.fill();
    g.beginPath();
    g.moveTo(32, 44);
    g.lineTo(48, 16);
    g.quadraticCurveTo(58, 10, 60, 24);
    g.lineTo(56, 40);
    g.lineTo(84, 40);
    g.quadraticCurveTo(94, 42, 90, 54);
    g.lineTo(82, 82);
    g.quadraticCurveTo(80, 88, 72, 88);
    g.lineTo(32, 88);
    g.closePath();
    g.fill();
  },
  person: (g) => {
    g.beginPath();
    g.arc(50, 32, 18, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(16, 90);
    g.quadraticCurveTo(18, 56, 50, 56);
    g.quadraticCurveTo(82, 56, 84, 90);
    g.closePath();
    g.fill();
  },
  people: (g) => {
    for (const [cx, s] of [[28, 0.75], [72, 0.75], [50, 1]] as const) {
      g.beginPath();
      g.arc(cx, 38 - (s - 0.75) * 30, 12 * s, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(cx - 22 * s, 86);
      g.quadraticCurveTo(cx - 20 * s, 60 - (s - 0.75) * 24, cx, 60 - (s - 0.75) * 24);
      g.quadraticCurveTo(cx + 20 * s, 60 - (s - 0.75) * 24, cx + 22 * s, 86);
      g.closePath();
      g.fill();
    }
  },
  chat: (g) => {
    rr(g, 8, 14, 84, 56, 14);
    g.fill();
    g.beginPath();
    g.moveTo(24, 66);
    g.lineTo(20, 90);
    g.lineTo(46, 68);
    g.fill();
    g.globalCompositeOperation = "destination-out";
    for (const x of [32, 50, 68]) {
      g.beginPath();
      g.arc(x, 42, 6, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = "source-over";
  },
  phone: (g) => {
    rr(g, 26, 6, 48, 88, 10);
    g.fill();
    g.globalCompositeOperation = "destination-out";
    rr(g, 32, 16, 36, 62, 3);
    g.fill();
    g.globalCompositeOperation = "source-over";
  },
  laptop: (g) => {
    rr(g, 18, 16, 64, 46, 5);
    g.fill();
    g.globalCompositeOperation = "destination-out";
    rr(g, 24, 22, 52, 34, 2);
    g.fill();
    g.globalCompositeOperation = "source-over";
    rr(g, 6, 66, 88, 12, 4);
    g.fill();
  },
  image: (g) => {
    rr(g, 8, 14, 84, 72, 8);
    g.fill();
    g.globalCompositeOperation = "destination-out";
    g.beginPath();
    g.moveTo(16, 76);
    g.lineTo(40, 44);
    g.lineTo(58, 66);
    g.lineTo(68, 54);
    g.lineTo(84, 76);
    g.closePath();
    g.fill();
    g.beginPath();
    g.arc(68, 32, 8, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "source-over";
  },
  grid: (g) => {
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        rr(g, 12 + i * 27, 12 + j * 27, 22, 22, 3);
        g.fill();
      }
  },
  bell: (g) => {
    g.beginPath();
    g.moveTo(20, 74);
    g.quadraticCurveTo(26, 64, 26, 46);
    g.quadraticCurveTo(28, 16, 50, 14);
    g.quadraticCurveTo(72, 16, 74, 46);
    g.quadraticCurveTo(74, 64, 80, 74);
    g.closePath();
    g.fill();
    g.beginPath();
    g.arc(50, 82, 9, 0, Math.PI * 2);
    g.fill();
  },
  doc: (g) => {
    rr(g, 18, 8, 64, 84, 6);
    g.fill();
    g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 4; i++) g.fillRect(28, 24 + i * 15, i === 3 ? 26 : 44, 6);
    g.globalCompositeOperation = "source-over";
  },
  cart: (g) => {
    g.lineWidth = 9;
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(6, 18);
    g.lineTo(22, 18);
    g.lineTo(32, 64);
    g.lineTo(80, 64);
    g.lineTo(90, 32);
    g.lineTo(26, 32);
    g.stroke();
    for (const x of [36, 74]) {
      g.beginPath();
      g.arc(x, 80, 8, 0, Math.PI * 2);
      g.fill();
    }
  },
};
export const ICON_NAMES = Object.keys(GLYPHS);

const iconCache = new Map<string, HTMLCanvasElement>();
/**
 * Icon sprite. `tile` puts the glyph knocked-out of a rounded tile (like the
 * white "play" cards in the reference); `blur` is an out-of-focus level 0..2.
 */
export const iconSprite = (name: string, color: ColorName, tile: boolean, blur: number): HTMLCanvasElement => {
  const key = `${name}-${color}-${tile ? 1 : 0}-${blur}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const S = 128;
  const pad = 14;
  const scaleTo = (g: CanvasRenderingContext2D) => {
    g.translate(pad, pad);
    g.scale((S - pad * 2) / 100, (S - pad * 2) / 100);
  };
  // 1) the bare glyph
  const bare = makeCanvas(S, S);
  const bg = bare.getContext("2d")!;
  bg.fillStyle = PALETTE[color];
  bg.strokeStyle = PALETTE[color];
  scaleTo(bg);
  GLYPHS[name](bg);
  let glyph = bare;
  if (tile) {
    // 2) optional: glyph knocked out of a rounded tile
    glyph = makeCanvas(S, S);
    const tg = glyph.getContext("2d")!;
    tg.fillStyle = PALETTE[color];
    tg.save();
    scaleTo(tg);
    rr(tg, 0, 0, 100, 100, 18);
    tg.fill();
    tg.restore();
    tg.globalCompositeOperation = "destination-out";
    const inner = S * 0.62;
    tg.drawImage(bare, (S - inner) / 2, (S - inner) / 2, inner, inner);
    tg.globalCompositeOperation = "source-over";
  }
  const out = makeCanvas(S, S);
  const og = out.getContext("2d")!;
  // soft glow underneath + crisp (or defocused) glyph on top
  og.filter = `blur(${6 + blur * 6}px)`;
  og.globalAlpha = 0.55;
  og.drawImage(glyph, 0, 0);
  og.filter = blur > 0 ? `blur(${blur * 4}px)` : "none";
  og.globalAlpha = blur > 0 ? 0.85 : 1;
  og.drawImage(glyph, 0, 0);
  iconCache.set(key, out);
  return out;
};
