import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { RIGS, RigName, makeView } from "./camera";
import { InkRenderer, StrandVertex } from "./inkRenderer";
import { V3 } from "./math";
import { PaperLayers, PaperPalette, buildPaper } from "./paper";
import { buildStrands } from "./scene";

/** Strand thickness in world units. */
const STRAND_WIDTH = 0.0066;
const NEAR = 0.12;
/** Peak opacity of an in-focus strand. */
const INK_OPACITY = 0.92;
/** Max vertex spacing along a strand (in frame heights) – keeps DOF smooth. */
const MAX_STEP = 0.008;
/** Largest depth-of-field blur sigma (in frame heights). */
const MAX_SIGMA = 0.045;

type Cache = { key: string; paper: PaperLayers; ink: InkRenderer };

export type StringRibbonsProps = {
  /** camera choreography (props must stay JSON-serialisable for rendering) */
  rig: RigName;
  palette: PaperPalette;
};

const hexToRgb = (h: string): [number, number, number] => {
  const v = parseInt(h.replace("#", ""), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
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
    const cam = RIGS[rig](frame, durationInFrames);
    // a ground-plane paper must cover the frame at any rotation
    const P = cam.groundPaper ? Math.ceil(Math.hypot(W, H)) + 4 : 0;
    const key = `${W}x${H}:${P}:${JSON.stringify(palette)}`;
    if (!cache.current || cache.current.key !== key) {
      cache.current = {
        key,
        paper: P ? buildPaper(P, P, palette, W, H) : buildPaper(W, H, palette),
        ink: new InkRenderer(W, H),
      };
    }
    const { paper, ink } = cache.current;

    const view = makeView(cam);
    const f = cam.focal * H;
    const project = (p: V3): [number, number] => [W / 2 + (f * p[0]) / p[2], H / 2 - (f * p[1]) / p[2]];
    // Gaussian sigma (px) of the depth-of-field blur at camera depth z
    // (capped: beyond ~4.5% of the frame height more blur is indistinguishable
    // and would only cost fill-rate)
    const sigmaAt = (z: number) => Math.min(MAX_SIGMA, cam.aperture * Math.abs(1 / cam.focus - 1 / z)) * H;
    const vertex = (p: V3): StrandVertex => {
      const [x, y] = project(p);
      const s = sigmaAt(p[2]);
      // physically exact: the ink of a defocused strand is spread, not added;
      // dense sheets still read as dark bands through Beer–Lambert absorption
      return { x, y, w: (f * STRAND_WIDTH) / p[2], s };
    };

    const polylines: StrandVertex[][] = [];
    for (const strand of buildStrands(frame)) {
      const cp = strand.map(view.toCam);
      let cur: StrandVertex[] = [];
      const end = () => {
        if (cur.length >= 2) polylines.push(cur);
        cur = [];
      };
      for (let i = 0; i < cp.length - 1; i++) {
        let a = cp[i];
        let b = cp[i + 1];
        if (a[2] < NEAR && b[2] < NEAR) {
          end();
          continue;
        }
        const clippedA = a[2] < NEAR;
        if (a[2] < NEAR || b[2] < NEAR) {
          const t = (NEAR - a[2]) / (b[2] - a[2]);
          const c: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR];
          if (a[2] < NEAR) a = c;
          else b = c;
        }
        if (clippedA) end();
        // subdivide so blur/width are sampled densely (the blur has a kink
        // where the strand crosses the focal plane)
        const [ax, ay] = project(a);
        const [bx, by] = project(b);
        const pieces = Math.min(64, Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (MAX_STEP * H))));
        if (cur.length === 0) cur.push(vertex(a));
        for (let k = 1; k <= pieces; k++) {
          const t = k / pieces;
          cur.push(vertex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]));
        }
        if (b[2] <= NEAR + 1e-9) end();
      }
      end();
    }

    ink.render(polylines, hexToRgb(palette.ink), INK_OPACITY);

    // Paper placement: screen-fixed, or (overhead rig) turned by the on-screen
    // angle of the world x axis so the printed grid rotates under the camera.
    let spin = 0;
    if (P) {
      const c = cam.target;
      const a = view.toCam(c);
      const b = view.toCam([c[0] + 0.5, c[1], c[2]]);
      const [ax, ay] = project(a);
      const [bx, by] = project(b);
      spin = Math.atan2(by - ay, bx - ax);
    }
    const drawPaper = (layer: HTMLCanvasElement) => {
      if (!P) {
        ctx.drawImage(layer, 0, 0);
        return;
      }
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(spin);
      ctx.drawImage(layer, -P / 2, -P / 2);
      ctx.restore();
    };

    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    drawPaper(paper.base);
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(ink.canvas, 0, 0);
    drawPaper(paper.grid);
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.55;
    drawPaper(paper.grunge);
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
