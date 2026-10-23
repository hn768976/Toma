import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useCanvasAssets } from "../shared/useCanvasAssets";
import { mulberry32, noise1, range } from "../shared/random";
import { PALETTES, PaletteName } from "./palettes";
import { BLUR_LEVELS, GLYPH_WEIGHTS, SpriteSet, buildSprites } from "./sprites";
import { buildBurn, buildGrain, buildPaper } from "./backdrop";

type Layer = "far" | "mid" | "near";

type Note = {
  layer: Layer;
  glyph: number;
  x: number; // 4K px
  y: number;
  s: number; // staff space in 4K px
  rot: number;
  birth: number; // seconds
  life: number;
  fadeIn: number;
  fadeOut: number;
  vx: number;
  vy: number;
  alpha: number;
  blurFrom: number; // blur level at birth (fractional index into BLUR_LEVELS)
  blurTo: number;
  echo: { dx: number; dy: number } | null;
};

const LAYERS: Record<Layer, {
  rate: number; s: [number, number]; life: [number, number]; alpha: number;
  blur: [number, number]; drift: number; parallax: number;
}> = {
  far: { rate: 4, s: [30, 46], life: [2.2, 4.0], alpha: 0.5, blur: [1.4, 2.2], drift: 10, parallax: 0.5 },
  mid: { rate: 10, s: [56, 84], life: [1.9, 3.6], alpha: 0.96, blur: [0, 0.6], drift: 18, parallax: 1 },
  near: { rate: 2.2, s: [110, 170], life: [2.2, 4.2], alpha: 0.42, blur: [3, 4], drift: 70, parallax: 1.8 },
};

const pickWeighted = (r: number) => {
  const total = GLYPH_WEIGHTS.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let i = 0; i < GLYPH_WEIGHTS.length; i++) {
    acc += GLYPH_WEIGHTS[i] / total;
    if (r <= acc) return i;
  }
  return GLYPH_WEIGHTS.length - 1;
};

const scheduleNotes = (duration: number, W: number, H: number, seed: number): Note[] => {
  const rng = mulberry32(seed);
  const notes: Note[] = [];
  for (const layer of ["far", "mid", "near"] as Layer[]) {
    const cfg = LAYERS[layer];
    const count = Math.round(cfg.rate * (duration + 4));
    for (let i = 0; i < count; i++) {
      // Stratified birth times keep density even across the clip.
      const birth = -4 + ((i + rng()) / count) * (duration + 4);
      const focusPull = layer === "mid" && rng() < 0.35;
      const blurBase = range(rng, cfg.blur[0], cfg.blur[1]);
      const s = range(rng, cfg.s[0], cfg.s[1]);
      notes.push({
        layer,
        glyph: pickWeighted(rng()),
        x: range(rng, -0.04, 1.04) * W,
        y: range(rng, -0.04, 1.04) * H,
        s,
        rot: range(rng, -0.12, 0.12),
        birth,
        life: range(rng, cfg.life[0], cfg.life[1]),
        fadeIn: range(rng, 0.35, 0.75),
        fadeOut: range(rng, 0.45, 0.9),
        vx: range(rng, -1, 1) * cfg.drift,
        vy: range(rng, -0.4, 1) * cfg.drift,
        alpha: cfg.alpha * range(rng, 0.75, 1),
        blurFrom: focusPull ? range(rng, 2.2, 3.2) : blurBase,
        blurTo: blurBase,
        echo:
          layer !== "far" && rng() < 0.38
            ? { dx: range(rng, -1.6, 1.6) * s, dy: range(rng, -1.2, 1.2) * s }
            : null,
      });
    }
  }
  const order: Record<Layer, number> = { far: 0, mid: 1, near: 2 };
  return notes.sort((a, b) => order[a.layer] - order[b.layer]);
};

type Assets = {
  dpr: number;
  paper: HTMLCanvasElement;
  burnA: HTMLCanvasElement;
  burnB: HTMLCanvasElement;
  grain: HTMLCanvasElement;
  sprites: SpriteSet;
};

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

const drawSprite = (
  ctx: CanvasRenderingContext2D,
  sprites: SpriteSet,
  glyph: number,
  blurLevel: number,
  x: number,
  y: number,
  scale: number,
  rot: number,
  alpha: number,
) => {
  // Cross-fade between the two nearest pre-blurred sprites.
  const lv = Math.min(BLUR_LEVELS.length - 1, Math.max(0, blurLevel));
  const i0 = Math.floor(lv);
  const i1 = Math.min(BLUR_LEVELS.length - 1, i0 + 1);
  const f = lv - i0;
  const size = sprites.size * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (1 - f > 0.001) {
    ctx.globalAlpha = alpha * (1 - f);
    ctx.drawImage(sprites.canvases[glyph][i0], -size / 2, -size / 2, size, size);
  }
  if (f > 0.001) {
    ctx.globalAlpha = alpha * f;
    ctx.drawImage(sprites.canvases[glyph][i1], -size / 2, -size / 2, size, size);
  }
  ctx.restore();
};

export const FloatingNotes: React.FC<{ palette: PaletteName }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pal = PALETTES[palette];

  const assets = useCanvasAssets<Assets>(() => {
    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    const bw = W * dpr;
    const bh = H * dpr;
    return {
      dpr,
      paper: buildPaper(pal, bw * 1.1, bh * 1.1, dpr * 1.1, 202),
      burnA: buildBurn(pal, bw, bh, dpr, 31),
      burnB: buildBurn(pal, bw, bh, dpr, 57),
      grain: buildGrain(512, 9),
      sprites: buildSprites(pal.ink),
    };
  }, `floating-notes-${palette}`);

  const duration = durationInFrames / fps;
  const notes = useMemo(() => scheduleNotes(duration, W, H, 1641769), [duration, W, H]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!assets || !canvas) return;
    const ctx = canvas.getContext("2d")!;
    const { dpr, sprites } = assets;
    const t = frame / fps;
    const p = t / duration;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Slow camera drift: gentle push-in with a lazy sideways float.
    const camZoom = 1 + 0.045 * p;
    const camX = (noise1(t * 0.15, 3) - 0.5) * 60 + p * 40;
    const camY = (noise1(t * 0.12, 7) - 0.5) * 40;

    // Paper (furthest plane, weakest parallax).
    const pw = assets.paper.width;
    const ph = assets.paper.height;
    const pz = 1 + 0.02 * p;
    ctx.drawImage(
      assets.paper,
      (canvas.width - pw * pz) / 2 - camX * 0.3 * dpr,
      (canvas.height - ph * pz) / 2 - camY * 0.3 * dpr,
      pw * pz,
      ph * pz,
    );

    ctx.scale(dpr, dpr);
    for (const n of notes) {
      const age = t - n.birth;
      if (age < 0 || age > n.life) continue;
      const fade = smooth(age / n.fadeIn) * smooth((n.life - age) / n.fadeOut);
      if (fade <= 0.002) continue;
      const cfg = LAYERS[n.layer];
      const z = 1 + (camZoom - 1) * cfg.parallax;
      const nx = (n.x + n.vx * age - W / 2) * z + W / 2 - camX * cfg.parallax;
      const ny = (n.y + n.vy * age - H / 2) * z + H / 2 - camY * cfg.parallax;
      const scale = ((n.s * z) / 56) * (1 + 0.04 * (age / n.life));
      const blur = n.blurFrom + (n.blurTo - n.blurFrom) * smooth(age / (n.fadeIn * 2.2));
      if (n.echo) {
        const conv = 0.35 + 0.65 * (1 - smooth(age / (n.life * 0.6)));
        drawSprite(ctx, sprites, n.glyph, Math.min(4, blur + 1.6), nx + n.echo.dx * conv, ny + n.echo.dy * conv, scale * 1.04, n.rot, n.alpha * fade * 0.4);
      }
      drawSprite(ctx, sprites, n.glyph, blur, nx, ny, scale, n.rot, n.alpha * fade);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;

    // Film grain.
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.09;
    const pattern = ctx.createPattern(assets.grain, "repeat")!;
    const gr = mulberry32(frame * 7919 + 13);
    ctx.save();
    ctx.translate(-gr() * 512, -gr() * 512);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, canvas.width + 512, canvas.height + 512);
    ctx.restore();

    // Breathing burnt vignette (two irregular layers cross-faded and drifting).
    ctx.globalCompositeOperation = "source-over";
    const mixAB = 0.5 + 0.5 * Math.sin(t * 0.55);
    const breathe = 1.05 + 0.025 * Math.sin(t * 0.9 + 1.3);
    const bw = canvas.width * breathe;
    const bh = canvas.height * breathe;
    const ox = (canvas.width - bw) / 2 + (noise1(t * 0.3, 11) - 0.5) * 40 * dpr;
    const oy = (canvas.height - bh) / 2 + (noise1(t * 0.3, 19) - 0.5) * 30 * dpr;
    ctx.globalAlpha = 1 - mixAB * 0.6;
    ctx.drawImage(assets.burnA, ox, oy, bw, bh);
    ctx.globalAlpha = 0.4 + mixAB * 0.6;
    ctx.drawImage(assets.burnB, ox, oy, bw, bh);

    // Old-projector flicker.
    const flick = (noise1(t * 9, 5) - 0.5) * 0.06 + (noise1(t * 23, 8) - 0.5) * 0.03;
    if (flick > 0) {
      ctx.globalCompositeOperation = "soft-light";
      ctx.globalAlpha = flick * 2;
      ctx.fillStyle = `rgb(${pal.flickerTint.join(",")})`;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = -flick;
      ctx.fillStyle = "#000";
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }, [assets, duration, fps, frame, H, notes, pal, W]);

  const dpr = assets?.dpr ?? 1;
  return (
    <AbsoluteFill style={{ backgroundColor: `rgb(${pal.burn.join(",")})` }}>
      <canvas
        ref={canvasRef}
        width={Math.round(W * dpr)}
        height={Math.round(H * dpr)}
        style={{ width: W, height: H }}
      />
    </AbsoluteFill>
  );
};
