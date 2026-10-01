import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  AXIAL_TILT,
  DESIGN_WIDTH,
  ROTATION_SPEED,
  SPHERE_CENTER_X,
  SPHERE_CENTER_Y,
  SPHERE_RADIUS,
  type Palette,
} from "./constants";
import { generateDots, generateStrands, tangleAmount } from "./geometry";

// Depth is quantised into this many alpha levels so each level can be
// drawn as a single path + stroke() — thousands of segments per frame
// stay fast even at 4K.
const DEPTH_LEVELS = 10;
const CAMERA_DISTANCE = 4.2; // in sphere radii; mild perspective

type Props = { palette: Palette };

// The rotating "ball of data": dots on a sphere whose connecting strands
// stretch into a long looping tangle mid-clip and then relax back.
export const DataSphere: React.FC<Props> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const scale = width / DESIGN_WIDTH;

  const strands = useMemo(() => generateStrands(), []);
  const dots = useMemo(() => generateDots(), []);
  const sharpRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = sharpRef.current;
    const glow = glowRef.current;
    if (!canvas || !glow) return;
    const ctx = canvas.getContext("2d");
    const gctx = glow.getContext("2d");
    if (!ctx || !gctx) return;

    const t = frame / fps;
    const tangle = tangleAmount(t);
    const cx = SPHERE_CENTER_X * scale;
    const cy = SPHERE_CENTER_Y * scale;
    const R = SPHERE_RADIUS * scale;

    // Spin around Y, then tilt around X. A slow secondary sway keeps the
    // motion from feeling mechanical.
    const yaw = t * ROTATION_SPEED + 0.4;
    const tilt = AXIAL_TILT + 0.06 * Math.sin(t * 0.45);
    const cyw = Math.cos(yaw);
    const syw = Math.sin(yaw);
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);

    // Writes projected screen x/y/depth for a unit-ish point into out[].
    const out = [0, 0, 0];
    const project = (x: number, y: number, z: number, r: number) => {
      const x1 = x * cyw + z * syw;
      const z1 = -x * syw + z * cyw;
      const y2 = y * ct - z1 * st;
      const z2 = y * st + z1 * ct;
      const persp = CAMERA_DISTANCE / (CAMERA_DISTANCE - z2 * r);
      out[0] = cx + x1 * r * R * persp;
      out[1] = cy + y2 * r * R * persp;
      out[2] = z2; // -1 back .. 1 front
    };
    const depthLevel = (z: number) =>
      Math.max(0, Math.min(DEPTH_LEVELS - 1, Math.floor(((z + 1) / 2) * DEPTH_LEVELS)));
    const depthAlpha = (level: number) => 0.16 + 0.84 * Math.pow((level + 0.5) / DEPTH_LEVELS, 1.3);

    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // --- Strands -------------------------------------------------------
    const paths: Path2D[] = Array.from({ length: DEPTH_LEVELS }, () => new Path2D());
    const nodePaths: Path2D[] = Array.from({ length: DEPTH_LEVELS }, () => new Path2D());
    const nodeR = 1.05 * scale;
    for (const s of strands) {
      const n = s.radial.length;
      const len = Math.round(s.minLen + (s.maxLen - s.minLen) * tangle);
      const room = n - 1 - len;
      // Visible window slides back and forth along the strand.
      const center = room / 2 + (room / 2) * Math.sin(t * s.driftSpeed + s.driftPhase);
      const start = Math.max(0, Math.floor(center));
      const end = Math.min(n - 1, start + len);
      const wobble = 0.018 * Math.sin(t * 1.3 + s.wobblePhase);

      let prevLevel = -1;
      let px = 0;
      let py = 0;
      for (let i = start; i <= end; i++) {
        const r = 1 + s.radial[i] * (0.35 + 0.65 * tangle) + wobble;
        project(s.points[i * 3], s.points[i * 3 + 1], s.points[i * 3 + 2], r);
        const lvl = depthLevel(out[2]);
        if (i > start) {
          const path = paths[Math.min(lvl, prevLevel)];
          path.moveTo(px, py);
          path.lineTo(out[0], out[1]);
        }
        // Bright nodes along strands read as the dotted network.
        if ((i - start) % 9 === 0) {
          nodePaths[lvl].moveTo(out[0] + nodeR, out[1]);
          nodePaths[lvl].arc(out[0], out[1], nodeR, 0, Math.PI * 2);
        }
        prevLevel = lvl;
        px = out[0];
        py = out[1];
      }
    }
    const lineAlphaScale = 0.6 - 0.2 * tangle;
    ctx.lineWidth = 0.85 * scale;
    for (let l = 0; l < DEPTH_LEVELS; l++) {
      ctx.strokeStyle = `rgba(${palette.sphereLine}, ${depthAlpha(l) * lineAlphaScale})`;
      ctx.stroke(paths[l]);
    }
    const nodeAlpha = 0.9 - 0.55 * tangle;
    for (let l = 0; l < DEPTH_LEVELS; l++) {
      ctx.fillStyle = `rgba(${palette.sphereDot}, ${depthAlpha(l) * nodeAlpha})`;
      ctx.fill(nodePaths[l]);
    }

    // --- Loose surface dots -------------------------------------------
    const dotVisibility = 1 - 0.8 * tangle;
    if (dotVisibility > 0.01) {
      const dotPaths: Path2D[] = Array.from({ length: DEPTH_LEVELS }, () => new Path2D());
      for (const d of dots) {
        const flicker = 0.55 + 0.45 * Math.sin(t * d.flickerSpeed + d.flickerPhase);
        if (flicker * d.brightness < 0.25) continue;
        project(d.x, d.y, d.z, 1);
        const lvl = depthLevel(out[2]);
        const r = d.radius * scale;
        dotPaths[lvl].moveTo(out[0] + r, out[1]);
        dotPaths[lvl].arc(out[0], out[1], r, 0, Math.PI * 2);
      }
      for (let l = 0; l < DEPTH_LEVELS; l++) {
        ctx.fillStyle = `rgba(${palette.sphereDot}, ${depthAlpha(l) * dotVisibility * 0.85})`;
        ctx.fill(dotPaths[l]);
      }
    }

    // Glow pass: a blurred copy (blur applied via CSS) screened on top.
    gctx.clearRect(0, 0, width, height);
    gctx.drawImage(canvas, 0, 0);
  }, [frame, fps, width, height, scale, strands, dots, palette]);

  return (
    <AbsoluteFill>
      <canvas
        ref={glowRef}
        width={width}
        height={height}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          filter: `blur(${4 * scale}px)`,
          opacity: palette.glowOpacity,
          mixBlendMode: "screen",
        }}
      />
      <canvas
        ref={sharpRef}
        width={width}
        height={height}
        style={{ position: "absolute", width: "100%", height: "100%", mixBlendMode: "screen" }}
      />
    </AbsoluteFill>
  );
};
