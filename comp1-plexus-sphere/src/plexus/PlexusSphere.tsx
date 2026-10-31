import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { buildGeometry, Vec3, wobbleAt } from "./geometry";
import { PALETTES } from "./palettes";

export const plexusSchema = z.object({
  palette: z.enum(["reference", "midnight"]),
  seed: z.number(),
});

export type PlexusProps = z.infer<typeof plexusSchema>;

// Layout and motion measured from the reference by tracking vertex dots
// and least-squares fitting rigid rotations over sliding 2 s windows:
// the instantaneous spin axis precesses once per clip at a constant rate
// |ω| ≈ 0.0149 rad/frame. That is exactly a composite of two full turns per
// clip: a clockwise roll about the view axis × a spin about an in-plane axis
// (|ω| = √2·2π/600 = 0.0148). Both are whole revolutions → seamless loop.
const CENTER_X = 0.879;
const CENTER_Y = 0.433;
const RADIUS = 0.32; // of width
const SPIN_AXIS: Vec3 = [-0.987, 0.163, 0]; // in-plane axis at t = 0
const CAMERA_DIST = 4; // in sphere radii — gentle perspective

type Projected = { x: number; y: number; z: number; s: number };

type Mat3 = number[];

const rodrigues = (k: Vec3, angle: number): Mat3 => {
  const [kx, ky, kz] = k;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  return [
    t * kx * kx + c, t * kx * ky - s * kz, t * kx * kz + s * ky,
    t * kx * ky + s * kz, t * ky * ky + c, t * ky * kz - s * kx,
    t * kx * kz - s * ky, t * ky * kz + s * kx, t * kz * kz + c,
  ];
};

const mul = (a: Mat3, b: Mat3): Mat3 => {
  const r: Mat3 = new Array(9).fill(0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
};

const makeProjector = (angle: number, w: number, h: number) => {
  // Clockwise roll about the view axis (+z toward camera) ∘ spin about the
  // in-plane axis.
  const m = mul(rodrigues([0, 0, 1], -angle), rodrigues(SPIN_AXIS, angle));
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
  const backRef = useRef<HTMLCanvasElement | null>(null);
  const bgRef = useRef<HTMLCanvasElement | null>(null);
  const geo = useMemo(() => buildGeometry(seed), [seed]);
  const pal = PALETTES[palette];

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Unit = 1px at 1080p width, so all sizes scale with resolution.
    const u = width / 1920;

    // Background is static: paint (and dither) it once per tab, then blit.
    if (!bgRef.current || bgRef.current.width !== width || bgRef.current.height !== height) {
      const bg = document.createElement("canvas");
      bg.width = width;
      bg.height = height;
      const bctx = bg.getContext("2d")!;
      pal.paintBackground(bctx, width, height);
      if (pal.dither > 0) {
        // ±dither LSB of noise breaks up 8-bit banding in smooth gradients.
        const img = bctx.getImageData(0, 0, width, height);
        const d = img.data;
        let st = 0x9e3779b9 ^ seed;
        for (let i = 0; i < d.length; i += 4) {
          st ^= st << 13;
          st ^= st >>> 17;
          st ^= st << 5;
          const n = ((st >>> 0) / 4294967296 - 0.5) * 2 * pal.dither;
          d[i] += n;
          d[i + 1] += n;
          d[i + 2] += n;
        }
        bctx.putImageData(img, 0, 0);
      }
      bgRef.current = bg;
    }
    if (!backRef.current || backRef.current.width !== width || backRef.current.height !== height) {
      const b = document.createElement("canvas");
      b.width = width;
      b.height = height;
      backRef.current = b;
    }

    // One full revolution over the clip → seamless loop (frame N == frame 0).
    const t = frame / durationInFrames;
    const angle = t * Math.PI * 2;
    const project = makeProjector(angle, width, height);

    const pn = geo.nodes.map((n) => project(wobbleAt(n.p, n.wob, t)));
    const pd = geo.dust.map((d) => project(wobbleAt(d.p, d.wob, t)));

    // depth 0 (back) … 1 (front)
    const depth = (zv: number) => Math.min(1, Math.max(0, (zv + 1.1) / 2.2));

    // Elements behind the sphere's mid-plane go on a separate layer that is
    // softly blurred (shallow depth of field, as in the reference).
    const back = backRef.current;
    const bctx = back.getContext("2d")!;
    bctx.clearRect(0, 0, width, height);

    const drawScene = (c: CanvasRenderingContext2D, wantBack: boolean) => {
      c.lineCap = "round";
      c.lineWidth = pal.lineWidth * u;
      for (const e of geo.edges) {
        const a = pn[e.a];
        const b = pn[e.b];
        const zm = (a.z + b.z) / 2;
        if (zm < 0 !== wantBack) continue;
        const d = depth(zm);
        const alpha = e.weight * (pal.lineBackAlpha + (pal.lineFrontAlpha - pal.lineBackAlpha) * d);
        c.strokeStyle = pal.line(alpha);
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.stroke();
      }
      if (pal.glow > 0) c.shadowColor = pal.glowColor;
      // Dust first, then vertices, both sorted back-to-front.
      const dustOrder = pd.map((_, i) => i).sort((i, j) => pd[i].z - pd[j].z);
      for (const i of dustOrder) {
        const p = pd[i];
        if (p.z < 0 !== wantBack) continue;
        const d = depth(p.z);
        const rad = geo.dust[i].size * pal.dustRadius * u * p.s;
        c.shadowBlur = pal.glow * 0.5 * u * d;
        c.fillStyle = pal.dust(pal.dustAlpha * (pal.dustBackAlpha + (1 - pal.dustBackAlpha) * d));
        c.beginPath();
        c.arc(p.x, p.y, rad, 0, Math.PI * 2);
        c.fill();
      }
      const nodeOrder = pn.map((_, i) => i).sort((i, j) => pn[i].z - pn[j].z);
      for (const i of nodeOrder) {
        const p = pn[i];
        if (p.z < 0 !== wantBack) continue;
        const d = depth(p.z);
        const rad = geo.nodes[i].size * pal.nodeRadius * u * p.s;
        c.shadowBlur = pal.glow * u * (0.4 + 0.6 * d) * geo.nodes[i].size;
        c.fillStyle = pal.node(pal.nodeBackAlpha + (1 - pal.nodeBackAlpha) * d);
        c.beginPath();
        c.arc(p.x, p.y, rad, 0, Math.PI * 2);
        c.fill();
      }
      c.shadowBlur = 0;
    };

    drawScene(bctx, true);
    ctx.filter = "none";
    ctx.drawImage(bgRef.current, 0, 0);
    ctx.filter = `blur(${(pal.backBlur * u).toFixed(2)}px)`;
    ctx.drawImage(back, 0, 0);
    ctx.filter = "none";
    drawScene(ctx, false);
  }, [frame, width, height, durationInFrames, geo, pal, seed]);

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
