import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from "three";
import { Shape, SIZE } from "./graph";
import { IconKind, Theme } from "./theme";

export const FONT = "JBMono";
const PPU = 320; // texture pixels per world unit

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
};

const finish = (c: HTMLCanvasElement): Texture => {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
};

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const shapePath = (
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  W: number,
  H: number,
  inset: number,
) => {
  if (shape === "circle") {
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - inset, 0, Math.PI * 2);
    ctx.closePath();
  } else {
    const r = (shape === "small" ? 0.1 : 0.2) * PPU;
    roundRect(ctx, inset, inset, W - inset * 2, H - inset * 2, Math.max(2, r - inset * 0.5));
  }
};

// ---------- icons ----------

type Pen = {
  ctx: CanvasRenderingContext2D;
  cx: number;
  cy: number;
  s: number; // icon box size in px
  color: string;
  accent: string;
  theme: Theme;
};

const glow = (ctx: CanvasRenderingContext2D, color: string, blur: number) => {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
};

const drawGlobe = ({ ctx, cx, cy, s, color, accent }: Pen, dots: boolean) => {
  const r = s * 0.36;
  ctx.lineWidth = s * 0.045;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.45, r, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy + r);
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx - r * 0.86, cy - r * 0.5);
  ctx.lineTo(cx + r * 0.86, cy - r * 0.5);
  ctx.moveTo(cx - r * 0.86, cy + r * 0.5);
  ctx.lineTo(cx + r * 0.86, cy + r * 0.5);
  ctx.stroke();
  if (dots) {
    ctx.fillStyle = accent;
    glow(ctx, accent, s * 0.08);
    for (const [dx, dy] of [
      [-0.45, -0.2],
      [0.15, 0.05],
      [0.5, 0.42],
    ]) {
      ctx.beginPath();
      ctx.arc(cx + dx * r, cy + dy * r, s * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.strokeStyle = accent;
    glow(ctx, accent, s * 0.06);
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.62, Math.PI * 0.38, true);
    ctx.stroke();
  }
};

const drawCircleArrow = ({ ctx, cx, cy, s, color }: Pen) => {
  // "enter" glyph: ring open on the left with an arrow pointing into it
  const r = s * 0.3;
  ctx.lineWidth = s * 0.065;
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  glow(ctx, color, s * 0.08);
  ctx.beginPath();
  ctx.arc(cx + s * 0.04, cy, r, Math.PI * 1.22, Math.PI * 0.78);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - r * 1.15, cy);
  ctx.lineTo(cx + r * 0.05, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.42, cy);
  ctx.lineTo(cx - r * 0.02, cy - r * 0.36);
  ctx.lineTo(cx - r * 0.02, cy + r * 0.36);
  ctx.closePath();
  ctx.fill();
};

const drawRefresh = ({ ctx, cx, cy, s, color }: Pen) => {
  const r = s * 0.32;
  ctx.lineWidth = s * 0.06;
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI * 0.35, Math.PI * 1.35);
  ctx.stroke();
  // small arrow inside
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.35, cy);
  ctx.lineTo(cx + r * 0.45, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.75, cy);
  ctx.lineTo(cx + r * 0.3, cy - r * 0.3);
  ctx.lineTo(cx + r * 0.3, cy + r * 0.3);
  ctx.closePath();
  ctx.fill();
};

const drawRouter = ({ ctx, cx, cy, s, color, accent }: Pen) => {
  const b = s * 0.2;
  const boxes = [
    [cx - s * 0.22, cy - s * 0.22],
    [cx + s * 0.2, cy - s * 0.02],
    [cx - s * 0.22, cy + s * 0.22],
  ];
  ctx.strokeStyle = accent;
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.moveTo(boxes[0][0] + b / 2, boxes[0][1]);
  ctx.lineTo(boxes[1][0] - s * 0.04, boxes[0][1]);
  ctx.lineTo(boxes[1][0] - s * 0.04, boxes[2][1]);
  ctx.lineTo(boxes[2][0] + b / 2, boxes[2][1]);
  ctx.moveTo(boxes[1][0] - s * 0.04, boxes[1][1]);
  ctx.lineTo(boxes[1][0] - b / 2, boxes[1][1]);
  ctx.stroke();
  for (const [x, y] of boxes) {
    ctx.fillStyle = color;
    glow(ctx, color, s * 0.06);
    roundRect(ctx, x - b / 2, y - b / 2, b, b, b * 0.2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    roundRect(ctx, x - b * 0.25, y - b * 0.25, b * 0.5, b * 0.5, b * 0.1);
    ctx.fill();
  }
};

const cloudPath = (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) => {
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.34, cy + s * 0.18);
  ctx.arc(cx - s * 0.2, cy + s * 0.02, s * 0.16, Math.PI * 0.6, Math.PI * 1.45);
  ctx.arc(cx + s * 0.02, cy - s * 0.1, s * 0.22, Math.PI * 1.1, Math.PI * 1.95);
  ctx.arc(cx + s * 0.24, cy + s * 0.05, s * 0.14, Math.PI * 1.4, Math.PI * 0.45);
  ctx.closePath();
};

const drawCloud = ({ ctx, cx, cy, s, color, accent }: Pen) => {
  ctx.fillStyle = color;
  glow(ctx, color, s * 0.08);
  cloudPath(ctx, cx, cy - s * 0.05, s);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = accent;
  ctx.lineWidth = s * 0.03;
  ctx.stroke();
  // up / down arrows
  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;
  ctx.lineWidth = s * 0.045;
  for (const [dx, dir] of [
    [-0.06, -1],
    [0.08, 1],
  ] as const) {
    const x = cx + dx * s;
    ctx.beginPath();
    ctx.moveTo(x, cy + s * 0.02);
    ctx.lineTo(x, cy + s * 0.3);
    ctx.stroke();
    const ty = dir < 0 ? cy + s * 0.0 : cy + s * 0.34;
    ctx.beginPath();
    ctx.moveTo(x, ty + dir * s * 0.03);
    ctx.lineTo(x - s * 0.05, ty - dir * s * 0.05);
    ctx.lineTo(x + s * 0.05, ty - dir * s * 0.05);
    ctx.closePath();
    ctx.fill();
  }
};

const drawSign = ({ ctx, cx, cy, s, color, accent }: Pen) => {
  ctx.fillStyle = accent;
  ctx.fillRect(cx - s * 0.03, cy - s * 0.32, s * 0.06, s * 0.66);
  ctx.fillStyle = color;
  glow(ctx, color, s * 0.08);
  // right-pointing board
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.28, cy - s * 0.22);
  ctx.lineTo(cx + s * 0.22, cy - s * 0.22);
  ctx.lineTo(cx + s * 0.34, cy - s * 0.14);
  ctx.lineTo(cx + s * 0.22, cy - s * 0.06);
  ctx.lineTo(cx - s * 0.28, cy - s * 0.06);
  ctx.closePath();
  ctx.fill();
  // left-pointing board
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.26, cy + s * 0.0);
  ctx.lineTo(cx - s * 0.2, cy + s * 0.0);
  ctx.lineTo(cx - s * 0.32, cy + s * 0.08);
  ctx.lineTo(cx - s * 0.2, cy + s * 0.16);
  ctx.lineTo(cx + s * 0.26, cy + s * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(cx - s * 0.24, cy - s * 0.2, s * 0.44, s * 0.03);
  ctx.fillRect(cx - s * 0.18, cy + s * 0.02, s * 0.42, s * 0.03);
};

const drawRobot = ({ ctx, cx, cy, s, color, theme }: Pen) => {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.05;
  const w = s * 0.5;
  const h = s * 0.4;
  roundRect(ctx, cx - w / 2, cy - h / 2 + s * 0.04, w, h, s * 0.08);
  ctx.stroke();
  // ears
  ctx.fillRect(cx - w / 2 - s * 0.08, cy - s * 0.02, s * 0.06, s * 0.14);
  ctx.fillRect(cx + w / 2 + s * 0.02, cy - s * 0.02, s * 0.06, s * 0.14);
  // antenna
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2 + s * 0.04);
  ctx.lineTo(cx, cy - h / 2 - s * 0.06);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy - h / 2 - s * 0.08, s * 0.035, 0, Math.PI * 2);
  ctx.fill();
  // eyes + mouth
  ctx.fillStyle = theme.iconAccent.globe ?? color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx - w * 0.2, cy + s * 0.01, s * 0.045, 0, Math.PI * 2);
  ctx.arc(cx + w * 0.2, cy + s * 0.01, s * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - w * 0.18, cy + s * 0.1, w * 0.36, s * 0.035);
};

const drawSparkle = ({ ctx, cx, cy, s, color }: Pen) => {
  ctx.fillStyle = color;
  glow(ctx, color, s * 0.14);
  const star = (x: number, y: number, r: number) => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.22;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  };
  star(cx, cy, s * 0.36);
  star(cx + s * 0.3, cy - s * 0.28, s * 0.07);
  star(cx - s * 0.28, cy + s * 0.28, s * 0.05);
};

const drawDb = ({ ctx, cx, cy, s, color, accent }: Pen) => {
  const w = s * 0.4;
  const eh = s * 0.1;
  const top = cy - s * 0.26;
  const bot = cy + s * 0.26;
  glow(ctx, color, s * 0.1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, bot, w / 2, eh, 0, 0, Math.PI);
  ctx.lineTo(cx - w / 2, top);
  ctx.ellipse(cx, top, w / 2, eh, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = accent;
  ctx.lineWidth = s * 0.03;
  for (const y of [top, cy - s * 0.09, cy + s * 0.09]) {
    ctx.beginPath();
    ctx.ellipse(cx, y, w / 2, eh, 0, 0, Math.PI);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(cx, top, w / 2, eh, 0, 0, Math.PI * 2);
  ctx.fill();
};

const drawPlus = ({ ctx, cx, cy, s, color }: Pen) => {
  ctx.fillStyle = color;
  glow(ctx, color, s * 0.1);
  const t = s * 0.12;
  const l = s * 0.6;
  ctx.fillRect(cx - l / 2, cy - t / 2, l, t);
  ctx.fillRect(cx - t / 2, cy - l / 2, t, l);
};

const drawPencil = ({ ctx, cx, cy, s, color }: Pen) => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.045;
  ctx.lineJoin = "round";
  const L = s * 0.7;
  const W = s * 0.17;
  ctx.beginPath();
  ctx.moveTo(-L / 2, -W / 2);
  ctx.lineTo(L / 2 - W, -W / 2);
  ctx.lineTo(L / 2, 0);
  ctx.lineTo(L / 2 - W, W / 2);
  ctx.lineTo(-L / 2, W / 2);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-L / 2 + W * 0.8, -W / 2);
  ctx.lineTo(-L / 2 + W * 0.8, W / 2);
  ctx.moveTo(L / 2 - W, -W / 2);
  ctx.lineTo(L / 2 - W, W / 2);
  ctx.stroke();
  ctx.restore();
};

const drawBraces = ({ ctx, cx, cy, s, color }: Pen) => {
  ctx.fillStyle = color;
  glow(ctx, color, s * 0.06);
  ctx.font = `700 ${s * 0.42}px ${FONT}, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("{…}", cx, cy + s * 0.02);
};

const drawForm = ({ ctx, cx, cy, s, color }: Pen) => {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.035;
  const w = s * 0.5;
  const h = s * 0.62;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy - h / 2);
  ctx.lineTo(cx + w / 2 - s * 0.1, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy - h / 2 + s * 0.1);
  ctx.lineTo(cx + w / 2, cy + h / 2);
  ctx.lineTo(cx - w / 2, cy + h / 2);
  ctx.closePath();
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const y = cy - h * 0.3 + i * h * 0.19;
    ctx.lineWidth = s * 0.025;
    ctx.strokeRect(cx - w * 0.36, y - s * 0.03, s * 0.06, s * 0.06);
    if (i !== 2) {
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.36, y);
      ctx.lineTo(cx - w * 0.3, y + s * 0.025);
      ctx.lineTo(cx - w * 0.2, y - s * 0.035);
      ctx.stroke();
    }
    ctx.fillRect(cx - w * 0.12, y - s * 0.015, w * 0.48, s * 0.03);
  }
};

const ICON_DRAW: Record<IconKind, (p: Pen) => void> = {
  globe: (p) => drawGlobe(p, false),
  globeGreen: (p) => drawGlobe(p, false),
  globeCyan: (p) => drawGlobe(p, true),
  power: drawCircleArrow,
  refresh: drawRefresh,
  router: drawRouter,
  cloud: drawCloud,
  sign: drawSign,
  agent: drawRobot,
  sparkle: drawSparkle,
  db: drawDb,
  plus: drawPlus,
  pencil: drawPencil,
  braces: drawBraces,
  form: drawForm,
};

// ---------- tile faces ----------

export const makeFaceTexture = (
  shape: Shape,
  theme: Theme,
  icon: IconKind | null,
): Texture => {
  const { w, h } = SIZE[shape];
  const W = w * PPU;
  const H = h * PPU;
  const c = makeCanvas(W, H);
  const ctx = c.getContext("2d")!;
  const rimW = Math.max(3, 0.035 * PPU);

  if (icon === null) {
    // ghost face: dark, faintly outlined
    shapePath(ctx, shape, W, H, rimW);
    ctx.fillStyle = theme.ghostTop;
    ctx.fill();
    ctx.lineWidth = rimW * 0.7;
    ctx.strokeStyle = theme.ghostRim;
    ctx.stroke();
    return finish(c);
  }

  // body gradient
  shapePath(ctx, shape, W, H, rimW);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, theme.topA);
  g.addColorStop(1, theme.topB);
  ctx.fillStyle = g;
  ctx.fill();
  // soft inner sheen
  ctx.save();
  ctx.clip();
  const sheen = ctx.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.3, H * 0.2, Math.max(W, H) * 0.8);
  sheen.addColorStop(0, "rgba(255,255,255,0.10)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // rim
  ctx.save();
  glow(ctx, theme.rimGlow, rimW * 2.2);
  ctx.lineWidth = rimW;
  ctx.strokeStyle = theme.rim;
  shapePath(ctx, shape, W, H, rimW);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  if (shape === "wide") {
    const s = H * 0.72;
    const p: Pen = {
      ctx,
      cx: H * 0.56,
      cy: H / 2,
      s,
      color: theme.icon[icon],
      accent: theme.iconAccent[icon] ?? theme.icon[icon],
      theme,
    };
    ICON_DRAW[icon](p);
    ctx.shadowBlur = 0;
    ctx.fillStyle = theme.text;
    glow(ctx, theme.rimGlow, H * 0.04);
    ctx.font = `700 ${H * 0.2}px ${FONT}, monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("AI Agent", H * 1.0, H / 2 + H * 0.01);
  } else {
    const s = Math.min(W, H) * (shape === "small" ? 0.75 : 0.78);
    ICON_DRAW[icon]({
      ctx,
      cx: W / 2,
      cy: H / 2,
      s,
      color: theme.icon[icon],
      accent: theme.iconAccent[icon] ?? theme.icon[icon],
      theme,
    });
  }
  ctx.restore();
  return finish(c);
};

export const makeShadowTexture = (theme: Theme): Texture => {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
  g.addColorStop(0, theme.shadow);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return finish(c);
};

// Repeating ground grid: faint lines with rows of tiny dots.
export const makeGridTexture = (theme: Theme): Texture => {
  const S = 512; // covers 2 world units
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = theme.gridLine;
  ctx.fillRect(0, 0, S, 2);
  ctx.fillRect(0, 0, 2, S);
  ctx.fillStyle = theme.gridDot;
  for (let i = 0; i < 16; i++) {
    const x = (i + 0.5) * (S / 16);
    ctx.beginPath();
    ctx.arc(x, S / 2, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = finish(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  return t;
};

// Faint "code / log" lines that float next to the graph.
export const makeLabelTexture = (theme: Theme, seed: number): Texture => {
  const c = makeCanvas(1024, 256);
  const ctx = c.getContext("2d")!;
  let s = seed * 9301 + 49297;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  ctx.fillStyle = theme.label;
  ctx.shadowColor = theme.label;
  ctx.shadowBlur = 8;
  for (let row = 0; row < 4; row++) {
    let x = 20 + rnd() * 40;
    const y = 40 + row * 52;
    const end = 1000 - rnd() * 400;
    while (x < end) {
      const len = 30 + rnd() * 160;
      roundRect(ctx, x, y, Math.min(len, end - x), 14, 7);
      ctx.fill();
      x += len + 18 + rnd() * 20;
    }
  }
  return finish(c);
};
