import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import {
  BASE_WIDTH,
  CAMERA_SWAY_X,
  CAMERA_SWAY_Y,
  DOF_STRENGTH,
  DURATION_IN_FRAMES,
  FOCAL_LENGTH,
  FOCUS_DISTANCE,
  FOG_END,
  FOG_START,
  LINE_WIDTH,
  MAX_BLUR_RADIUS,
  NEAR_CLIP,
  NEAR_FADE_END,
  NODE_RADIUS,
  THEMES,
  TUNNEL_DEPTH,
  WIGGLE_AMPLITUDE,
  WIGGLE_PERIOD,
  type PlexusTheme,
  type Rgb,
} from "./constants";
import { buildEdges, generateNodes } from "./nodes";

export const plexusTunnelSchema = z.object({
  theme: z.enum(["light", "dark"]),
  // Changing this reshuffles the whole node cloud while keeping every
  // other property of the look identical.
  seed: z.number().int(),
});

export type PlexusTunnelProps = z.infer<typeof plexusTunnelSchema>;

export const plexusTunnelDefaults: PlexusTunnelProps = {
  theme: "light",
  seed: 20240917,
};

const TAU = Math.PI * 2;
const WIGGLE_FREQ = TAU / WIGGLE_PERIOD;

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

// Distant geometry dissolves into the fog colour; near geometry fades as
// it rushes past the lens. Multiplied together these also hide the loop
// seam: a node is already invisible by the time it wraps.
const depthAlpha = (z: number) =>
  (1 - smoothstep(FOG_START, FOG_END, z)) * smoothstep(NEAR_CLIP, NEAR_FADE_END, z);

// Thin-lens circle of confusion. The far side is deliberately damped —
// the reference keeps distant dots crisp and reserves the heavy bokeh for
// nodes flying past the camera.
const circleOfConfusion = (z: number, resolutionScale: number) => {
  const raw = DOF_STRENGTH * FOCAL_LENGTH * Math.abs(1 / z - 1 / FOCUS_DISTANCE);
  const damped = z < FOCUS_DISTANCE ? raw : raw * 0.15;
  return Math.min(MAX_BLUR_RADIUS, damped) * resolutionScale;
};

const rgba = (c: Rgb, alpha: number) =>
  `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha.toFixed(3)})`;

// A node is either a crisp disc or, once defocused, a bokeh blob: a
// radial gradient whose peak is dimmed by how far the same "light" has
// been spread, so blurring never makes a node brighter.
const drawDot = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  blur: number,
  color: Rgb,
  alpha: number,
) => {
  if (blur < 0.7) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(radius, 0.35), 0, TAU);
    ctx.fillStyle = rgba(color, alpha);
    ctx.fill();
    return;
  }

  const outer = radius + blur;
  const peak = alpha * Math.max(0.05, Math.pow(radius / outer, 1.7));
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, outer);
  gradient.addColorStop(0, rgba(color, peak));
  gradient.addColorStop(0.35, rgba(color, peak * 0.72));
  gradient.addColorStop(0.7, rgba(color, peak * 0.26));
  gradient.addColorStop(1, rgba(color, 0));
  ctx.beginPath();
  ctx.arc(x, y, outer, 0, TAU);
  ctx.fillStyle = gradient;
  ctx.fill();
};

const paintBackground = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: PlexusTheme,
) => {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    Math.hypot(width, height) / 2,
  );
  gradient.addColorStop(0, theme.backgroundCenter);
  gradient.addColorStop(1, theme.backgroundEdge);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
};

const paintVignette = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: PlexusTheme,
) => {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.22,
    width / 2,
    height / 2,
    Math.hypot(width, height) / 2,
  );
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, theme.vignette);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
};

export const PlexusTunnel: React.FC<PlexusTunnelProps> = ({ theme, seed }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Scale is derived from the composition width rather than passed in, so
  // a 4K composition can never drift out of sync with its 1080p twin.
  const resolutionScale = width / BASE_WIDTH;
  const palette = THEMES[theme];

  const { nodes, edges } = useMemo(() => {
    const generated = generateNodes(seed);
    return { nodes: generated, edges: buildEdges(generated) };
  }, [seed]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }

    paintBackground(ctx, width, height, palette);

    const centerX = width / 2;
    const centerY = height / 2;
    const loopT = frame / DURATION_IN_FRAMES;

    // One full sway cycle and exactly one tunnel-length of travel per
    // loop: frame DURATION_IN_FRAMES would reproduce frame 0 exactly.
    const camZ = loopT * TUNNEL_DEPTH;
    const camX = Math.sin(loopT * TAU) * CAMERA_SWAY_X;
    const camY = Math.sin(loopT * TAU + Math.PI / 3) * CAMERA_SWAY_Y;

    const count = nodes.length;
    const worldX = new Float64Array(count);
    const worldY = new Float64Array(count);
    const depth = new Float64Array(count);
    const screenX = new Float64Array(count);
    const screenY = new Float64Array(count);
    const alpha = new Float64Array(count);

    for (let i = 0; i < count; i++) {
      const node = nodes[i];
      const wiggle = WIGGLE_AMPLITUDE * node.wiggleAmp;
      worldX[i] =
        node.x - camX + Math.sin(frame * WIGGLE_FREQ + node.wigglePhaseX) * wiggle;
      worldY[i] =
        node.y - camY + Math.cos(frame * WIGGLE_FREQ + node.wigglePhaseY) * wiggle;

      const z = ((node.z - camZ) % TUNNEL_DEPTH + TUNNEL_DEPTH) % TUNNEL_DEPTH;
      depth[i] = z;
      const projection = (FOCAL_LENGTH / z) * resolutionScale;
      screenX[i] = centerX + worldX[i] * projection;
      screenY[i] = centerY + worldY[i] * projection;
      alpha[i] = depthAlpha(z);
    }

    // Edges first, so bokeh blobs sit on top of the lattice.
    ctx.lineWidth = LINE_WIDTH * resolutionScale;
    ctx.lineCap = "round";
    for (const edge of edges) {
      const aAlpha = alpha[edge.a];
      if (aAlpha <= 0.004) {
        continue;
      }
      // The far endpoint is projected relative to the near one instead of
      // from its own wrapped depth: at the loop seam that would otherwise
      // stretch a line across the entire tunnel.
      const zB = depth[edge.a] + edge.dz;
      if (zB <= NEAR_CLIP || zB >= FOG_END) {
        continue;
      }
      const bAlpha = depthAlpha(zB);
      const lineAlpha = Math.min(aAlpha, bAlpha) * edge.strength * palette.lineOpacity;
      if (lineAlpha <= 0.004) {
        continue;
      }
      const projectionB = (FOCAL_LENGTH / zB) * resolutionScale;
      ctx.beginPath();
      ctx.moveTo(screenX[edge.a], screenY[edge.a]);
      ctx.lineTo(
        centerX + worldX[edge.b] * projectionB,
        centerY + worldY[edge.b] * projectionB,
      );
      ctx.strokeStyle = rgba(palette.line, lineAlpha);
      ctx.stroke();
    }

    // Painter's algorithm: farthest node first.
    const order = Array.from({ length: count }, (_, i) => i)
      .filter((i) => alpha[i] > 0.004)
      .sort((a, b) => depth[b] - depth[a]);

    if (palette.glowOpacity > 0) {
      ctx.globalCompositeOperation = "lighter";
      for (const i of order) {
        const radius =
          NODE_RADIUS * nodes[i].sizeFactor * (FOCAL_LENGTH / depth[i]) * resolutionScale;
        const blur = circleOfConfusion(depth[i], resolutionScale);
        drawDot(
          ctx,
          screenX[i],
          screenY[i],
          radius,
          blur + radius * palette.glowRadiusFactor,
          palette.node,
          alpha[i] * palette.glowOpacity,
        );
      }
      ctx.globalCompositeOperation = "source-over";
    }

    for (const i of order) {
      const radius =
        NODE_RADIUS * nodes[i].sizeFactor * (FOCAL_LENGTH / depth[i]) * resolutionScale;
      drawDot(
        ctx,
        screenX[i],
        screenY[i],
        radius,
        circleOfConfusion(depth[i], resolutionScale),
        palette.node,
        alpha[i] * palette.nodeOpacity,
      );
    }

    paintVignette(ctx, width, height, palette);
  }, [frame, width, height, resolutionScale, palette, nodes, edges]);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.backgroundEdge }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
