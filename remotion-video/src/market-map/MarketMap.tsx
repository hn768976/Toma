import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import { seededRandom } from "../particle-ring/random";
import { MARKET_FONT_FAMILY_NAME } from "../load-fonts";
import {
  CANDLE_BODY_WIDTH,
  CANDLE_WICK_WIDTH,
  DOT_SHIMMER_PERIOD,
  DOT_WAVE_PERIOD,
  DURATION_IN_FRAMES,
  HAZE_PERIOD,
  STREAK_PERIOD,
  TICKER_BOB_PERIOD,
  TICKER_FAST_TICK_FRAMES,
  TICKER_PERIOD,
  computeGeometry,
} from "./constants";
import {
  cameraAtFrame,
  depthFade,
  latToV,
  lonToU,
  project,
  type Camera,
  type Projected,
} from "./projection";
import {
  STREAK_V_MAX,
  STREAK_V_MIN,
  generateCandles,
  generateGridDots,
  generateHazeBlobs,
  generateStreaks,
  generateTickers,
  tickerValue,
  type Ticker,
} from "./scene";
import { THEMES, type MarketTheme, type ThemeName } from "./theme";
import { buildRamp, parseRgb, rgbString, rgbaString } from "./color";
import { WORLD_DOTS } from "./world-dots";

export const marketMapSchema = z.object({
  // "bearish" matches the red, falling reference cut; "bullish" is the
  // green, rising one. See theme.ts - this flips motion, not just colour.
  theme: z.enum(["bearish", "bullish"]),
  // 1 = 1080p (1920x1080), 2 = 4K (3840x2160). Must match the width/height
  // the Composition is registered with in Root.tsx.
  resolutionScale: z.number().positive(),
});

export type MarketMapProps = z.infer<typeof marketMapSchema>;

export const marketMapDefaults: MarketMapProps = {
  theme: "bearish",
  resolutionScale: 1,
};

const TAU = Math.PI * 2;

// Canvas needs the family quoted, with real fallbacks in case the webfont
// somehow never arrives.
const FONT_STACK = `"${MARKET_FONT_FAMILY_NAME}", "Courier New", monospace`;

// Ticker values re-roll on a cycle index; taking that index modulo the
// number of cycles in the clip makes the digits land back on their frame-0
// values at frame 360, so the loop closes on content as well as motion.
const TICKER_CYCLES_PER_LOOP = DURATION_IN_FRAMES / TICKER_PERIOD;
const FAST_TICKS_PER_LOOP = DURATION_IN_FRAMES / TICKER_FAST_TICK_FRAMES;

const DOT_RAMP_STEPS = 14;

const createCanvas = (width: number, height: number) => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

/**
 * Fills the plane-space rectangle spanned by two opposite corners. The four
 * corners go through the camera individually, so the result is the proper
 * projected quad - a rectangle on a tilted plane is a trapezium on screen,
 * and drawing it as an axis-aligned rect would break the perspective the
 * dots and grid establish.
 */
const fillPlaneQuad = (
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  w: number,
) => {
  const a = project(cam, u0, v0, w);
  const b = project(cam, u1, v0, w);
  const c = project(cam, u1, v1, w);
  const d = project(cam, u0, v1, w);
  if (!a.visible || !b.visible || !c.visible || !d.visible) return;

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
};

const drawArrow = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  direction: -1 | 1,
  color: string,
) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  if (direction < 0) {
    ctx.moveTo(cx - size / 2, cy - size * 0.4);
    ctx.lineTo(cx + size / 2, cy - size * 0.4);
    ctx.lineTo(cx, cy + size * 0.55);
  } else {
    ctx.moveTo(cx - size / 2, cy + size * 0.4);
    ctx.lineTo(cx + size / 2, cy + size * 0.4);
    ctx.lineTo(cx, cy - size * 0.55);
  }
  ctx.closePath();
  ctx.fill();
};

type PlacedTicker = {
  ticker: Ticker;
  point: Projected;
  env: number;
  value: number;
};

/**
 * Draws one ticker as an upright screen-space label. The anchor is
 * projected through the camera (so it sits in the scene and scales with
 * depth) but the label itself is not skewed - readouts like this are
 * composited flat over the plate in the reference, and perspective-warping
 * the glyphs would just make them unreadable.
 */
const drawTicker = (
  ctx: CanvasRenderingContext2D,
  placed: PlacedTicker,
  theme: MarketTheme,
  tickerFontSize: number,
  accentGlow: string,
) => {
  const { ticker, point, env, value } = placed;

  const fontSize =
    tickerFontSize * ticker.sizeScale * clamp(point.scale, 0.52, 1.7);
  const pctSize = fontSize * 0.62;
  const text = value.toFixed(2);

  ctx.font = `${fontSize}px ${FONT_STACK}`;
  const textW = ctx.measureText(text).width;
  ctx.font = `${pctSize}px ${FONT_STACK}`;
  const pctW = ctx.measureText("%").width;

  const gap = fontSize * 0.2;
  const arrowW = ticker.showArrow ? fontSize * 0.52 + gap : 0;
  const padX = fontSize * 0.3;
  const padY = fontSize * 0.22;
  const boxW = arrowW + textW + gap + pctW + padX * 2;
  const boxH = fontSize * 1.02 + padY * 2;
  const boxX = point.x - boxW / 2;
  const boxY = point.y - boxH / 2;

  ctx.globalAlpha = env * clamp(depthFade(point.scale) * 1.05, 0, 1);

  let textColor: string;
  if (ticker.style === 1) {
    ctx.fillStyle = theme.chipFill;
    ctx.shadowColor = accentGlow;
    ctx.shadowBlur = fontSize * 0.9;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.shadowBlur = 0;
    textColor = theme.chipText;
  } else if (ticker.style === 2) {
    ctx.fillStyle = theme.lightChipFill;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    textColor = theme.lightChipText;
  } else {
    // Plain readouts alternate between near-white and full accent, which
    // is what gives the reference frame its mix of hot and cool numbers.
    textColor =
      seededRandom(ticker.seed, 269) < 0.55 ? theme.plainText : theme.accent;
    ctx.shadowColor = accentGlow;
    ctx.shadowBlur = fontSize * 0.7;
  }

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  let cursor = boxX + padX;
  if (ticker.showArrow) {
    drawArrow(
      ctx,
      cursor + fontSize * 0.26,
      point.y,
      fontSize * 0.44,
      theme.direction,
      textColor,
    );
    cursor += arrowW;
  }

  ctx.fillStyle = textColor;
  ctx.font = `${fontSize}px ${FONT_STACK}`;
  ctx.fillText(text, cursor, point.y);
  cursor += textW + gap;
  ctx.font = `${pctSize}px ${FONT_STACK}`;
  // Sat up slightly, the way a percent sign is set on a trading board.
  ctx.fillText("%", cursor, point.y - fontSize * 0.16);

  ctx.shadowBlur = 0;
};

/**
 * A global market dot-map: continents rendered as a lattice of glowing
 * LEDs on a plane tilted away from the camera, over a receding ground
 * grid, with light shafts raking the plane and percentage readouts
 * floating above it.
 *
 * Drawn on canvas rather than SVG/DOM because it pushes 5000+ map dots and
 * ~2000 grid dots every frame. Bloom follows the same approach as the
 * particle-ring composition: a CSS-blurred copy of the emissive pass sits
 * under a crisp copy, both screen-blended over the background. Tickers get
 * their own un-blended layer on top, since the solid quote-board chips are
 * opaque and would wash out under a screen blend.
 */
export const MarketMap: React.FC<MarketMapProps> = ({
  theme: themeName,
  resolutionScale,
}) => {
  const frame = useCurrentFrame();
  const theme = THEMES[themeName as ThemeName];

  const geometry = useMemo(
    () => computeGeometry(resolutionScale),
    [resolutionScale],
  );
  const { width, height } = geometry;

  const gridDots = useMemo(() => generateGridDots(), []);
  const candles = useMemo(
    () => generateCandles(theme.direction),
    [theme.direction],
  );
  const streaks = useMemo(() => generateStreaks(), []);
  const tickers = useMemo(() => generateTickers(), []);
  const hazeBlobs = useMemo(() => generateHazeBlobs(), []);

  const accentRgb = useMemo(() => parseRgb(theme.accent), [theme.accent]);
  const accentDim = useMemo(
    () => rgbString(parseRgb(theme.accentDim)),
    [theme.accentDim],
  );
  const hazeRgb = useMemo(() => parseRgb(theme.haze), [theme.haze]);
  const coreRgb = useMemo(() => parseRgb(theme.dotCore), [theme.dotCore]);
  const accentGlow = useMemo(() => rgbaString(accentRgb, 0.85), [accentRgb]);
  // Dots shade from the saturated accent when dim/distant to the near-white
  // core when hot, which is how the reference keeps a red frame from going
  // flat: the bright dots read white, the colour lives in the falloff.
  const dotRamp = useMemo(
    () => buildRamp(accentRgb, coreRgb, DOT_RAMP_STEPS),
    [accentRgb, coreRgb],
  );

  // Per-dot identity: a shimmer phase and a base brightness, both pure
  // functions of the dot's index in the baked lattice.
  const dotCount = WORLD_DOTS.length / 2;
  const dotPhases = useMemo(() => {
    const arr = new Float32Array(dotCount);
    for (let i = 0; i < dotCount; i++) arr[i] = seededRandom(i, 71) * TAU;
    return arr;
  }, [dotCount]);
  const dotBrightness = useMemo(() => {
    const arr = new Float32Array(dotCount);
    for (let i = 0; i < dotCount; i++) {
      arr[i] = 0.5 + seededRandom(i, 89) * 0.58;
    }
    return arr;
  }, [dotCount]);

  const emissive = useMemo(() => createCanvas(width, height), [width, height]);
  const glowRef = useRef<HTMLCanvasElement>(null);
  const sharpRef = useRef<HTMLCanvasElement>(null);
  const tickerRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    if (!emissive) return;
    const ctx = emissive.getContext("2d");
    const glowCtx = glowRef.current?.getContext("2d");
    const sharpCtx = sharpRef.current?.getContext("2d");
    const tickCtx = tickerRef.current?.getContext("2d");
    if (!ctx || !glowCtx || !sharpCtx || !tickCtx) return;

    const cam = cameraAtFrame(frame, geometry);
    const margin = 48 * geometry.sizeScale;
    const onScreen = (p: Projected) =>
      p.x >= -margin &&
      p.x <= width + margin &&
      p.y >= -margin &&
      p.y <= height + margin;

    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";

    // --- Atmosphere, behind everything -------------------------------
    const hazePhase = (frame / HAZE_PERIOD) * TAU;
    ctx.globalAlpha = 1;
    for (const blob of hazeBlobs) {
      const bx = (blob.x + blob.driftX * Math.sin(hazePhase + blob.phase)) * width;
      const by =
        (blob.y + blob.driftY * Math.cos(hazePhase + blob.phase)) * height;
      const r = blob.radius * width;
      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      grad.addColorStop(0, rgbaString(hazeRgb, blob.alpha));
      grad.addColorStop(1, rgbaString(hazeRgb, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(bx - r, by - r, r * 2, r * 2);
    }

    // --- Ground grid --------------------------------------------------
    ctx.fillStyle = accentDim;
    for (const dot of gridDots) {
      const p = project(cam, dot.u, dot.v);
      if (!p.visible || !onScreen(p)) continue;
      ctx.globalAlpha = (dot.major ? 0.42 : 0.17) * depthFade(p.scale);
      ctx.beginPath();
      ctx.arc(
        p.x,
        p.y,
        geometry.gridDotRadius * clamp(p.scale, 0.4, 1.6),
        0,
        TAU,
      );
      ctx.fill();
    }

    // --- Background candlestick series --------------------------------
    for (const candle of candles) {
      const base = candle.counterTrend ? 0.04 : 0.062;
      ctx.globalAlpha = base * 0.8;
      fillPlaneQuad(
        ctx,
        cam,
        candle.u - CANDLE_WICK_WIDTH,
        candle.lowV,
        candle.u + CANDLE_WICK_WIDTH,
        candle.highV,
        0,
      );
      ctx.globalAlpha = base;
      fillPlaneQuad(
        ctx,
        cam,
        candle.u - CANDLE_BODY_WIDTH,
        Math.min(candle.openV, candle.closeV),
        candle.u + CANDLE_BODY_WIDTH,
        Math.max(candle.openV, candle.closeV),
        0,
      );
    }

    // --- The map ------------------------------------------------------
    const shimmerFreq = TAU / DOT_SHIMMER_PERIOD;
    const waveFreq = TAU / DOT_WAVE_PERIOD;
    let lastRamp = -1;
    for (let i = 0; i < dotCount; i++) {
      const lon = WORLD_DOTS[i * 2];
      const lat = WORLD_DOTS[i * 2 + 1];
      const p = project(cam, lonToU(lon), latToV(lat));
      if (!p.visible || !onScreen(p)) continue;

      const shimmer = 0.74 + 0.26 * Math.sin(frame * shimmerFreq + dotPhases[i]);
      // A slow brightness wave crossing the map, so activity sweeps the
      // globe instead of every dot twinkling independently.
      const wave = 0.82 + 0.18 * Math.sin(lon * 0.021 - frame * waveFreq);
      const alpha = Math.min(
        1,
        dotBrightness[i] * shimmer * wave * depthFade(p.scale) * 1.15,
      );
      if (alpha <= 0.012) continue;

      const rampIdx = Math.round(alpha * (DOT_RAMP_STEPS - 1));
      if (rampIdx !== lastRamp) {
        ctx.fillStyle = dotRamp[rampIdx];
        lastRamp = rampIdx;
      }
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, geometry.dotRadius * clamp(p.scale, 0.5, 2.1), 0, TAU);
      ctx.fill();
    }

    // --- Light shafts -------------------------------------------------
    const travel = STREAK_V_MAX - STREAK_V_MIN;
    ctx.globalAlpha = 1;
    ctx.lineCap = "round";
    for (const streak of streaks) {
      const t = (((frame / STREAK_PERIOD + streak.phase) % 1) + 1) % 1;
      // The head runs with the market: down the plane when bearish, up it
      // when bullish. The tail trails behind, so the shaft always points
      // back the way it came.
      const span = travel + streak.length * 2;
      const headV =
        theme.direction < 0
          ? STREAK_V_MAX + streak.length - t * span
          : STREAK_V_MIN - streak.length + t * span;
      const tailV = headV - theme.direction * streak.length;

      const head = project(cam, streak.u, headV, streak.elevation);
      const tail = project(cam, streak.u, tailV, streak.elevation);
      if (!head.visible || !tail.visible) continue;
      if (!onScreen(head) && !onScreen(tail)) continue;

      const alpha =
        streak.brightness * Math.sin(Math.PI * t) * depthFade(head.scale) * 1.1;
      if (alpha <= 0.012) continue;

      const grad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
      grad.addColorStop(0, rgbaString(coreRgb, alpha));
      grad.addColorStop(0.12, rgbaString(accentRgb, alpha * 0.85));
      grad.addColorStop(1, rgbaString(accentRgb, 0));
      ctx.strokeStyle = grad;
      ctx.lineWidth =
        geometry.streakWidth * streak.widthScale * clamp(head.scale, 0.5, 1.8);
      ctx.beginPath();
      ctx.moveTo(head.x, head.y);
      ctx.lineTo(tail.x, tail.y);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    glowCtx.clearRect(0, 0, width, height);
    glowCtx.drawImage(emissive, 0, 0);
    sharpCtx.clearRect(0, 0, width, height);
    sharpCtx.drawImage(emissive, 0, 0);

    // --- Tickers, on their own opaque layer ---------------------------
    tickCtx.clearRect(0, 0, width, height);
    tickCtx.globalCompositeOperation = "source-over";

    const bobFreq = TAU / TICKER_BOB_PERIOD;
    const placed: PlacedTicker[] = [];
    for (const ticker of tickers) {
      const phase = frame + ticker.cycleOffset;
      const cycle = Math.floor(phase / TICKER_PERIOD);
      const local = (phase % TICKER_PERIOD) / TICKER_PERIOD;
      const env =
        local < 0.1
          ? local / 0.1
          : local > 0.86
            ? (1 - local) / 0.14
            : 1;
      if (env <= 0.01) continue;

      const bob = Math.sin(frame * bobFreq + ticker.bobPhase) * 0.006;
      const point = project(
        cam,
        ticker.u,
        ticker.v + bob,
        ticker.elevation,
      );
      if (!point.visible) continue;
      const slack = 260 * geometry.sizeScale;
      if (
        point.x < -slack ||
        point.x > width + slack ||
        point.y < -slack ||
        point.y > height + slack
      ) {
        continue;
      }

      const tick = ticker.fastTick
        ? Math.floor(frame / TICKER_FAST_TICK_FRAMES) % FAST_TICKS_PER_LOOP
        : cycle % TICKER_CYCLES_PER_LOOP;

      placed.push({
        ticker,
        point,
        env: clamp(env, 0, 1),
        value: tickerValue(ticker.seed, tick),
      });
    }

    // Far to near, so a near chip correctly covers one behind it.
    placed.sort((a, b) => b.point.z - a.point.z);
    for (const item of placed) {
      drawTicker(tickCtx, item, theme, geometry.tickerFontSize, accentGlow);
    }
    tickCtx.globalAlpha = 1;
  }, [
    frame,
    emissive,
    geometry,
    width,
    height,
    theme,
    gridDots,
    candles,
    streaks,
    tickers,
    hazeBlobs,
    dotCount,
    dotPhases,
    dotBrightness,
    dotRamp,
    accentRgb,
    accentDim,
    accentGlow,
    coreRgb,
    hazeRgb,
  ]);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      {/* Core glow sitting under the plane, so the map reads as lit from
          within rather than pasted onto flat black. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 55% at 50% 56%, ${rgbaString(
            accentRgb,
            0.1,
          )} 0%, ${rgbaString(accentRgb, 0.03)} 42%, transparent 74%)`,
        }}
      />
      <canvas
        ref={glowRef}
        width={width}
        height={height}
        style={{
          position: "absolute",
          inset: 0,
          filter: `blur(${geometry.blurPx}px)`,
          opacity: 0.8,
          mixBlendMode: "screen",
        }}
      />
      <canvas
        ref={sharpRef}
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, mixBlendMode: "screen" }}
      />
      <canvas
        ref={tickerRef}
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0 }}
      />
      {/* Scanlines, then vignette: cheap screen-capture texture that also
          hides any dot aliasing in the distance. */}
      <AbsoluteFill
        style={{
          background: `repeating-linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0.035) 0px,
            rgba(255, 255, 255, 0.035) ${geometry.sizeScale}px,
            transparent ${geometry.sizeScale}px,
            transparent ${geometry.sizeScale * 3}px
          )`,
          mixBlendMode: "overlay",
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, transparent 42%, ${theme.vignette} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
