import { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { PALETTES, PaletteName, rampTable } from "./palette";
import { buildScene, LOOP, SCENE_H, SCENE_W, Trail, trailState } from "./scene";

const TAU = Math.PI * 2;

export type LightTrailsProps = {
  palette: PaletteName;
};

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

type Layers = {
  core: HTMLCanvasElement; // crisp strokes, full resolution
  soft: HTMLCanvasElement; // out-of-focus streaks/bokeh, half resolution
  glowSmall: HTMLCanvasElement; // quarter resolution
  glowWide: HTMLCanvasElement; // quarter resolution
  mix: HTMLCanvasElement; // full-resolution intensity before colour ramp
};

/**
 * Brightness variation along a stroke: slow variation from the painter's hand
 * speed plus fast bright pulses racing along the strand. Periodic in LOOP.
 */
const alongMod = (s: number, seed: number, t: number) => {
  const pulse = Math.pow(0.5 + 0.5 * Math.sin(s * 2.4 - (TAU * 160 * t) / LOOP + seed), 4);
  return (0.5 + 0.3 * Math.sin(s * 3.1 + seed) * Math.sin(s * 1.3 + seed * 0.7)) + 0.9 * pulse;
};

const strokePartial = (
  ctx: CanvasRenderingContext2D,
  tr: Trail,
  head: number,
  alpha: number,
  widthScale: number,
  alphaScale: number,
  chunk: number,
  t: number,
) => {
  const { points, lengths } = tr;
  const total = lengths[lengths.length - 1];
  const visible = total * head;
  ctx.lineWidth = tr.width * widthScale;
  let i = 0;
  while (i < points.length - 1 && lengths[i] < visible) {
    const end = Math.min(points.length - 1, i + chunk);
    ctx.beginPath();
    ctx.moveTo(points[i].x, points[i].y);
    let j = i + 1;
    for (; j <= end; j++) {
      if (lengths[j] <= visible) {
        ctx.lineTo(points[j].x, points[j].y);
      } else {
        // Interpolate the moving head inside the last segment.
        const a = (visible - lengths[j - 1]) / Math.max(lengths[j] - lengths[j - 1], 1e-6);
        ctx.lineTo(
          points[j - 1].x + (points[j].x - points[j - 1].x) * a,
          points[j - 1].y + (points[j].y - points[j - 1].y) * a,
        );
        break;
      }
    }
    const m = tr.kind === "hero" || tr.kind === "bokeh" ? 1 : alongMod(lengths[i], tr.flickerSeed, t);
    if (tr.kind === "hero") {
      // Taper the streak towards both ends (motion-blurred light source).
      const u = (lengths[i] + lengths[Math.min(j, points.length - 1)]) / 2 / total;
      ctx.lineWidth = tr.width * widthScale * (0.15 + 0.85 * Math.pow(Math.sin(Math.PI * u), 0.6));
    }
    ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, alpha * alphaScale * m)})`;
    ctx.stroke();
    if (j <= end) break;
    i = end;
  }
};

const drawFrame = (
  target: HTMLCanvasElement,
  layers: Layers,
  trails: Trail[],
  t: number,
  filterId: string,
) => {
  const W = target.width;
  const H = target.height;
  const unit = H / SCENE_H;

  // Handheld camera: slow drift + slight rotation of the whole exposure.
  // All terms complete whole cycles over LOOP so the clip loops seamlessly.
  const w = (TAU * t) / LOOP;
  const camX =
    0.22 * Math.sin(w + 0.3) + 0.07 * Math.sin(5 * w + 1.0) + 0.03 * Math.sin(17 * w) +
    0.018 * Math.sin(31 * w + 0.4) + 0.012 * Math.sin(53 * w + 2.2);
  const camY =
    0.14 * Math.sin(2 * w + 2.0) + 0.05 * Math.sin(7 * w) + 0.025 * Math.sin(19 * w + 1.1) +
    0.016 * Math.sin(37 * w + 1.7) + 0.01 * Math.sin(61 * w);
  const camR = 0.025 * Math.sin(w + 0.5) + 0.006 * Math.sin(9 * w);

  const setScene = (ctx: CanvasRenderingContext2D, scale: number) => {
    const u = unit * scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate((W * scale) / 2, (H * scale) / 2);
    ctx.rotate(camR);
    ctx.translate(-((SCENE_W / 2) + camX) * u, -((SCENE_H / 2) + camY) * u);
    ctx.scale(u, u);
  };

  const core = layers.core.getContext("2d")!;
  const soft = layers.soft.getContext("2d")!;
  for (const [ctx, c] of [
    [core, layers.core],
    [soft, layers.soft],
  ] as const) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }
  setScene(core, 1);
  setScene(soft, layers.soft.width / W);

  for (const tr of trails) {
    const st = trailState(tr, t);
    if (!st) continue;
    if (tr.kind === "fine") {
      core.setLineDash(tr.dash > 0 ? [tr.dash * 0.35, tr.dash * 0.65] : []);
      strokePartial(core, tr, st.head, st.alpha, 1, 1, 12, t);
      core.setLineDash([]);
    } else if (tr.kind === "squiggle") {
      strokePartial(core, tr, st.head, st.alpha, 2.6, 0.3, 10, t);
      strokePartial(core, tr, st.head, st.alpha, 1, 0.85, 10, t);
    } else {
      // Thick out-of-focus streaks and bokeh: layered strokes on the soft layer.
      // Concentric strokes build a smooth, peaked cross-section: a gold falloff
      // around a narrow white-hot core (rather than a flat clipped bar).
      const chunk = tr.kind === "hero" ? 3 : 400;
      soft.lineCap = tr.kind === "hero" ? "butt" : "round";
      for (const [w, a] of [
        [1, 0.1],
        [0.78, 0.11],
        [0.58, 0.13],
        [0.4, 0.16],
        [0.25, 0.22],
        [0.12, 0.4],
      ] as const) {
        strokePartial(soft, tr, st.head, st.alpha, w, a, chunk, t);
      }
      soft.lineCap = "round";
    }
  }

  // Glow passes at quarter resolution.
  const gS = layers.glowSmall.getContext("2d")!;
  const gW = layers.glowWide.getContext("2d")!;
  const q = layers.glowSmall.width / W;
  for (const [ctx, blurPx] of [
    [gS, 0.07 * unit],
    [gW, 0.26 * unit],
  ] as const) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.filter = `blur(${blurPx * q}px)`;
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(layers.core, 0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(layers.soft, 0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.filter = "none";
  }

  // Combine intensities.
  const mix = layers.mix.getContext("2d")!;
  mix.setTransform(1, 0, 0, 1, 0, 0);
  mix.globalCompositeOperation = "source-over";
  mix.filter = "none";
  mix.fillStyle = "#000";
  mix.fillRect(0, 0, W, H);
  mix.globalCompositeOperation = "lighter";
  mix.imageSmoothingEnabled = true;
  mix.imageSmoothingQuality = "high";
  mix.globalAlpha = 1.9;
  mix.drawImage(layers.glowWide, 0, 0, W, H);
  mix.globalAlpha = 1;
  mix.drawImage(layers.glowSmall, 0, 0, W, H);
  mix.drawImage(layers.glowSmall, 0, 0, W, H);
  mix.filter = `blur(${0.03 * unit}px)`;
  mix.drawImage(layers.soft, 0, 0, W, H);
  mix.filter = "none";
  mix.drawImage(layers.core, 0, 0);

  // Map intensity -> colour through the palette ramp (SVG feComponentTransfer).
  const out = target.getContext("2d")!;
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.globalCompositeOperation = "source-over";
  out.filter = `url(#${filterId})`;
  out.drawImage(layers.mix, 0, 0);
  out.filter = "none";
};

export const LightTrails: React.FC<LightTrailsProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layersRef = useRef<Layers | null>(null);
  const filterId = `ramp-${palette}`;
  const trails = useMemo(() => buildScene(), []);
  const tables = useMemo(() => rampTable(PALETTES[palette]), [palette]);

  useLayoutEffect(() => {
    layersRef.current = {
      core: makeCanvas(width, height),
      soft: makeCanvas(width / 2, height / 2),
      glowSmall: makeCanvas(width / 4, height / 4),
      glowWide: makeCanvas(width / 4, height / 4),
      mix: makeCanvas(width, height),
    };
    return () => {
      layersRef.current = null;
    };
  }, [width, height]);

  useLayoutEffect(() => {
    if (!canvasRef.current || !layersRef.current) return;
    drawFrame(canvasRef.current, layersRef.current, trails, frame / fps, filterId);
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
        <filter id={filterId} colorInterpolationFilters="sRGB">
          <feComponentTransfer>
            <feFuncR type="table" tableValues={tables.r} />
            <feFuncG type="table" tableValues={tables.g} />
            <feFuncB type="table" tableValues={tables.b} />
          </feComponentTransfer>
        </filter>
      </svg>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
