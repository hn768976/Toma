import { CanvasTexture, LinearFilter, type Texture } from "three";

/**
 * The two letters inside the brain, drawn as geometry.
 *
 * A clean grotesque "A" is two angled stems with a mitred apex and a crossbar;
 * the "I" is a single stem. Constructing them means the clip depends on no
 * installed font and renders identically wherever the 4K job is run — and, like
 * the brain, carries no third-party artwork licence.
 */

const SIZE = 1024;

const build = (): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE / 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  const H = SIZE / 2;

  const capHeight = 300;
  const stroke = 54;
  const top = (H - capHeight) / 2;
  const baseline = top + capHeight;

  // Layout: A is 288 wide at the baseline, then a gap, then the I stem.
  const aWidth = 288;
  const gap = 104;
  const total = aWidth + gap + stroke;
  const x0 = (SIZE - total) / 2;

  const aLeft = x0;
  const aRight = x0 + aWidth;
  const apex = x0 + aWidth / 2;
  const iX = aRight + gap + stroke / 2;

  const drawGlyphs = () => {
    ctx.lineWidth = stroke;
    ctx.lineJoin = "miter";
    ctx.miterLimit = 24;
    ctx.lineCap = "butt";

    // "A": both stems in one path so the apex mitres cleanly.
    ctx.beginPath();
    ctx.moveTo(aLeft, baseline);
    ctx.lineTo(apex, top);
    ctx.lineTo(aRight, baseline);
    ctx.stroke();

    // Crossbar, set at 32% of the cap height and slightly lighter than the
    // stems, the way a geometric grotesque draws it.
    const t = 0.32;
    const lx = aLeft + (apex - aLeft) * t;
    const rx = aRight + (apex - aRight) * t;
    const y = baseline + (top - baseline) * t;
    ctx.lineWidth = stroke * 0.86;
    ctx.beginPath();
    ctx.moveTo(lx, y);
    ctx.lineTo(rx, y);
    ctx.stroke();

    // "I".
    ctx.lineWidth = stroke;
    ctx.beginPath();
    ctx.moveTo(iX, top);
    ctx.lineTo(iX, baseline);
    ctx.stroke();
  };

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SIZE, H);
  ctx.globalCompositeOperation = "lighter";

  // A couple of blurred passes bake the letters' own glow into the texture, so
  // the "AI" reads as emitting light rather than as a flat decal.
  for (const [blur, alpha] of [
    [34, 0.5],
    [14, 0.6],
  ] as const) {
    ctx.filter = `blur(${blur}px)`;
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    drawGlyphs();
  }
  ctx.filter = "none";
  ctx.strokeStyle = "#ffffff";
  drawGlyphs();
  ctx.globalCompositeOperation = "source-over";
  return canvas;
};

let cached: Texture | null = null;

/** Built exactly once per JS context and shared by both compositions. */
export const getAiTexture = (): Texture => {
  if (!cached) {
    const tex = new CanvasTexture(build());
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = "";
    tex.needsUpdate = true;
    cached = tex;
  }
  return cached;
};

/** Width / height of the generated texture, for the billboard's aspect. */
export const AI_ASPECT = 2;
