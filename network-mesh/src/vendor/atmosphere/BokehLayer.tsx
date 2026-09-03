import React, { useLayoutEffect, useMemo, useRef } from "react";
import { createBuffer } from "../core/canvas";
import { rgba } from "../core/color";
import { rnd, rndRange } from "../core/seeded-random";

export interface BokehLayerProps {
  width: number;
  height: number;
  frame: number;
  duration: number;
  /** Single hue the discs are drawn in. */
  color: string;
  /**
   * "back" discs sit behind the mesh, "front" discs drift over it and
   * partially occlude it. The same seeded field is split between the two.
   */
  pass: "back" | "front";
  count?: number;
}

const TAU = Math.PI * 2;
const SCALE = 0.5;

interface Disc {
  x0: number;
  y0: number;
  radius: number;
  alpha: number;
  ax: number;
  ay: number;
  p1: number;
  p2: number;
  k2: number;
  front: boolean;
}

const buildDiscs = (count: number, width: number, height: number): Disc[] => {
  const discs: Disc[] = [];
  for (let i = 0; i < count; i++) {
    const s = `bokeh-${i}`;
    discs.push({
      x0: rndRange(`${s}-x`, -0.06, 1.06) * width,
      y0: rndRange(`${s}-y`, -0.06, 1.06) * height,
      // Spec sizes are diameters at 4K.
      radius: rndRange(`${s}-r`, 40, 200) / 2,
      alpha: rndRange(`${s}-a`, 0.06, 0.2),
      ax: rndRange(`${s}-ax`, 60, 260),
      ay: rndRange(`${s}-ay`, 50, 210),
      p1: rnd(`${s}-p1`) * TAU,
      p2: rnd(`${s}-p2`) * TAU,
      k2: rnd(`${s}-k2`) < 0.5 ? 2 : 3,
      front: rnd(`${s}-f`) < 0.36,
    });
  }
  return discs;
};

/**
 * <BokehLayer> — soft out-of-focus discs drifting on closed paths, in the palette's hue.
 * Rendered at half resolution and blurred once — they are defocused by
 * definition, so there is nothing to resolve.
 */
export const BokehLayer: React.FC<BokehLayerProps> = ({
  width,
  height,
  frame,
  duration,
  color,
  pass,
  count = 25,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const discs = useMemo(
    () => buildDiscs(count, width, height),
    [count, width, height],
  );
  const buffer = useMemo(
    () => createBuffer(width * SCALE, height * SCALE),
    [width, height],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;
    const out = canvas.getContext("2d");
    const ctx = buffer.getContext("2d");
    if (!out || !ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, buffer.width, buffer.height);
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);

    const t = (frame / duration) * TAU;
    const wantFront = pass === "front";
    for (let i = 0; i < discs.length; i++) {
      const d = discs[i];
      if (d.front !== wantFront) continue;
      const x = d.x0 + d.ax * Math.cos(t + d.p1);
      const y = d.y0 + d.ay * Math.sin(t + d.p1) + d.ay * 0.3 * Math.sin(d.k2 * t + d.p2);
      // Front discs read as a veil over the mesh, so they carry a little
      // more weight than the ones behind it.
      const alpha = d.alpha * (wantFront ? 1.45 : 1);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, d.radius);
      grad.addColorStop(0, rgba(color, alpha * 0.75));
      grad.addColorStop(0.72, rgba(color, alpha * 0.85));
      // A faintly brighter rim is what makes a defocused disc read as bokeh.
      grad.addColorStop(0.9, rgba(color, alpha));
      grad.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, d.radius, 0, TAU);
      ctx.fill();
    }

    out.setTransform(1, 0, 0, 1, 0, 0);
    out.clearRect(0, 0, width, height);
    out.filter = "blur(16px)";
    out.drawImage(buffer, 0, 0, width, height);
    out.filter = "none";
  });

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
};
