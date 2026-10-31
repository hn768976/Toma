import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { buildGeometry, Vec3 } from "./geometry";
import { PALETTES } from "./palettes";

export const plexusSchema = z.object({
  palette: z.enum(["reference", "midnight"]),
  seed: z.number(),
});

export type PlexusProps = z.infer<typeof plexusSchema>;

// Layout and motion measured from the reference by tracking ~380 vertex
// dots across frames and least-squares fitting a rigid rotation:
// centre ≈ (0.898 W, 0.486 H), vertex radius ≈ 0.345 W, one full turn per
// clip about an axis tilted strongly toward the camera.
const CENTER_X = 0.898;
const CENTER_Y = 0.486;
const RADIUS = 0.345; // of width
const AXIS: Vec3 = (() => {
  const a: Vec3 = [0.5, -0.12, -0.86];
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
})();
const CAMERA_DIST = 4; // in sphere radii — gentle perspective

type Projected = { x: number; y: number; z: number; s: number };

const makeProjector = (angle: number, w: number, h: number) => {
  // Rodrigues rotation matrix about AXIS.
  const [kx, ky, kz] = AXIS;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  const m = [
    t * kx * kx + c, t * kx * ky - s * kz, t * kx * kz + s * ky,
    t * kx * ky + s * kz, t * ky * ky + c, t * ky * kz - s * kx,
    t * kx * kz - s * ky, t * ky * kz + s * kx, t * kz * kz + c,
  ];
  const cx = w * CENTER_X;
  const cy = h * CENTER_Y;
  const r = w * RADIUS;
  return (p: Vec3): Projected => {
    const x = m[0] * p[0] + m[1] * p[1] + m[2] * p[2];
    const y = m[3] * p[0] + m[4] * p[1] + m[5] * p[2];
    const z = m[6] * p[0] + m[7] * p[1] + m[8] * p[2];
    const k = CAMERA_DIST / (CAMERA_DIST - z);
    // +y is up in model space; +z points at the camera.
    return { x: cx + x * r * k, y: cy - y * r * k, z, s: k };
  };
};

export const PlexusSphere: React.FC<PlexusProps> = ({ palette, seed }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geo = useMemo(() => buildGeometry(seed), [seed]);
  const pal = PALETTES[palette];

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Unit = 1px at 1080p width, so all sizes scale with resolution.
    const u = width / 1920;

    // One full revolution over the clip → seamless loop (frame N == frame 0).
    const angle = (frame / durationInFrames) * Math.PI * 2;
    const project = makeProjector(angle, width, height);

    pal.paintBackground(ctx, width, height);

    const pn = geo.nodes.map((n) => project(n.p));
    const pd = geo.dust.map((d) => project(d.p));

    // depth 0 (back) … 1 (front)
    const depth = (zv: number) => Math.min(1, Math.max(0, (zv + 1.1) / 2.2));

    ctx.lineCap = "round";
    ctx.lineWidth = pal.lineWidth * u;
    for (const e of geo.edges) {
      const a = pn[e.a];
      const b = pn[e.b];
      const d = depth((a.z + b.z) / 2);
      const alpha = e.weight * (pal.lineBackAlpha + (pal.lineFrontAlpha - pal.lineBackAlpha) * d);
      ctx.strokeStyle = pal.line(alpha);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    if (pal.glow > 0) {
      ctx.shadowColor = pal.glowColor;
    }

    // Dust first, then vertices, both sorted back-to-front.
    const dustOrder = pd.map((p, i) => i).sort((i, j) => pd[i].z - pd[j].z);
    for (const i of dustOrder) {
      const p = pd[i];
      const d = depth(p.z);
      const rad = geo.dust[i].size * pal.dustRadius * u * p.s;
      ctx.shadowBlur = pal.glow * 0.5 * u * d;
      ctx.fillStyle = pal.dust(pal.dustBackAlpha + (1 - pal.dustBackAlpha) * d);
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    const nodeOrder = pn.map((p, i) => i).sort((i, j) => pn[i].z - pn[j].z);
    for (const i of nodeOrder) {
      const p = pn[i];
      const d = depth(p.z);
      const rad = geo.nodes[i].size * pal.nodeRadius * u * p.s;
      ctx.shadowBlur = pal.glow * u * (0.4 + 0.6 * d) * geo.nodes[i].size;
      ctx.fillStyle = pal.node(pal.nodeBackAlpha + (1 - pal.nodeBackAlpha) * d);
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }, [frame, width, height, durationInFrames, geo, pal]);

  return (
    <AbsoluteFill style={{ backgroundColor: pal.css }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
