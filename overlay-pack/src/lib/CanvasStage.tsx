import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { GREEN } from "../config";

export type DrawInfo = {
  frame: number;
  // Composition size (3840x2160). Draw in these units.
  width: number;
  height: number;
  // Backing-store pixels per composition unit (1/3 for the 720p preview, 1 at 4K).
  pxRatio: number;
};

type Props = {
  background: string;
  draw: (ctx: CanvasRenderingContext2D, info: DrawInfo) => void;
};

export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

// Alpha below LO is dropped, above HI is solid; in between is a short ramp.
// Soft edges (blur, glow, anti-aliasing) blend element colour with the key
// green; tightening them keeps those mixed pixels to about one pixel wide so
// a chroma key leaves no green rim.
const KEY_LO = 0.3;
const KEY_HI = 0.7;
const ALPHA_LUT = (() => {
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    const u = Math.min(1, Math.max(0, (i / 255 - KEY_LO) / (KEY_HI - KEY_LO)));
    lut[i] = Math.round(255 * u * u * (3 - 2 * u));
  }
  return lut;
})();

let layer: HTMLCanvasElement | null = null;
const getLayer = (w: number, h: number) => {
  if (!layer || layer.width !== w || layer.height !== h) layer = makeCanvas(w, h);
  return layer.getContext("2d", { willReadFrequently: true })!;
};

// A full-frame canvas whose backing store matches the output resolution, so a
// --scale render rasterises directly at that size instead of downsampling 4K.
// On the green key colour, elements are drawn to a transparent layer, their
// edges tightened, and only then composited onto #00FF00.
export const CanvasStage: React.FC<Props> = ({ background, draw }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const pxRatio =
    typeof window === "undefined" ? 1 : Math.min(1, window.devicePixelRatio || 1);
  const bw = Math.round(width * pxRatio);
  const bh = Math.round(height * pxRatio);
  const keySafe = background.toUpperCase() === GREEN;

  useLayoutEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, bw, bh);
    const info = { frame, width, height, pxRatio: bw / width };
    if (!keySafe) {
      ctx.setTransform(bw / width, 0, 0, bh / height, 0, 0);
      draw(ctx, info);
      return;
    }
    const l = getLayer(bw, bh);
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalAlpha = 1;
    l.globalCompositeOperation = "source-over";
    l.clearRect(0, 0, bw, bh);
    l.setTransform(bw / width, 0, 0, bh / height, 0, 0);
    draw(l, info);
    l.setTransform(1, 0, 0, 1, 0, 0);
    const img = l.getImageData(0, 0, bw, bh);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) {
      const a = d[i];
      if (a !== 0 && a !== 255) d[i] = ALPHA_LUT[a];
    }
    l.putImageData(img, 0, 0);
    ctx.drawImage(l.canvas, 0, 0);
  }, [frame, width, height, bw, bh, background, draw, keySafe]);

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <canvas ref={ref} width={bw} height={bh} style={{ width, height }} />
    </AbsoluteFill>
  );
};
