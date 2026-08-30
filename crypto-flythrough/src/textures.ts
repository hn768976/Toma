import { useEffect, useState } from "react";
import { continueRender, delayRender, random } from "remotion";
import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  LinearFilter,
  SRGBColorSpace,
  type Texture,
} from "three";
import { buildCodeBlock, type CodeLine } from "./code-fragments";
import type { Palette, StreamAxis } from "./variants";

/** Distinct code blocks. Each is rendered once, in three brightness tiers. */
export const BLOCK_COUNT = 6;
/** dim (far) / main (mid) / bright (near). */
export const TIERS = ["dim", "main", "bright"] as const;
export type Tier = (typeof TIERS)[number];

export const CODE_TEXTURE_COUNT = BLOCK_COUNT * TIERS.length;

const TEX_W = 1024;
const TEX_H = 512;
const PAD_X = 26;
const PAD_Y = 22;

const MONO = '"DejaVu Sans Mono", "Liberation Mono", "Courier New", monospace';

export type TextureSet = {
  /** Indexed by `tierIndex * BLOCK_COUNT + blockIndex`. */
  readonly code: readonly Texture[];
  /**
   * The same blocks, pre-smeared along the stream axis. Used for the motion
   * blur copies so they merge into a continuous streak instead of reading as
   * a row of separate ghosts.
   */
  readonly codeSmeared: readonly Texture[];
  /** Invented coin face marks. */
  readonly marks: readonly Texture[];
  /** Small floating accent glyphs. */
  readonly accents: readonly Texture[];
  /** Width / height of the code planes. */
  readonly codeAspect: number;
};

export const codeTextureIndex = (tierIndex: number, blockIndex: number) =>
  tierIndex * BLOCK_COUNT + blockIndex;

/** Which brightness tier a texture slot belongs to. */
export const tierOfTextureIndex = (index: number) =>
  Math.floor(index / BLOCK_COUNT);

const makeCanvas = (w: number, h: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2d canvas context unavailable");
  }
  return { canvas, ctx };
};

const toTexture = (canvas: HTMLCanvasElement): Texture => {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
};

type TierStyle = {
  code: string;
  comment: string;
  accent: string;
  alpha: number;
  glow: number;
};

const tierStyle = (tier: Tier, palette: Palette): TierStyle => {
  if (tier === "bright") {
    return {
      code: palette.codeWhite,
      comment: palette.comment,
      accent: palette.accent,
      alpha: 0.58,
      glow: 14,
    };
  }
  if (tier === "main") {
    return {
      code: palette.codeMain,
      comment: palette.comment,
      accent: palette.accent,
      alpha: 0.9,
      glow: 10,
    };
  }
  return {
    code: palette.codeDim,
    comment: palette.codeMain,
    accent: palette.codeDim,
    alpha: 0.4,
    glow: 5,
  };
};

/** Taps used to build the pre-smeared variant of a block. */
const SMEAR_TAPS = 11;

const drawBlock = (
  lines: readonly CodeLine[],
  tier: Tier,
  palette: Palette,
  smear: { x: number; y: number },
): HTMLCanvasElement => {
  const { canvas, ctx } = makeCanvas(TEX_W, TEX_H);
  const style = tierStyle(tier, palette);

  // Fit the widest line into the usable width.
  const probe = 40;
  ctx.font = `${probe}px ${MONO}`;
  let widest = 1;
  for (const line of lines) {
    const w = ctx.measureText("  ".repeat(line.indent) + line.text).width;
    widest = Math.max(widest, w);
  }
  const fitted = (probe * (TEX_W - PAD_X * 2)) / widest;
  const lineCount = lines.length;
  const byHeight = (TEX_H - PAD_Y * 2) / (lineCount * 1.52);
  const fontSize = Math.min(fitted, byHeight, 46);
  const lineHeight = fontSize * 1.52;

  ctx.font = `${fontSize}px ${MONO}`;
  ctx.textBaseline = "top";
  ctx.globalCompositeOperation = "lighter";

  const blockHeight = lineCount * lineHeight;
  const top = (TEX_H - blockHeight) / 2;

  const smeared = smear.x !== 0 || smear.y !== 0;
  const taps = smeared ? SMEAR_TAPS : 1;
  const tapScale = 1 / taps;

  lines.forEach((line, i) => {
    const text = "  ".repeat(line.indent) + line.text;
    const y = top + i * lineHeight;

    if (line.kind === "comment") {
      // Comments are the brightest thing in the block — they are what the eye
      // catches as the fragment streams past.
      ctx.globalAlpha = Math.min(1, style.alpha * 1.15);
      ctx.fillStyle = style.comment;
      ctx.shadowColor = style.comment;
      ctx.shadowBlur = style.glow * 1.6;
    } else if (line.kind === "accent") {
      ctx.globalAlpha = style.alpha * 0.95;
      ctx.fillStyle = style.accent;
      ctx.shadowColor = style.accent;
      ctx.shadowBlur = style.glow;
    } else {
      ctx.globalAlpha = style.alpha * 0.82;
      ctx.fillStyle = style.code;
      ctx.shadowColor = style.code;
      ctx.shadowBlur = style.glow * 0.75;
    }
    // The smear itself softens the glyphs, so the (expensive) glow pass is
    // only worth paying for on the sharp variant.
    if (smeared) ctx.shadowBlur = 0;
    const baseAlpha = ctx.globalAlpha;
    for (let k = 0; k < taps; k++) {
      const u = taps === 1 ? 0 : k / (taps - 1) - 0.5;
      ctx.globalAlpha = baseAlpha * tapScale;
      ctx.fillText(text, PAD_X + u * smear.x, y + u * smear.y);
    }
    // A second pass thickens the glyph core so bloom has something to bite on.
    ctx.shadowBlur = 0;
    for (let k = 0; k < taps; k++) {
      const u = taps === 1 ? 0 : k / (taps - 1) - 0.5;
      ctx.globalAlpha = baseAlpha * 0.55 * tapScale;
      ctx.fillText(text, PAD_X + u * smear.x, y + u * smear.y);
    }
  });

  // Fade the block edges out so fragments read as drifting text rather than
  // as hard rectangular tiles, and so the depth-of-field pass has soft
  // boundaries to work with.
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = "destination-out";
  const fadeX = TEX_W * 0.09;
  const fadeY = TEX_H * 0.11;
  const edge = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    w: number,
    h: number,
  ) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), w, h);
  };
  edge(0, 0, fadeX, 0, fadeX, TEX_H);
  edge(TEX_W, 0, TEX_W - fadeX, 0, fadeX, TEX_H);
  edge(0, 0, 0, fadeY, TEX_W, fadeY);
  edge(0, TEX_H, 0, TEX_H - fadeY, TEX_W, fadeY);

  return canvas;
};

const drawMark = (index: number, palette: Palette): HTMLCanvasElement => {
  const size = 256;
  const { canvas, ctx } = makeCanvas(size, size);
  const c = size / 2;
  const r = size * 0.33;
  const rim = palette.coinRim ?? palette.codeWhite;
  const body = palette.coinBody ?? palette.codeMain;

  ctx.globalCompositeOperation = "lighter";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = rim;
  ctx.shadowColor = rim;
  ctx.shadowBlur = 14;
  ctx.lineWidth = size * 0.03;

  const poly = (sides: number, radius: number, rotation: number) => {
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = rotation + (i / sides) * Math.PI * 2;
      const x = c + Math.cos(a) * radius;
      const y = c + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  if (index === 0) {
    // Invented mark: hexagon with an inner triangle.
    poly(6, r, -Math.PI / 2);
    ctx.strokeStyle = body;
    ctx.shadowColor = body;
    poly(3, r * 0.52, -Math.PI / 2);
  } else if (index === 1) {
    // Invented mark: circle with a diagonal bar.
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = body;
    ctx.shadowColor = body;
    ctx.beginPath();
    ctx.moveTo(c - r * 0.62, c + r * 0.62);
    ctx.lineTo(c + r * 0.62, c - r * 0.62);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c - r * 0.28, c - r * 0.1);
    ctx.lineTo(c + r * 0.1, c - r * 0.1);
    ctx.stroke();
  } else {
    // Invented mark: diamond inside a ring, with three dots.
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.stroke();
    poly(4, r * 0.55, 0);
    ctx.fillStyle = body;
    ctx.shadowColor = body;
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(
        c + Math.cos(a) * r * 0.8,
        c + Math.sin(a) * r * 0.8,
        size * 0.022,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  return canvas;
};

const ACCENT_GLYPHS = ["0x7f", "◆", "//", "⟨⟩", "0b1", "∴"];

const drawAccent = (index: number, palette: Palette): HTMLCanvasElement => {
  const w = 256;
  const h = 128;
  const { canvas, ctx } = makeCanvas(w, h);
  const glyph = ACCENT_GLYPHS[index % ACCENT_GLYPHS.length];
  ctx.globalCompositeOperation = "lighter";
  ctx.font = `56px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = palette.accent;
  ctx.shadowColor = palette.accent;
  ctx.shadowBlur = 26;
  ctx.fillText(glyph, w / 2, h / 2);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.6;
  ctx.fillText(glyph, w / 2, h / 2);
  return canvas;
};

const buildAll = (palette: Palette, axis: StreamAxis): TextureSet => {
  const blocks: CodeLine[][] = [];
  for (let b = 0; b < BLOCK_COUNT; b++) {
    blocks.push(buildCodeBlock(b));
  }

  const none = { x: 0, y: 0 };
  // Nearer tiers travel further during the shutter, so their pre-smear is
  // proportionally longer.
  const SMEAR_BY_TIER = [0.06, 0.13, 0.28];
  const smearFor = (tierIndex: number) => {
    const amount = SMEAR_BY_TIER[tierIndex];
    return axis === "horizontal"
      ? { x: TEX_W * amount, y: 0 }
      : { x: 0, y: TEX_H * amount };
  };

  const code: Texture[] = [];
  const codeSmeared: Texture[] = [];
  TIERS.forEach((tier, tierIndex) => {
    const smear = smearFor(tierIndex);
    blocks.forEach((lines) => {
      code.push(toTexture(drawBlock(lines, tier, palette, none)));
      codeSmeared.push(toTexture(drawBlock(lines, tier, palette, smear)));
    });
  });

  const marks = [0, 1, 2].map((i) => toTexture(drawMark(i, palette)));
  const accents = [0, 1, 2, 3].map((i) =>
    toTexture(drawAccent(Math.floor(random(`accent-${i}`) * 6), palette)),
  );

  return { code, codeSmeared, marks, accents, codeAspect: TEX_W / TEX_H };
};

/**
 * Generates the shared canvas textures exactly once. Every plane in the scene
 * samples one of these; nothing is regenerated per frame.
 */
export const useCodeTextures = (
  palette: Palette,
  axis: StreamAxis,
): TextureSet | null => {
  const [handle] = useState(() => delayRender("generating code textures"));
  const [set, setSet] = useState<TextureSet | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ready =
      typeof document !== "undefined" && document.fonts
        ? document.fonts.ready
        : Promise.resolve();
    ready.then(() => {
      if (cancelled) return;
      setSet(buildAll(palette, axis));
      continueRender(handle);
    });
    return () => {
      cancelled = true;
    };
    // The palette is fixed for the lifetime of a composition instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  return set;
};
