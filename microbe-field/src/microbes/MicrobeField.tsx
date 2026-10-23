import { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { MicrobePalette } from "./palettes";
import { cloudTexture, getSpecks, grainTile, scratchCanvas } from "./textures";
import { createWorms, DESIGN_H, DESIGN_W, Worm, wormPath } from "./worms";

export type MicrobeFieldProps = { palette: MicrobePalette };

type Ctx = CanvasRenderingContext2D;

// Each filament is stroked in short chunks so its width can taper towards
// the ends and swell slightly along its length, like a real organism.
const CHUNKS = 14;

const widthAt = (w: Worm, s: number) =>
  w.width *
  (0.5 + 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, s))), 0.45)) *
  (1 + 0.13 * Math.sin(s * 9 + w.phase * 3));

const strokeTapered = (ctx: Ctx, pts: Float32Array, w: Worm, scale: number) => {
  const n = pts.length / 2;
  const per = Math.ceil((n - 1) / CHUNKS);
  for (let c = 0; c < n - 1; c += per) {
    const end = Math.min(n - 1, c + per);
    ctx.beginPath();
    ctx.moveTo(pts[c * 2], pts[c * 2 + 1]);
    for (let i = c + 1; i <= end; i++) ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
    ctx.lineWidth = widthAt(w, (c + end) / 2 / (n - 1)) * scale;
    ctx.stroke();
  }
};

// A filament reads as a translucent tube: a darker wall, a lighter lumen and
// a faint refractive highlight. Walls of the whole filament are drawn before
// its lumen so chunk joints never show.
const drawWorm = (ctx: Ctx, w: Worm, cycle: number, p: MicrobePalette, soft: boolean) => {
  const pts = wormPath(w, cycle);
  ctx.strokeStyle = soft ? p.blurredEdge : p.wormEdge;
  strokeTapered(ctx, pts, w, 1);
  ctx.strokeStyle = soft ? p.blurredCore : p.wormCore;
  strokeTapered(ctx, pts, w, 0.55);
  if (!soft) {
    ctx.strokeStyle = p.wormHighlight;
    strokeTapered(ctx, pts, w, 0.16);
  }
};

const setupStroke = (ctx: Ctx) => {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
};

// Draws into a reduced-resolution buffer, blurs it there (cheap) and
// composites the result back at full size.
const drawLayer = (
  ctx: Ctx,
  divisor: number,
  blurDesignPx: number,
  key: string,
  camera: (c: Ctx, scale: number) => void,
  draw: (c: Ctx) => void,
  composite: GlobalCompositeOperation = "source-over",
  alpha = 1,
) => {
  const bw = Math.round(ctx.canvas.width / divisor);
  const bh = Math.round(ctx.canvas.height / divisor);
  const scale = bw / DESIGN_W;
  const src = scratchCanvas(`${key}-src`, bw, bh);
  const dst = scratchCanvas(`${key}-dst`, bw, bh);
  const s = src.getContext("2d")!;
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.clearRect(0, 0, bw, bh);
  camera(s, scale);
  setupStroke(s);
  draw(s);
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
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(dst, 0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
};

export const MicrobeField: React.FC<MicrobeFieldProps> = ({ palette: p }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worms = useMemo(() => createWorms(7), []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    // One full cycle over the clip: frame N would equal frame 0, so the
    // video loops seamlessly.
    const cycle = (frame / durationInFrames) * Math.PI * 2;
    const S = width / DESIGN_W;

    // Gentle, periodic microscope-stage drift and focus breathing.
    const zoom = 1.045 + 0.012 * Math.sin(cycle);
    const panX = 16 * Math.sin(cycle + 0.4);
    const panY = 9 * Math.sin(cycle * 2 + 1.3);
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
    const cdx = (Math.sin(cycle) * 60) * S;
    const cdy = (Math.cos(cycle) * 35) * S;
    ctx.drawImage(cloud, -120 * S + cdx, -90 * S + cdy, (DESIGN_W + 300) * S, (DESIGN_H + 240) * S);

    // Fine debris.
    camera(ctx, S);
    for (const sp of getSpecks()) {
      if (sp.soft) continue;
      ctx.fillStyle = p.speck.replace("A", String(sp.a * p.speckAlphaScale));
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Soft dust motes.
    drawLayer(ctx, 4, 5, "motes", camera, (c) => {
      for (const sp of getSpecks()) {
        if (!sp.soft) continue;
        c.fillStyle = p.speck.replace("A", String(sp.a * p.speckAlphaScale));
        c.beginPath();
        c.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
        c.fill();
      }
    });

    const behind = worms.filter((w) => w.layer === 1);
    const focal = worms.filter((w) => w.layer === 0);
    const front = worms.filter((w) => w.layer === 2);

    drawLayer(ctx, 4, 2.5, "behind", camera, (c) => {
      for (const w of behind) drawWorm(c, w, cycle, p, true);
    });

    // In-focus filaments: drawn at half resolution with a slight blur and
    // composited translucently, matching the soft optics of the reference.
    drawLayer(
      ctx,
      2,
      1.3,
      "focal",
      camera,
      (c) => {
        for (const w of focal) drawWorm(c, w, cycle, p, false);
      },
      "source-over",
      p.wormOpacity,
    );

    if (p.glow) {
      const glow = p.glow;
      drawLayer(
        ctx,
        4,
        glow.blurPx,
        "glow",
        camera,
        (c) => {
          c.strokeStyle = glow.color;
          for (const w of focal) strokeTapered(c, wormPath(w, cycle), w, 1.4);
        },
        "lighter",
        glow.alpha,
      );
    }

    drawLayer(ctx, 4, 6, "front", camera, (c) => {
      for (const w of front) drawWorm(c, w, cycle, p, true);
    });

    // Optical vignette (fixed to the lens, not the slide).
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Off-centre, as in the reference, where the left corners fall off more.
    const vg = ctx.createRadialGradient(
      width * 0.56,
      height * 0.47,
      height * 0.28,
      width * 0.56,
      height * 0.47,
      width * 0.6,
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, p.vignette);
    ctx.globalAlpha = p.vignetteStrength;
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, width, height);

    // Slow lamp flicker/drift of overall illumination (about ±4 levels),
    // periodic over the clip.
    const lamp = 0.6 * Math.sin(cycle * 2 + 0.5) + 0.4 * Math.sin(cycle * 3 + 2.1);
    ctx.globalAlpha = Math.abs(lamp) * 0.03;
    ctx.fillStyle = lamp > 0 ? "#ffffff" : "#000000";
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
  }, [frame, durationInFrames, width, height, p, worms]);

  return (
    <AbsoluteFill style={{ backgroundColor: p.background }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width, height }} />
    </AbsoluteFill>
  );
};
