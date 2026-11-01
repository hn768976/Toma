import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { RIGS, RigName, makeView } from "./camera";
import { V3 } from "./math";
import { PaperLayers, PaperPalette, buildPaper } from "./paper";
import { buildStrands } from "./scene";

/** Blur levels (Gaussian sigma as a fraction of the frame height). */
const BINS = [0, 0.0012, 0.0026, 0.0045, 0.007, 0.0105, 0.015, 0.021, 0.029, 0.04];
/** Strand thickness in world units. */
const STRAND_WIDTH = 0.0085;
const NEAR = 0.12;
/** Opacity of each ink layer – overlapping sheets darken like real ink. */
const INK_OPACITY = 0.82;

type Cache = {
  key: string;
  paper: PaperLayers;
  layers: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; down: number }[];
};

export type StringRibbonsProps = {
  /** camera choreography (props must stay JSON-serialisable for rendering) */
  rig: RigName;
  palette: PaperPalette;
};

export const StringRibbons: React.FC<StringRibbonsProps> = ({ rig, palette }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cache = useRef<Cache | null>(null);
  // Everything is drawn in resolution-independent units, so the backing store
  // follows the output resolution: a full render paints all 3840x2160 pixels,
  // `--scale=0.5` paints natively at 1920x1080.
  const dpr = typeof window === "undefined" ? 1 : Math.min(1, window.devicePixelRatio || 1);
  const W = Math.round(width * dpr);
  const H = Math.round(height * dpr);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const key = `${W}x${H}:${JSON.stringify(palette)}`;
    if (!cache.current || cache.current.key !== key) {
      cache.current = {
        key,
        paper: buildPaper(W, H, palette),
        layers: BINS.map((s) => {
          // heavily blurred layers can be drawn at reduced resolution
          const down = s * H >= 18 ? 4 : s * H >= 7 ? 2 : 1;
          const c = document.createElement("canvas");
          c.width = Math.ceil(W / down);
          c.height = Math.ceil(H / down);
          const ctx = c.getContext("2d")!;
          return { canvas: c, ctx, down };
        }),
      };
    }
    const { paper, layers } = cache.current;
    for (const l of layers) {
      l.ctx.setTransform(1, 0, 0, 1, 0, 0);
      l.ctx.clearRect(0, 0, l.canvas.width, l.canvas.height);
      l.ctx.setTransform(1 / l.down, 0, 0, 1 / l.down, 0, 0);
      l.ctx.strokeStyle = palette.ink;
      // butt caps: consecutive runs of a strand that land in different blur
      // layers must not overlap, otherwise the joints show up as dark dashes
      l.ctx.lineCap = "butt";
      l.ctx.lineJoin = "round";
    }

    const cam = RIGS[rig](frame, durationInFrames);
    const view = makeView(cam);
    const f = cam.focal * H;
    const project = (p: V3): [number, number] => [W / 2 + (f * p[0]) / p[2], H / 2 - (f * p[1]) / p[2]];
    const cocOf = (z: number) => cam.aperture * Math.abs(1 / cam.focus - 1 / z);
    const binOf = (sigma: number) => {
      let best = 0;
      for (let i = 1; i < BINS.length; i++) if (Math.abs(BINS[i] - sigma) < Math.abs(BINS[best] - sigma)) best = i;
      return best;
    };
    const margin = H * 0.1;

    for (const strand of buildStrands(frame)) {
      const cp = strand.map(view.toCam);
      let runBin = -1;
      let runWidth = 0;
      let runN = 0;
      let path: Path2D | null = null;
      const flush = () => {
        if (path && runBin >= 0) {
          const ctx = layers[runBin].ctx;
          // defocused strands are drawn a little fatter so the out-of-focus
          // sheets read as the dense dark bands seen in the reference
          ctx.lineWidth = Math.max(0.8, runWidth / runN) * (1 + runBin * 0.16);
          ctx.globalAlpha = 1;
          ctx.stroke(path);
        }
        path = null;
        runBin = -1;
        runWidth = 0;
        runN = 0;
      };
      for (let i = 0; i < cp.length - 1; i++) {
        let a = cp[i];
        let b = cp[i + 1];
        if (a[2] < NEAR && b[2] < NEAR) {
          flush();
          continue;
        }
        // clip against the near plane
        if (a[2] < NEAR || b[2] < NEAR) {
          const t = (NEAR - a[2]) / (b[2] - a[2]);
          const c: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR];
          if (a[2] < NEAR) a = c;
          else b = c;
        }
        const pa = project(a);
        const pb = project(b);
        if (
          (pa[0] < -margin && pb[0] < -margin) || (pa[0] > W + margin && pb[0] > W + margin) ||
          (pa[1] < -margin && pb[1] < -margin) || (pa[1] > H + margin && pb[1] > H + margin)
        ) {
          flush();
          continue;
        }
        const zm = (a[2] + b[2]) / 2;
        const bin = binOf(cocOf(zm));
        const wpx = (f * STRAND_WIDTH) / zm;
        if (bin !== runBin) {
          flush();
          runBin = bin;
          path = new Path2D();
          path.moveTo(pa[0], pa[1]);
        }
        path!.lineTo(pb[0], pb[1]);
        runWidth += wpx;
        runN++;
      }
      flush();
    }

    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.drawImage(paper.base, 0, 0);
    // ink layers, sharpest last so in-focus strands sit crisply on top
    for (let i = layers.length - 1; i >= 0; i--) {
      const sigma = BINS[i] * H;
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = INK_OPACITY;
      ctx.filter = sigma > 0.3 ? `blur(${sigma.toFixed(2)}px)` : "none";
      ctx.drawImage(layers[i].canvas, 0, 0, W, H);
      ctx.restore();
    }
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(paper.grid, 0, 0);
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.3;
    ctx.drawImage(paper.grunge, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(paper.vignette, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }, [frame, W, H, rig, palette, durationInFrames]);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.paper }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
