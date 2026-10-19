import React, { useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Compositor } from "./compositor";

const imageCache = new Map<string, Promise<HTMLImageElement>>();
export const loadImage = (path: string) => {
  const url = staticFile(path);
  if (!imageCache.has(url)) {
    imageCache.set(
      url,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => img.decode().then(() => resolve(img), () => resolve(img));
        img.onerror = () => reject(new Error(`Could not load ${url}`));
        img.src = url;
      }),
    );
  }
  return imageCache.get(url)!;
};

const jsonCache = new Map<string, Promise<unknown>>();
export const loadJson = <T,>(path: string): Promise<T> => {
  const url = staticFile(path);
  if (!jsonCache.has(url)) jsonCache.set(url, fetch(url).then((r) => r.json()));
  return jsonCache.get(url)! as Promise<T>;
};

export type FrameContext = {
  comp: Compositor;
  frame: number;
  /** device pixels per comp pixel (1 at full size, 1/3 for 720p previews of 4K comps) */
  scale: number;
  width: number;
  height: number;
};

export type StageProps = {
  sceneSrc: string;
  images?: Record<string, string>;
  imageArrays?: Record<string, string[]>;
  paper?: { margin?: number; seed?: number; fibre?: number };
  /** async work (data loading etc.) that must finish before the first frame */
  prepare?: () => Promise<void>;
  onFrame: (ctx: FrameContext) => void;
};

/**
 * Hosts one Compositor. Painted layers, data and the baked paper are loaded
 * once behind delayRender; afterwards every frame is a pure function of
 * useCurrentFrame() drawn synchronously in a layout effect.
 */
export const Stage: React.FC<StageProps> = ({ sceneSrc, images = {}, imageArrays = {}, paper, prepare, onFrame }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compRef = useRef<Compositor | null>(null);
  const [ready, setReady] = useState(false);
  const released = useRef(false);
  const [handle] = useState(() => delayRender("Loading painted layers", { timeoutInMilliseconds: 600_000 }));

  // devicePixelRatio is Remotion's --scale; render the canvas at the
  // output resolution instead of rendering 4K and letting Chrome downscale.
  const dpr = typeof window === "undefined" ? 1 : Math.min(1, window.devicePixelRatio || 1);
  const pw = Math.round(W * dpr);
  const ph = Math.round(H * dpr);

  useLayoutEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current!;
    canvas.width = pw;
    canvas.height = ph;
    const run = async () => {
      const entries = Object.entries(images);
      const loaded = await Promise.all(entries.map(([, p]) => loadImage(p)));
      const arrays = Object.entries(imageArrays);
      const loadedArrays = await Promise.all(arrays.map(([, ps]) => Promise.all(ps.map(loadImage))));
      if (prepare) await prepare();
      if (cancelled) return;
      const comp = new Compositor(canvas, [W, H], sceneSrc, {
        paperMargin: paper?.margin,
        paperSeed: paper?.seed,
        fibre: paper?.fibre,
      });
      entries.forEach(([name], i) => comp.addImage(name, loaded[i]));
      arrays.forEach(([name], i) => {
        const imgs = loadedArrays[i];
        comp.addImageArray(name, imgs, imgs[0].naturalWidth, imgs[0].naturalHeight);
      });
      compRef.current = comp;
      setReady(true);
    };
    run().catch((e) => {
      console.error(e);
      throw e;
    });
    return () => {
      cancelled = true;
    };
    // mount once: everything above is static for a composition
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!ready || !compRef.current) return;
    onFrame({ comp: compRef.current, frame, scale: pw / W, width: pw, height: ph });
    if (!released.current) {
      released.current = true;
      continueRender(handle);
    }
  }, [ready, frame, onFrame, handle, pw, ph, W]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </AbsoluteFill>
  );
};

/** Offscreen 2D canvas cache for Rough.js layers, sized in device pixels. */
export const useOverlay = () => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  return (w: number, h: number) => {
    if (!ref.current) ref.current = document.createElement("canvas");
    const c = ref.current;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    return c;
  };
};
