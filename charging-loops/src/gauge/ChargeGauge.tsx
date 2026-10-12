import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ChargeGaugeRow } from "../versions";
import { drawGauge, FONT, PH, PW } from "./draw";

// Look 5: flat Canvas 2D HUD on a CSS 3D-tilted plane, with a masked blurred
// copy for the far-side depth of field, over a background canvas that carries
// the radial lift, dither and grain (all hashed from pixel + frame % 300).

let fontPromise: Promise<void> | null = null;
const loadFont = () => {
  if (!fontPromise) {
    const face = new FontFace(FONT, `url(${staticFile("fonts/Exo2-SemiBold.woff2")}) format("woff2")`, {
      weight: "600",
    });
    fontPromise = face.load().then((f) => {
      document.fonts.add(f);
    });
  }
  return fontPromise;
};

// Plane shown at 1.35x its design size (3240 x 2160 CSS px in a 3840 x 2160 frame).
const PLANE_SCALE = 1.35;
const CSS_W = PW * PLANE_SCALE;
const CSS_H = PH * PLANE_SCALE;

const hash = (x: number, y: number, f: number) => {
  let h = (Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(f + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const drawBackground = (c: HTMLCanvasElement, frame: number) => {
  const ctx = c.getContext("2d")!;
  const w = c.width;
  const h = c.height;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const f = frame % 300;
  // #04080E plus a faint radial lift behind the dial (centre ~ 42 %, 50 %)
  const cx = 0.42 * w;
  const cy = 0.5 * h;
  const rr = 0.55 * h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / rr;
      const dy = (y - cy) / rr;
      const r2 = dx * dx + dy * dy;
      const lift = Math.exp(-r2 * 1.2);
      const n1 = hash(x, y, f);
      const n2 = hash(x + 7919, y + 104729, f);
      const dither = n1 + n2 - 1; // triangular, +/-1 LSB
      const grain = (hash(x + 31, y + 17, f + 300) - 0.5) * 2 * 0.015 * 255 * 0.5;
      const i = (y * w + x) * 4;
      d[i] = 4 + 6 * lift + dither + grain;
      d[i + 1] = 8 + 14 * lift + dither + grain;
      d[i + 2] = 14 + 26 * lift + dither + grain;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
};

// Fine grain over the artwork: a hashed noise canvas in overlay mode.
const drawGrain = (c: HTMLCanvasElement, frame: number) => {
  const ctx = c.getContext("2d")!;
  const w = c.width;
  const h = c.height;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const f = frame % 300;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = 128 + (hash(x + 101, y + 211, f) - 0.5) * 2 * 0.015 * 255;
      const i = (y * w + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
};

export const ChargeGauge: React.FC<{ row: ChargeGaugeRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const [handle] = useState(() => delayRender("Loading Exo 2"));
  const [ready, setReady] = useState(false);
  const sharp = useRef<HTMLCanvasElement>(null);
  const soft = useRef<HTMLCanvasElement>(null);
  const bg = useRef<HTMLCanvasElement>(null);
  const grain = useRef<HTMLCanvasElement>(null);
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;

  useEffect(() => {
    loadFont()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [handle]);

  useLayoutEffect(() => {
    if (!ready) return;
    const s = sharp.current!;
    const ctx = s.getContext("2d")!;
    ctx.setTransform(s.width / PW, 0, 0, s.height / PH, 0, 0);
    drawGauge(ctx, row, frame);
    const sc = soft.current!.getContext("2d")!;
    sc.clearRect(0, 0, s.width, s.height);
    sc.drawImage(s, 0, 0);
    drawBackground(bg.current!, frame);
    drawGrain(grain.current!, frame);
  }, [frame, ready, row]);

  // camera drift: rotateY -28 -> -22 deg and a slight push in
  const t = frame / 299;
  const e = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, t));
  const rotY = -28 + 6 * e;
  const push = 1 + 0.05 * e;
  const planeStyle: React.CSSProperties = {
    position: "absolute",
    left: (width - CSS_W) / 2 - 140,
    top: (height - CSS_H) / 2,
    width: CSS_W,
    height: CSS_H,
  };
  const bw = Math.round(CSS_W * dpr);
  const bh = Math.round(CSS_H * dpr);
  const fw = Math.round(width * dpr);
  const fh = Math.round(height * dpr);

  return (
    <AbsoluteFill style={{ backgroundColor: "#04080E" }}>
      <canvas ref={bg} width={fw} height={fh} style={{ position: "absolute", width, height }} />
      {/* perspective 1600 px at 1080p scale = 3200 px in this 4K layout */}
      <AbsoluteFill style={{ perspective: 3200, perspectiveOrigin: "45% 50%" }}>
        <div
          style={{
            ...planeStyle,
            transformStyle: "preserve-3d",
            transform: `scale(${push}) rotateY(${rotY}deg) rotateX(8deg)`,
          }}
        >
          <canvas
            ref={sharp}
            width={bw}
            height={bh}
            style={{
              position: "absolute",
              width: CSS_W,
              height: CSS_H,
              WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 72%)",
              maskImage: "linear-gradient(to right, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 72%)",
            }}
          />
          {/* depth of field: blurred copy, faded in toward the far (right) side */}
          <canvas
            ref={soft}
            width={bw}
            height={bh}
            style={{
              position: "absolute",
              width: CSS_W,
              height: CSS_H,
              filter: "blur(6px)",
              WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,0) 30%, rgba(0,0,0,1) 72%)",
              maskImage: "linear-gradient(to right, rgba(0,0,0,0) 30%, rgba(0,0,0,1) 72%)",
            }}
          />
        </div>
      </AbsoluteFill>
      <canvas
        ref={grain}
        width={fw}
        height={fh}
        style={{ position: "absolute", width, height, mixBlendMode: "overlay" }}
      />
    </AbsoluteFill>
  );
};
