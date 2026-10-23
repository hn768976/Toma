import { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { MicrobePalette } from "./palettes";
import { cloudTexture, getSpecks, grainTile, scratchCanvas } from "./textures";
import { createWorms, DESIGN_H, DESIGN_W, Worm, wormPath } from "./worms";

export type MicrobeFieldProps = { palette: MicrobePalette };

type Ctx = CanvasRenderingContext2D;

const tracePath = (ctx: Ctx, pts: Float32Array) => {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  // Midpoint quadratic smoothing keeps tight loops round at 4K.
  for (let i = 2; i < pts.length - 2; i += 2) {
    const mx = (pts[i] + pts[i + 2]) / 2;
    const my = (pts[i + 1] + pts[i + 3]) / 2;
    ctx.quadraticCurveTo(pts[i], pts[i + 1], mx, my);
  }
  ctx.lineTo(pts[pts.length - 2], pts[pts.length - 1]);
};

// A filament is drawn as a translucent tube: dark wall, lighter lumen and a
// faint specular line, which reads as the refractive edge seen under a
// brightfield microscope.
const drawWorm = (ctx: Ctx, w: Worm, t: number, p: MicrobePalette, soft: boolean) => {
  const pts = wormPath(w, t);
  tracePath(ctx, pts);
  ctx.strokeStyle = soft ? p.blurredEdge : p.wormEdge;
  ctx.lineWidth = w.width;
  ctx.stroke();
  ctx.strokeStyle = soft ? p.blurredCore : p.wormCore;
  ctx.lineWidth = w.width * 0.5;
  ctx.stroke();
  if (!soft) {
    ctx.strokeStyle = p.wormHighlight;
    ctx.lineWidth = w.width * 0.14;
    ctx.stroke();
  }
};

const setupStroke = (ctx: Ctx) => {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
};

// Draws a set of worms into a reduced-resolution buffer, blurs it there
// (cheap) and composites the result back at full size.
const drawBlurredLayer = (
  ctx: Ctx,
  worms: Worm[],
  t: number,
  p: MicrobePalette,
  camera: (c: Ctx, scale: number) => void,
  blurDesignPx: number,
  key: string,
  composite: GlobalCompositeOperation = "source-over",
  alpha = 1,
  drawFn: (c: Ctx, w: Worm) => void = (c, w) => drawWorm(c, w, t, p, true),
) => {
  const bw = Math.round(ctx.canvas.width / 4);
  const bh = Math.round(ctx.canvas.height / 4);
  const scale = bw / DESIGN_W;
  const src = scratchCanvas(`${key}-src`, bw, bh);
  const dst = scratchCanvas(`${key}-dst`, bw, bh);
  const s = src.getContext("2d")!;
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.clearRect(0, 0, bw, bh);
  camera(s, scale);
  setupStroke(s);
  for (const w of worms) drawFn(s, w);
  const d = dst.getContext("2d")!;
  d.setTransform(1, 0, 0, 1, 0, 0);
  d.clearRect(0, 0, bw, bh);
  d.filter = `blur(${blurDesignPx * scale}px)`;
  d.drawImage(src, 0, 0);
  d.filter = "none";
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = composite;
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(dst, 0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
};

export const MicrobeField: React.FC<MicrobeFieldProps> = ({ palette: p }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worms = useMemo(() => createWorms(7), []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const t = frame / fps;
    const progress = frame / Math.max(1, durationInFrames - 1);
    const S = width / DESIGN_W;

    // Slow microscope-stage drift with a gentle push-in.
    const zoom = 1.03 + 0.035 * progress;
    const panX = -22 * progress + 6 * Math.sin(t * 0.21);
    const panY = 10 * progress + 5 * Math.sin(t * 0.17 + 1.3);
    const camera = (c: Ctx, scale: number) => {
      c.setTransform(scale, 0, 0, scale, 0, 0);
      c.translate(DESIGN_W / 2, DESIGN_H / 2);
      c.scale(zoom, zoom);
      c.translate(-DESIGN_W / 2 + panX, -DESIGN_H / 2 + panY);
    };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = p.background;
    ctx.fillRect(0, 0, width, height);

    // Illumination mottling drifts independently of the specimen.
    const cloud = cloudTexture(p);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const cdx = (Math.sin(t * 0.09) * 40 - t * 3) * S;
    const cdy = (Math.cos(t * 0.07) * 30 - t * 1.5) * S;
    ctx.drawImage(cloud, -120 * S + cdx, -90 * S + cdy, (DESIGN_W + 300) * S, (DESIGN_H + 240) * S);

    // Debris.
    camera(ctx, S);
    for (const sp of getSpecks()) {
      if (sp.soft) continue;
      ctx.fillStyle = p.speck.replace("A", String(sp.a * p.speckAlphaScale));
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
      ctx.fill();
    }
    {
      // Soft dust motes, blurred in the quarter-res buffer.
      const bw = Math.round(width / 4);
      const bh = Math.round(height / 4);
      const scale = bw / DESIGN_W;
      const src = scratchCanvas("motes-src", bw, bh);
      const s = src.getContext("2d")!;
      s.setTransform(1, 0, 0, 1, 0, 0);
      s.clearRect(0, 0, bw, bh);
      s.filter = `blur(${5 * scale}px)`;
      camera(s, scale);
      for (const sp of getSpecks()) {
        if (!sp.soft) continue;
        s.fillStyle = p.speck.replace("A", String(sp.a * p.speckAlphaScale));
        s.beginPath();
        s.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
        s.fill();
      }
      s.filter = "none";
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(src, 0, 0, width, height);
      ctx.restore();
    }

    const behind = worms.filter((w) => w.layer === 1);
    const focal = worms.filter((w) => w.layer === 0);
    const front = worms.filter((w) => w.layer === 2);

    drawBlurredLayer(ctx, behind, t, p, camera, 3.5, "behind");

    camera(ctx, S);
    setupStroke(ctx);
    for (const w of focal) drawWorm(ctx, w, t, p, false);

    if (p.glow) {
      const glow = p.glow;
      drawBlurredLayer(
        ctx,
        focal,
        t,
        p,
        camera,
        glow.blurPx,
        "glow",
        "lighter",
        glow.alpha,
        (c, w) => {
          tracePath(c, wormPath(w, t));
          c.strokeStyle = glow.color;
          c.lineWidth = w.width * 1.4;
          c.stroke();
        },
      );
    }

    drawBlurredLayer(ctx, front, t, p, camera, 9, "front");

    // Optical vignette (fixed to the lens, not the slide).
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const vg = ctx.createRadialGradient(
      width * 0.52,
      height * 0.5,
      height * 0.25,
      width * 0.5,
      height * 0.5,
      width * 0.62,
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, p.vignette);
    ctx.globalAlpha = p.vignetteStrength;
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, width, height);

    // Sensor grain, re-positioned every frame.
    const grain = grainTile();
    const pattern = ctx.createPattern(grain, "repeat")!;
    const gx = (frame * 197) % 512;
    const gy = (frame * 331) % 512;
    ctx.translate(-gx, -gy);
    ctx.globalAlpha = p.grainAlpha;
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = pattern;
    ctx.fillRect(gx, gy, width, height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }, [frame, fps, durationInFrames, width, height, p, worms]);

  return (
    <AbsoluteFill style={{ backgroundColor: p.background }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width, height }} />
    </AbsoluteFill>
  );
};
