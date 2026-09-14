import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { BASE_HEIGHT, BASE_WIDTH } from "./constants";
import { Camera, project, projectPolygon, projectSegment } from "./camera";
import { hash2, seeded } from "./random";

export const solarArraySchema = z.object({
  /** Degrees the array is rotated about the vertical axis. */
  yaw: z.number().min(-90).max(90),
  /** Forward camera speed, world units per second. */
  speed: z.number().min(0).max(30),
  /** Multiplier on the specular glints that run along the panel seams. */
  glint: z.number().min(0).max(3),
  /** Airborne sparkles drifting over the array. */
  sparkleCount: z.number().int().min(0).max(900),
});

export type SolarArrayProps = z.infer<typeof solarArraySchema>;

export const solarArrayDefaults: SolarArrayProps = {
  yaw: 5,
  speed: 1.35,
  glint: 1,
  sparkleCount: 300,
};

/** One panel's footprint, and the gap left between neighbours. */
const PANEL_W = 4.0;
const PANEL_D = 1.35;
const GAP = 0.1;

/** Cells etched into the face of a single panel. */
const CELLS_X = 14;
const CELLS_Z = 5;

/** How far out geometry is generated, relative to the camera. */
const X_REACH = 78;
const Z_BACK = 12;
const Z_AHEAD = 90;

const PANEL_MAX_DEPTH = 62;
/** Past this depth a panel is too small on screen to be worth etching cells. */
const CELL_MAX_DEPTH = 26;

const DEG = Math.PI / 180;

const buildCamera = (frame: number, fps: number, props: SolarArrayProps): Camera => {
  const t = frame / fps;
  return {
    focal: 1520,
    height: 4.5,
    pitch: (33 + Math.sin(t * 0.27) * 0.8) * DEG,
    yaw: (props.yaw + Math.sin(t * 0.21) * 1.1) * DEG,
    roll: (-6.5 + Math.sin(t * 0.36) * 0.6) * DEG,
    // A slow lateral drift keeps the array from reading as a flat scroll.
    panX: Math.sin(t * 0.3) * 1.6,
    dolly: t * props.speed,
    cx: BASE_WIDTH / 2,
    cy: BASE_HEIGHT / 2,
  };
};

const widthForDepth = (depth: number, base: number): number =>
  Math.max(0.4, Math.min(base * 2.6, (base * 11) / depth));

type Panel = {
  key: string;
  row: number;
  col: number;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  depth: number;
  poly: string;
  screenW: number;
};

export const SolarPanelArray: React.FC<SolarArrayProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const cam = buildCamera(frame, fps, props);

  const zMin = cam.dolly - Z_BACK;
  const zMax = cam.dolly + Z_AHEAD;
  const xMin = cam.panX - X_REACH;
  const xMax = cam.panX + X_REACH;

  const row0 = Math.floor(zMin / PANEL_D);
  const row1 = Math.ceil(zMax / PANEL_D);

  // --- gather visible panels ----------------------------------------------
  const panels: Panel[] = [];
  for (let row = row0; row <= row1; row++) {
    // Alternate rows are offset by half a panel, giving the brick stagger.
    const offset = (row & 1) === 0 ? 0 : PANEL_W / 2;
    const z0 = row * PANEL_D;
    const z1 = z0 + PANEL_D - GAP;

    const col0 = Math.floor((xMin - offset) / PANEL_W);
    const col1 = Math.ceil((xMax - offset) / PANEL_W);
    for (let col = col0; col <= col1; col++) {
      const x0 = col * PANEL_W + offset;
      const x1 = x0 + PANEL_W - GAP;
      const quad = projectPolygon(
        [
          [x0, z0],
          [x1, z0],
          [x1, z1],
          [x0, z1],
        ],
        cam,
      );
      if (!quad) continue;
      const centre = project((x0 + x1) / 2, (z0 + z1) / 2, cam);
      if (!centre || centre.depth > PANEL_MAX_DEPTH) continue;
      panels.push({
        key: `p${row}_${col}`,
        row,
        col,
        x0,
        x1,
        z0,
        z1,
        depth: centre.depth,
        poly: quad.points,
        screenW: quad.maxX - quad.minX,
      });
    }
  }
  // Painter's algorithm: far panels first so near ones overlap them.
  panels.sort((a, b) => b.depth - a.depth);

  // --- panel faces, etched cells and lit edges -----------------------------
  const faces: React.ReactNode[] = [];
  const cells: React.ReactNode[] = [];
  const edges: React.ReactNode[] = [];

  for (const p of panels) {
    const fade = 1 - p.depth / PANEL_MAX_DEPTH;
    // A little per-panel variation stops the array reading as a printed texture.
    const tint = hash2(p.row, p.col);

    faces.push(
      <polygon
        key={`f${p.key}`}
        points={p.poly}
        fill="url(#sp-face)"
        opacity={(0.78 + tint * 0.22) * (0.35 + 0.65 * fade)}
      />,
    );

    if (p.depth < CELL_MAX_DEPTH && p.screenW > 45) {
      const cellFade = 1 - p.depth / CELL_MAX_DEPTH;
      for (let i = 1; i < CELLS_X; i++) {
        const cx = p.x0 + ((p.x1 - p.x0) * i) / CELLS_X;
        const seg = projectSegment(cx, p.z0, cx, p.z1, cam);
        if (!seg) continue;
        cells.push(
          <line
            key={`cx${p.key}_${i}`}
            x1={seg[0].x}
            y1={seg[0].y}
            x2={seg[1].x}
            y2={seg[1].y}
            stroke="#9fc9f5"
            strokeWidth={widthForDepth(p.depth, 0.55)}
            opacity={0.44 * cellFade}
          />,
        );
      }
      for (let i = 1; i < CELLS_Z; i++) {
        const cz = p.z0 + ((p.z1 - p.z0) * i) / CELLS_Z;
        const seg = projectSegment(p.x0, cz, p.x1, cz, cam);
        if (!seg) continue;
        cells.push(
          <line
            key={`cz${p.key}_${i}`}
            x1={seg[0].x}
            y1={seg[0].y}
            x2={seg[1].x}
            y2={seg[1].y}
            stroke="#9fc9f5"
            strokeWidth={widthForDepth(p.depth, 0.55)}
            opacity={0.44 * cellFade}
          />,
        );
      }
    }

    edges.push(
      <polygon
        key={`e${p.key}`}
        points={p.poly}
        fill="none"
        stroke="#d8ecff"
        strokeWidth={widthForDepth(p.depth, 1.5)}
        strokeLinejoin="round"
        opacity={Math.min(0.95, 0.5 + 0.5 * fade)}
      />,
    );
  }

  // --- specular glints ------------------------------------------------------
  // Bright vertical flares that sweep along the seams between panels, standing
  // in for sunlight catching the frame edges.
  const glints: React.ReactNode[] = [];
  if (props.glint > 0) {
    for (const p of panels) {
      if (p.depth > 40) continue;
      const phase = hash2(p.row * 7 + 1, p.col * 13 + 3);
      // Each seam flares on its own cycle, a few at a time.
      const cycle = (t * 0.5 + phase) % 1;
      const pulse = Math.max(0, Math.sin(cycle * Math.PI) ** 5);
      if (pulse < 0.02) continue;

      const seg = projectSegment(p.x0, p.z0, p.x0, p.z1, cam);
      if (!seg) continue;
      const amount = pulse * props.glint * (1 - p.depth / 40);
      glints.push(
        <line
          key={`g${p.key}`}
          x1={seg[0].x}
          y1={seg[0].y}
          x2={seg[1].x}
          y2={seg[1].y}
          stroke="#8fd4ff"
          strokeWidth={widthForDepth(p.depth, 7.5)}
          strokeLinecap="round"
          opacity={Math.min(0.95, amount * 1.1)}
        />,
        <line
          key={`gc${p.key}`}
          x1={seg[0].x}
          y1={seg[0].y}
          x2={seg[1].x}
          y2={seg[1].y}
          stroke="#f4fbff"
          strokeWidth={widthForDepth(p.depth, 2.0)}
          strokeLinecap="round"
          opacity={Math.min(1, amount * 1.35)}
        />,
      );
    }
  }

  // --- airborne sparkles ----------------------------------------------------
  const sparkSeeds = useMemo(() => {
    const rnd = seeded(0xa17e5);
    return Array.from({ length: props.sparkleCount }, () => ({
      x: (rnd() - 0.5) * 64,
      y: rnd(),
      z: rnd(),
      size: 0.6 + rnd() * 1.5,
      phase: rnd() * Math.PI * 2,
      drift: 0.15 + rnd() * 0.5,
    }));
  }, [props.sparkleCount]);

  const sparkSpan = 40;
  const sparkles = sparkSeeds.map((s, i) => {
    const wz = cam.dolly - 3 + ((s.z * sparkSpan + t * s.drift) % sparkSpan);
    const wy = cam.height - (0.08 + s.y * 2.2) - Math.sin(t * 0.6 + s.phase) * 0.1;
    const p = project(s.x + cam.panX, wz, cam, wy);
    if (!p || p.depth > 28) return null;
    if (p.x < -40 || p.x > BASE_WIDTH + 40 || p.y < -40 || p.y > BASE_HEIGHT + 40) {
      return null;
    }
    const r = Math.max(0.6, (s.size * 6) / p.depth);
    const twinkle = 0.3 + 0.65 * Math.abs(Math.sin(t * 1.15 + s.phase));
    return (
      <circle
        key={`sp${i}`}
        cx={p.x}
        cy={p.y}
        r={r}
        fill="#e9f5ff"
        opacity={Math.min(0.9, twinkle * (1 - p.depth / 28))}
      />
    );
  });

  // A soft key light drifts across the array so the field never sits flat.
  const keyX = 50 + Math.sin(t * 0.31) * 26;
  const keyY = interpolate(Math.sin(t * 0.23), [-1, 1], [22, 40]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#050f24" }}>
      <svg
        viewBox={`0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`}
        width="100%"
        height="100%"
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id="sp-face" x1="0%" y1="0%" x2="18%" y2="100%">
            <stop offset="0%" stopColor="#1d5599" />
            <stop offset="45%" stopColor="#133a72" />
            <stop offset="100%" stopColor="#0a2247" />
          </linearGradient>
          <radialGradient id="sp-sky" cx="50%" cy="78%" r="82%">
            <stop offset="0%" stopColor="#133c76" />
            <stop offset="48%" stopColor="#091c3c" />
            <stop offset="100%" stopColor="#02070f" />
          </radialGradient>
          <radialGradient id="sp-key" cx={`${keyX}%`} cy={`${keyY}%`} r="52%">
            <stop offset="0%" stopColor="#8fc6ff" stopOpacity="0.38" />
            <stop offset="60%" stopColor="#4d8fe0" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sp-vignette" cx="50%" cy="52%" r="70%">
            <stop offset="44%" stopColor="#000510" stopOpacity="0" />
            <stop offset="100%" stopColor="#000510" stopOpacity="0.88" />
          </radialGradient>
          <filter id="sp-bloom" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="sp-bloom-wide" x="-45%" y="-45%" width="190%" height="190%">
            <feGaussianBlur stdDeviation="40" />
          </filter>
        </defs>

        <rect width={BASE_WIDTH} height={BASE_HEIGHT} fill="url(#sp-sky)" />

        <g>{faces}</g>
        <g>{cells}</g>
        <g filter="url(#sp-bloom)" opacity={0.45}>{edges}</g>
        <g>{edges}</g>

        {/* Key light sits over the array, under the flares. */}
        <rect
          width={BASE_WIDTH}
          height={BASE_HEIGHT}
          fill="url(#sp-key)"
          style={{ mixBlendMode: "screen" }}
        />

        <g filter="url(#sp-bloom-wide)" opacity={0.75}>{glints}</g>
        <g filter="url(#sp-bloom)" opacity={0.9}>{glints}</g>
        <g>{glints}</g>
        <g>{sparkles}</g>

        <rect width={BASE_WIDTH} height={BASE_HEIGHT} fill="url(#sp-vignette)" />
      </svg>
    </AbsoluteFill>
  );
};
