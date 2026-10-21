import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import { GLShader } from "../lib/GLShader";
import { Canvas2D, Draw2D } from "../lib/Canvas2D";
import { useFont } from "../lib/useFont";
import { hash01 } from "../lib/random";
import { VHS_FRAG } from "./shader";
import { trackingAt } from "./tracking";

const vhsUniforms = (frame: number) => {
  const pair = Math.floor(frame / 2) % 300;
  return {
    uTrack: trackingAt(frame),
    uFlicker: 0.93 + 0.14 * hash01(pair, 4242),
  };
};

const TAPE_SOFT: [number, number] = [4.5, 2]; // low luma bandwidth: softer horizontally
export const VHSTape: React.FC = () => <GLShader body={VHS_FRAG} uniforms={vhsUniforms} soft={TAPE_SOFT} />;

// OSD white is #F0F0F0 (summed from the three chroma layers below).
const FONT = "VT323";
const SIZE = 118; // px at 4K: cap height matches the reference OSD

const pad = (n: number) => String(n).padStart(2, "0");
export const timecode = (frame: number, fps = 30) => {
  const s = Math.floor(frame / fps);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
};

/** Draws one OSD layer: the text plus the PLAY triangle. */
const drawOSDText = (ctx: CanvasRenderingContext2D, frame: number, dx: number) => {
  ctx.font = `${SIZE}px ${FONT}`;
  (ctx as unknown as { letterSpacing: string }).letterSpacing = "5px";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("PLAY", 770 + dx, 330);
  const w = ctx.measureText("PLAY").width;
  const tx = 770 + w + 22 + dx;
  ctx.beginPath();
  ctx.moveTo(tx, 330 - 66);
  ctx.lineTo(tx + 50, 330 - 33);
  ctx.lineTo(tx, 330);
  ctx.closePath();
  ctx.fill();
  ctx.fillText("SP", 770 + dx, 1880);
  ctx.fillText(timecode(frame), 2300 + dx, 1880);
};

const drawOSD: Draw2D = (ctx, frame, { k }) => {
  // wide soft bloom, then a tighter glow
  ctx.save();
  ctx.filter = `blur(${(16 * k).toFixed(2)}px)`;
  ctx.fillStyle = "rgba(225,230,255,0.55)";
  drawOSDText(ctx, frame, 0);
  ctx.filter = "none";
  ctx.fillStyle = "rgba(240,240,240,0.35)";
  ctx.shadowColor = "rgba(220,225,255,0.75)";
  ctx.shadowBlur = 26;
  drawOSDText(ctx, frame, 0);
  ctx.restore();
  // chroma: red shifted left, blue right (3px at 4K = 1px at 720p), summed
  // VCR character generators are soft: a slight blur on the text itself
  ctx.filter = `blur(${(5 * k).toFixed(2)}px)`; // filter radius is in backing pixels
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = "rgb(240,0,0)";
  drawOSDText(ctx, frame, -3);
  ctx.fillStyle = "rgb(0,240,0)";
  drawOSDText(ctx, frame, 0);
  ctx.fillStyle = "rgb(0,0,240)";
  drawOSDText(ctx, frame, 3);
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
};

export const VHSPlayback_Clean: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <VHSTape />
  </AbsoluteFill>
);

export const VHSPlayback_OSD: React.FC = () => {
  const ready = useFont(FONT, "fonts/VT323-Regular.woff2");
  const draw = useCallback<Draw2D>((ctx, frame, s) => drawOSD(ctx, frame, s), []);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <VHSTape />
      <Canvas2D draw={draw} ready={ready} style={{ mixBlendMode: "screen" }} />
    </AbsoluteFill>
  );
};

