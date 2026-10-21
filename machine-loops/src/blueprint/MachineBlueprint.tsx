// White technical line drawing of the beam engine on pure black, drawn with
// Canvas 2D from the SVG part groups in engine.ts.
import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { TAU } from "../lib/random";
import { ENGINE_LOOP, Placed, Stroke, Weight, crankAngle, drawList, pose } from "./engine";

const INK = "#F2F2F2";
// Line weights in output pixels at 4K (scaled down with the output).
const WEIGHT: Record<Weight, number> = { thick: 7.6, mid: 5.6, thin: 4.0, hair: 3.0 };
const VIEW_W = 4300; // model units across the frame at rest (machine overfills)

const STATIC = new Set(["foundation", "entablature", "ladder", "column", "radiusColumn", "cylinder", "valveChest", "airPump", "feedPump", "crankPedestal", "governorStand", "pinionPedestal", "condenser"]);

const cache = new Map<string, Path2D>();
const path = (d: string, dynamic: boolean) => {
  if (dynamic) return new Path2D(d);
  let p = cache.get(d);
  if (!p) {
    p = new Path2D(d);
    cache.set(d, p);
  }
  return p;
};

// Camera: slow pan and slight push, periodic in the 600-frame loop.
export const camera = (frame: number) => {
  const u = (((frame % ENGINE_LOOP) + ENGINE_LOOP) % ENGINE_LOOP) / ENGINE_LOOP;
  return {
    cx: 320 + 1000 * Math.sin(TAU * u),
    cy: -560 + 240 * Math.sin(TAU * 2 * u + 0.6),
    zoom: 1 + 0.08 * (0.5 - 0.5 * Math.cos(TAU * u)),
  };
};

export const MachineBlueprint: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const lineRef = useRef<HTMLCanvasElement | null>(null);
  const dpr = typeof window === "undefined" ? 1 : Math.min(1, window.devicePixelRatio || 1);
  const cw = Math.round(width * dpr);
  const ch = Math.round(height * dpr);

  useLayoutEffect(() => {
    // lines go to an offscreen canvas first, then onto black with a tight bloom
    if (!lineRef.current) {
      lineRef.current = document.createElement("canvas");
      lineRef.current.width = cw;
      lineRef.current.height = ch;
    }
    const ctx = lineRef.current.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    const cam = camera(frame);
    const s = (cw / VIEW_W) * cam.zoom;
    const wa = s;
    const wd = -s;
    const we = cw / 2 - s * cam.cx;
    const wf = ch / 2 + s * cam.cy;
    const ps = pose(crankAngle(frame), frame % ENGINE_LOOP);
    const list: Placed[] = drawList(ps);
    ctx.strokeStyle = INK;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const px = cw / 3840; // output pixels per 4K pixel
    // far layer first (the twin beam plates / far frame, offset by parallax), then the near layer
    for (const layer of [0, 1]) {
    const layerAlpha = layer === 0 ? 0.55 : 1;
    const ox = layer === 0 ? 90 + 0.04 * (cam.cx - 320) : 0;
    const oy = layer === 0 ? 55 : 0;
    for (const { part, xf } of list) {
      // the far layer is the twin frame (static structure only), never the moving parts
      if (layer === 0 && (part.name === "construction" || !STATIC.has(part.name))) continue;
      const c = Math.cos(xf.a);
      const sn = Math.sin(xf.a);
      // world = T(xf) R(a) local; screen = Wm * world
      ctx.setTransform(wa * c, wd * sn, wa * -sn, wd * c, wa * (xf.x + ox) + we, wd * (xf.y + oy) + wf);
      const dynamic = part.name === "governor";
      for (const st of part.strokes as Stroke[]) {
        const lw = (WEIGHT[st.w] * px) / s;
        ctx.lineWidth = lw;
        ctx.globalAlpha = (st.s === "construct" ? 0.9 : 1) * layerAlpha;
        if (st.s === "hidden") ctx.setLineDash([(16 * px) / s, (11 * px) / s]);
        else if (st.s === "center") ctx.setLineDash([(46 * px) / s, (12 * px) / s, (7 * px) / s, (12 * px) / s]);
        else ctx.setLineDash([]);
        ctx.stroke(path(st.d, dynamic));
      }
    }
    }
    ctx.globalAlpha = 1;
    const out = ref.current!.getContext("2d")!;
    out.globalCompositeOperation = "source-over";
    out.filter = "none";
    out.fillStyle = "#000000";
    out.fillRect(0, 0, cw, ch);
    out.globalCompositeOperation = "lighter";
    out.filter = `blur(${(2.4 * cw) / 3840}px)`;
    out.globalAlpha = 0.7;
    out.drawImage(lineRef.current, 0, 0);
    out.filter = "none";
    out.globalAlpha = 1;
    out.drawImage(lineRef.current, 0, 0);
    out.globalCompositeOperation = "source-over";
  }, [frame, cw, ch]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <canvas ref={ref} width={cw} height={ch} style={{ width, height }} />
    </AbsoluteFill>
  );
};
