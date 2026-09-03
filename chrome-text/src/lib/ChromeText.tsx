/**
 * <ChromeText> — reflective "chrome" letterforms on a canvas.
 *
 * The letterform fill is not a flat colour and not a two-stop gradient: it is
 * a five-band vertical gradient with one HARD horizontal boundary at the
 * optical centre. That single hard edge among soft gradients is the horizon a
 * reflective surface shows, and it is the cue that makes the word read as
 * polished metal rather than as coloured text. A vertical highlight sweeps
 * across the word, clipped to the glyphs, and directional rims (bright top and
 * left, dark bottom and right) give the letters thickness.
 *
 * Everything is palette-agnostic and deterministic: the picture is a pure
 * function of (word, palette, sweep), so it is safe under Remotion's
 * out-of-order, multi-process rendering.
 *
 * Canvas 2D has no text-to-path API, so the "letterform path" is a white-on-
 * transparent mask canvas built once and reused every frame as a clip region
 * via `destination-in`. Per-frame cost is therefore two gradient fills, not
 * text layout.
 */
import { useMemo } from "react";
import type { CSSProperties } from "react";
import { createCanvas, ctx2d, useCanvasPaint } from "./canvas";
import type { PaintGate } from "./canvas";
import { mix, rgba } from "./color";
import { bloomPass } from "./passes";

export type ChromePalette = {
  /** The bright gradient bands. */
  faceLight: string;
  /** The dark gradient bands. */
  faceDeep: string;
  /** The travelling highlight — the brightest colour in the piece. */
  faceCore: string;
  /** Rim along the top and left edges. */
  rimBright: string;
  /** Rim along the bottom and right edges. */
  rimDark: string;
};

export type ChromeWordOptions = {
  word: string;
  fontFamily: string;
  /** Cap height in destination pixels. */
  capHeight: number;
  /** Letterspacing as a fraction of the font size. */
  trackingRatio: number;
  /** Width of a space as a fraction of the font size. Wider than tracking. */
  wordGapRatio: number;
  /** Hard cap on the set width; the word is scaled down to fit. */
  maxWidth: number;
};

export type ChromeGlyph = { char: string; x: number; advance: number };

export type ChromeWord = {
  options: ChromeWordOptions;
  fontSize: number;
  capHeight: number;
  /** Set width of the word, excluding padding. */
  setWidth: number;
  /** Breathing room around the glyphs for rims, glow and bloom. */
  pad: number;
  /** Size of the mask/scratch canvases, i.e. setWidth/capHeight plus padding. */
  boxWidth: number;
  boxHeight: number;
  /** Glyph box coordinates of the cap line and the baseline. */
  capTopY: number;
  baselineY: number;
  glyphs: ChromeGlyph[];
  /** White glyphs on transparent — the reusable clip region. */
  mask: HTMLCanvasElement;
  /** Pre-tinted directional rims. */
  rimTopLeft: HTMLCanvasElement;
  rimBottomRight: HTMLCanvasElement;
};

/**
 * The optical centre of the letterforms, where the hard horizon sits. Slightly
 * above the geometric centre because that is where the eye reads "middle".
 */
export const CHROME_HORIZON = 0.48;

/**
 * The five bands of the reflective face, top of the cap (t = 0) to the
 * baseline (t = 1).
 *
 * The spacing is deliberately uneven — even spacing reads as shading, uneven
 * spacing reads as reflection. The duplicated stop at CHROME_HORIZON is what
 * produces the hard edge: canvas gradients allow two stops at one offset and
 * render the transition with no interpolation at all.
 *
 * The bands stay well inside the palette's extremes. Driving them all the way
 * to the light and deep ends makes the letters stripe rather than shine, and
 * the horizon still reads as hard from the discontinuity alone — it does not
 * need the full contrast range behind it.
 */
export const chromeFaceStops = (
  p: ChromePalette,
): readonly { t: number; color: string }[] => [
  { t: 0, color: mix(p.faceLight, p.faceDeep, 0.34) },
  { t: 0.14, color: p.faceLight },
  { t: 0.34, color: mix(p.faceDeep, p.faceLight, 0.24) },
  { t: 0.46, color: mix(p.faceDeep, p.faceLight, 0.44) },
  { t: CHROME_HORIZON, color: mix(p.faceDeep, p.faceLight, 0.44) },
  { t: CHROME_HORIZON, color: mix(p.faceLight, p.faceCore, 0.22) },
  { t: 0.62, color: mix(p.faceLight, p.faceDeep, 0.32) },
  { t: 0.86, color: mix(p.faceLight, p.faceDeep, 0.72) },
  { t: 1, color: mix(p.faceDeep, p.faceLight, 0.12) },
];

const measureCtx = (): CanvasRenderingContext2D => ctx2d(createCanvas(8, 8));

/** Builds the rim band lying on one side of the glyphs, tinted to `color`. */
const buildRim = (
  mask: HTMLCanvasElement,
  color: string,
  dx: number,
  dy: number,
): HTMLCanvasElement => {
  const canvas = createCanvas(mask.width, mask.height);
  const ctx = ctx2d(canvas);
  // A band along one pair of edges is the glyph minus a copy of itself shifted
  // away from those edges.
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = "destination-out";
  ctx.drawImage(mask, dx, dy);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
};

/**
 * Lays the word out glyph by glyph and bakes the mask and rim canvases.
 *
 * Expensive, and must not run before the webfont is available: the whole
 * layout is derived from measured metrics. Call it through `useChromeWord`.
 */
export const buildChromeWord = (
  options: ChromeWordOptions,
  palette: ChromePalette,
): ChromeWord => {
  const { word, fontFamily, trackingRatio, wordGapRatio, maxWidth } = options;
  const ctx = measureCtx();

  // Solve for the font size that gives the requested cap height, from the
  // measured ascent of a flat-topped capital rather than a guessed ratio.
  const probe = 200;
  ctx.font = `${probe}px "${fontFamily}"`;
  const capRatio = ctx.measureText("H").actualBoundingBoxAscent / probe;
  let fontSize = options.capHeight / capRatio;
  let capHeight = options.capHeight;

  const layOut = (size: number) => {
    ctx.font = `${size}px "${fontFamily}"`;
    const tracking = size * trackingRatio;
    const wordGap = size * wordGapRatio;
    const glyphs: ChromeGlyph[] = [];
    let x = 0;
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      const advance = char === " " ? wordGap : ctx.measureText(char).width;
      glyphs.push({ char, x, advance });
      x += advance;
      if (i < word.length - 1) {
        x += tracking;
      }
    }
    return { glyphs, setWidth: x };
  };

  let { glyphs, setWidth } = layOut(fontSize);
  if (setWidth > maxWidth) {
    const scale = maxWidth / setWidth;
    fontSize *= scale;
    capHeight *= scale;
    ({ glyphs, setWidth } = layOut(fontSize));
  }

  // Round shapes overshoot the cap line and the baseline, and the rims and
  // glow need room, so the box is generously larger than the set text.
  const pad = capHeight * 0.55;
  const boxWidth = setWidth + pad * 2;
  const boxHeight = capHeight + pad * 2;
  const capTopY = pad;
  const baselineY = pad + capHeight;

  const mask = createCanvas(boxWidth, boxHeight);
  const mctx = ctx2d(mask);
  mctx.font = `${fontSize}px "${fontFamily}"`;
  mctx.textBaseline = "alphabetic";
  mctx.textAlign = "left";
  mctx.fillStyle = "rgb(255, 255, 255)";
  for (const glyph of glyphs) {
    if (glyph.char === " ") {
      continue;
    }
    mctx.fillText(glyph.char, pad + glyph.x, baselineY);
  }

  const rimWidth = Math.max(2, capHeight * 0.016);
  return {
    options,
    fontSize,
    capHeight,
    setWidth,
    pad,
    boxWidth,
    boxHeight,
    capTopY,
    baselineY,
    glyphs,
    mask,
    rimTopLeft: buildRim(mask, palette.rimBright, rimWidth, rimWidth),
    rimBottomRight: buildRim(mask, palette.rimDark, -rimWidth, -rimWidth),
  };
};

export type ChromeWordSource = () => ChromeWord;

const wordCache = new Map<string, ChromeWord>();

/**
 * Memoises the letterform build across frames AND across remounts.
 *
 * Returns a getter rather than the word itself: the build depends on webfont
 * metrics, so it must be deferred until inside a paint pass that runs behind
 * the font gate.
 */
export const useChromeWord = (
  options: ChromeWordOptions,
  palette: ChromePalette,
): ChromeWordSource => {
  const key = JSON.stringify([options, palette]);
  return useMemo(() => {
    return () => {
      const cached = wordCache.get(key);
      if (cached) {
        return cached;
      }
      const built = buildChromeWord(options, palette);
      wordCache.set(key, built);
      return built;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
};

export type ChromeFaceOptions = {
  /** Highlight position across the word, 0..1. Whole cycles keep the loop. */
  sweep: number;
  /** Half-width of the travelling highlight, as a fraction of the set width. */
  highlightWidth?: number;
};

/**
 * Renders the chrome face — bands, hard horizon, travelling highlight and
 * rims — into `scratch`, and returns it.
 *
 * `scratch` must be a `boxWidth` x `boxHeight` canvas owned by the caller, so
 * two layers can render the same word in one frame without fighting over it.
 */
export const renderChromeWord = (
  scratch: HTMLCanvasElement,
  word: ChromeWord,
  palette: ChromePalette,
  { sweep, highlightWidth = 0.09 }: ChromeFaceOptions,
): HTMLCanvasElement => {
  const ctx = ctx2d(scratch);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.clearRect(0, 0, scratch.width, scratch.height);

  // 1. The multi-band reflective face, spanning cap line to baseline.
  const face = ctx.createLinearGradient(0, word.capTopY, 0, word.baselineY);
  for (const stop of chromeFaceStops(palette)) {
    face.addColorStop(stop.t, stop.color);
  }
  ctx.fillStyle = face;
  ctx.fillRect(0, 0, scratch.width, scratch.height);

  // 2. The travelling highlight: a vertical band brighter than any base stop,
  //    sweeping right across the word and off both ends.
  const band = word.setWidth * highlightWidth;
  const travel = word.setWidth + band * 4;
  const hx = word.pad - band * 2 + sweep * travel;
  const sweepGrad = ctx.createLinearGradient(hx - band, 0, hx + band, 0);
  sweepGrad.addColorStop(0, rgba(palette.faceCore, 0));
  sweepGrad.addColorStop(0.35, rgba(palette.faceCore, 0.16));
  sweepGrad.addColorStop(0.5, rgba(palette.faceCore, 0.5));
  sweepGrad.addColorStop(0.65, rgba(palette.faceCore, 0.16));
  sweepGrad.addColorStop(1, rgba(palette.faceCore, 0));
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = sweepGrad;
  ctx.fillRect(0, 0, scratch.width, scratch.height);

  // 3. Clip everything drawn so far to the letterforms. The highlight
  //    therefore never shows in the gaps between letters.
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(word.mask, 0, 0);

  // 4. Directional rims, which is what gives the letters thickness.
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(word.rimBottomRight, 0, 0);
  ctx.drawImage(word.rimTopLeft, 0, 0);

  return scratch;
};

export type ChromeTextProps = {
  /** Deferred letterform build, from `useChromeWord`. */
  source: ChromeWordSource;
  palette: ChromePalette;
  /** Frame size; the canvas backing store matches it exactly. */
  width: number;
  height: number;
  /** Centre of the word within the frame. */
  centerX: number;
  centerY: number;
  sweep: number;
  /**
   * Outer-glow opacity. Drive this with a sine whose period divides the clip
   * length to make the glow breathe without breaking the loop.
   */
  glowAlpha: number;
  /** Fallback glow hue when no colour field is supplied. */
  glowColor: string;
  /**
   * A low-resolution colour field covering the whole frame. When given, the
   * outer glow is tinted by whatever is behind each part of the word, so light
   * pools behind the text show through in its halo.
   */
  glowField?: HTMLCanvasElement | null;
  gate?: PaintGate;
  style?: CSSProperties;
};

/** The word layer: outer glow, chrome face, rims and bloom. */
export const ChromeText: React.FC<ChromeTextProps> = ({
  source,
  palette,
  width,
  height,
  centerX,
  centerY,
  sweep,
  glowAlpha,
  glowColor,
  glowField,
  gate,
  style,
}) => {
  // One scratch canvas per mounted layer, reused every frame.
  const scratchRef = useMemo<{
    face?: HTMLCanvasElement;
    halo?: HTMLCanvasElement;
    tint?: HTMLCanvasElement;
  }>(() => ({}), []);

  const ref = useCanvasPaint(
    (ctx) => {
      const word = source();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.filter = "none";
      ctx.clearRect(0, 0, width, height);

      if (!scratchRef.face) {
        scratchRef.face = createCanvas(word.boxWidth, word.boxHeight);
        scratchRef.halo = createCanvas(word.boxWidth, word.boxHeight);
        scratchRef.tint = createCanvas(word.boxWidth, word.boxHeight);
      }
      const face = renderChromeWord(scratchRef.face, word, palette, { sweep });
      const halo = scratchRef.halo as HTMLCanvasElement;
      const tint = scratchRef.tint as HTMLCanvasElement;

      const x = Math.round(centerX - word.boxWidth / 2);
      const y = Math.round(centerY - word.boxHeight / 2);

      // The colour the halo takes: the accent hue as a floor, with the light
      // field laid over it. The field is drawn several times so its alpha
      // saturates while its hue is untouched — source-over of a colour onto
      // itself changes only opacity. Without that the halo would inherit the
      // field's low opacity and all but disappear.
      const tctx = ctx2d(tint);
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.globalCompositeOperation = "source-over";
      tctx.globalAlpha = 1;
      tctx.filter = "none";
      tctx.fillStyle = glowColor;
      tctx.fillRect(0, 0, tint.width, tint.height);
      if (glowField) {
        const sx = (x / width) * glowField.width;
        const sy = (y / height) * glowField.height;
        const sw = (word.boxWidth / width) * glowField.width;
        const sh = (word.boxHeight / height) * glowField.height;
        tctx.imageSmoothingQuality = "high";
        for (let i = 0; i < 4; i++) {
          tctx.drawImage(glowField, sx, sy, sw, sh, 0, 0, tint.width, tint.height);
        }
      }

      // Outer glow: a blurred silhouette of the word, wearing that colour.
      const hctx = ctx2d(halo);
      hctx.setTransform(1, 0, 0, 1, 0, 0);
      hctx.globalCompositeOperation = "source-over";
      hctx.globalAlpha = 1;
      hctx.filter = `blur(${word.capHeight * 0.14}px)`;
      hctx.clearRect(0, 0, halo.width, halo.height);
      hctx.drawImage(word.mask, 0, 0);
      hctx.filter = "none";
      hctx.globalCompositeOperation = "source-in";
      hctx.drawImage(tint, 0, 0);

      ctx.globalCompositeOperation = "lighter";
      for (const [radius, alpha] of [
        [word.capHeight * 0.06, 0.85],
        [word.capHeight * 0.22, 0.6],
        [word.capHeight * 0.6, 0.42],
      ] as const) {
        ctx.filter = `blur(${radius}px)`;
        ctx.globalAlpha = alpha * glowAlpha;
        ctx.drawImage(halo, x, y);
      }
      ctx.filter = "none";
      ctx.globalAlpha = 1;

      // The letterforms themselves, then bloom lifted off them.
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(face, x, y);
      bloomPass(
        ctx,
        face,
        { radii: [word.capHeight * 0.035, word.capHeight * 0.12], alpha: 0.17 },
        x,
        y,
      );
      ctx.filter = "none";
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    },
    [source, palette, width, height, centerX, centerY, sweep, glowAlpha, glowColor, glowField],
    gate,
  );

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", ...style }}
    />
  );
};
