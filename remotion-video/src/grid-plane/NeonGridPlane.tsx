import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { BASE_HEIGHT, BASE_WIDTH } from "./constants";
import {
  Camera,
  depthAt,
  depthBand,
  NEAR,
  project,
  projectPolygon,
  projectSegment,
} from "./camera";
import {
  busbarPath,
  CellSpec,
  cornerDiamondPath,
  detailFade,
  gapLinePath,
} from "./solar-surface";
import { hash2, seeded } from "./random";

export const neonGridSchema = z.object({
  /** Degrees the plane is rotated about the vertical axis. */
  yaw: z.number().min(-90).max(90),
  /** Forward camera speed, world units per second. */
  speed: z.number().min(0).max(30),
  /** Multiplier on how bright the ignited lines get. */
  glow: z.number().min(0).max(3),
  /** Floating dust motes. */
  dustCount: z.number().int().min(0).max(900),
});

export type NeonGridProps = z.infer<typeof neonGridSchema>;

export const neonGridDefaults: NeonGridProps = {
  yaw: 27,
  speed: 4.6,
  glow: 1,
  dustCount: 520,
};

/** World-space pitch of the panels, and so of the bright seams between them. */
const MAJOR = 4.4;
/** Half-width of the seam, i.e. how far each panel is inset from its cell. */
const SEAM = 0.1;

/**
 * The panel face. Square panels, so the cell count matches on both axes; the
 * cells themselves are static — only the seams between panels ever light up.
 */
const CELL_SPEC: CellSpec = {
  cellsX: 10,
  cellsZ: 10,
  busbars: 2,
  diamond: 0.095,
};

/** Depths at which each kind of cell detail is fully drawn / fully gone. */
const DIAMOND_FADE: [number, number] = [12, 26];
const BUSBAR_FADE: [number, number] = [10, 24];
const GAP_FADE: [number, number] = [18, 40];
/** Past this a panel is a dark face with no cell detail left. */
const PANEL_MAX_DEPTH = 52;

/** How far out geometry is generated, relative to the camera. */
const X_REACH = 70;
const Z_BACK = 30;
const Z_AHEAD = 80;

/** Depth at which the structural lines have faded out completely. */
const MAJOR_MAX_DEPTH = 78;

const DEG = Math.PI / 180;

const buildCamera = (frame: number, fps: number, props: NeonGridProps): Camera => {
  const t = frame / fps;
  return {
    focal: 1450,
    height: 3.6,
    // A slow settle from a slightly flatter angle gives the build-up somewhere
    // to go without ever letting the horizon into frame.
    pitch:
      interpolate(t, [0, 6], [28.5, 31], { extrapolateRight: "clamp" }) * DEG,
    yaw: (props.yaw + Math.sin(t * 0.38) * 1.6) * DEG,
    roll: (-8 + Math.sin(t * 0.5) * 0.7) * DEG,
    panX: Math.sin(t * 0.33) * 1.2,
    dolly: t * props.speed,
    cx: BASE_WIDTH / 2,
    cy: BASE_HEIGHT / 2,
  };
};

/** Rising envelope that drives the whole ignition. */
const ignitionEnvelope = (frame: number, duration: number): number =>
  interpolate(frame / duration, [0, 0.18, 0.5, 0.82, 1], [0.05, 0.22, 0.56, 0.88, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.4, 0, 0.35, 1),
  });

/** How lit one structural line is, 0..1. */
const lineIntensity = (axis: number, index: number, env: number, t: number): number => {
  const phase = hash2(axis, index);
  const raw = env * 1.75 - phase * 0.72;
  if (raw <= 0) return 0;
  const lit = Math.min(1, raw);
  // Slow breathing so the lit lines never look like static strokes.
  return lit * (0.86 + 0.14 * Math.sin(t * 2.1 + phase * 31.4));
};

const widthForDepth = (depth: number, base: number): number =>
  Math.max(0.45, Math.min(base * 2.4, (base * 11) / depth));

type Piece = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  depth: number;
};

/**
 * Split the visible stretch of a ground line into pieces so stroke width and
 * opacity can taper with distance — one stroke across a line running to the
 * horizon reads as a flat ribbon.
 */
const linePieces = (
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cam: Camera,
  maxDepth: number,
  count: number,
): Piece[] => {
  const band = depthBand(ax, az, bx, bz, cam, NEAR, maxDepth);
  if (!band) return [];
  const [t0, t1] = band;
  const dx = bx - ax;
  const dz = bz - az;

  const out: Piece[] = [];
  for (let i = 0; i < count; i++) {
    const u0 = t0 + ((t1 - t0) * i) / count;
    const u1 = t0 + ((t1 - t0) * (i + 1)) / count;
    const seg = projectSegment(
      ax + dx * u0,
      az + dz * u0,
      ax + dx * u1,
      az + dz * u1,
      cam,
    );
    if (!seg) continue;
    out.push({
      x1: seg[0].x,
      y1: seg[0].y,
      x2: seg[1].x,
      y2: seg[1].y,
      depth: (seg[0].depth + seg[1].depth) / 2,
    });
  }
  return out;
};

export const NeonGridPlane: React.FC<NeonGridProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;

  const cam = buildCamera(frame, fps, props);
  const env = ignitionEnvelope(frame, durationInFrames);

  const zMin = cam.dolly - Z_BACK;
  const zMax = cam.dolly + Z_AHEAD;
  const xMin = cam.panX - X_REACH;
  const xMax = cam.panX + X_REACH;

  // Snap generation bounds to the grid so panels don't pop as the camera
  // crosses a cell boundary.
  const iMajX0 = Math.floor(xMin / MAJOR);
  const iMajX1 = Math.ceil(xMax / MAJOR);
  const iMajZ0 = Math.floor(zMin / MAJOR);
  const iMajZ1 = Math.ceil(zMax / MAJOR);

  // --- panel faces ---------------------------------------------------------
  // The plane is a field of solar modules. Everything here is static: the cell
  // grid, busbars and corner chamfers never light up or shimmer — only the
  // seams between panels do.
  type VisiblePanel = {
    key: string;
    rect: { x0: number; x1: number; z0: number; z1: number };
    depth: number;
    poly: string;
    screenW: number;
  };

  const visible: VisiblePanel[] = [];
  for (let i = iMajX0; i < iMajX1; i++) {
    for (let j = iMajZ0; j < iMajZ1; j++) {
      const x0 = i * MAJOR + SEAM;
      const x1 = (i + 1) * MAJOR - SEAM;
      const z0 = j * MAJOR + SEAM;
      const z1 = (j + 1) * MAJOR - SEAM;

      // Cheap reject on the centre before projecting the four corners.
      const cxw = (x0 + x1) / 2;
      const czw = (z0 + z1) / 2;
      const depth = depthAt(cxw, czw, cam);
      if (depth < NEAR || depth > PANEL_MAX_DEPTH) continue;

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
      visible.push({
        key: `${i}_${j}`,
        rect: { x0, x1, z0, z1 },
        depth,
        poly: quad.points,
        screenW: quad.maxX - quad.minX,
      });
    }
  }
  // Painter's algorithm: far panels first so near ones overlap them.
  visible.sort((a, b) => b.depth - a.depth);

  const faces: React.ReactNode[] = [];
  const cellDetail: React.ReactNode[] = [];

  for (const panel of visible) {
    const fade = 1 - panel.depth / PANEL_MAX_DEPTH;
    const tint = hash2(Math.round(panel.rect.x0), Math.round(panel.rect.z0));

    faces.push(
      <polygon
        key={`f${panel.key}`}
        points={panel.poly}
        fill="url(#ng-face)"
        opacity={(0.84 + tint * 0.16) * (0.4 + 0.6 * fade)}
      />,
    );

    // Cell detail is pale backsheet showing between the dark cells, so each
    // layer is drawn light over the face rather than as its own cell shapes.
    const gapAlpha = detailFade(panel.depth, GAP_FADE[0], GAP_FADE[1]);
    if (gapAlpha > 0.01 && panel.screenW > 26) {
      const d = gapLinePath(panel.rect, CELL_SPEC, cam);
      if (d) {
        cellDetail.push(
          <path
            key={`cg${panel.key}`}
            d={d}
            fill="none"
            stroke="#8fb3d8"
            strokeWidth={widthForDepth(panel.depth, 0.8)}
            opacity={0.42 * gapAlpha}
          />,
        );
      }
    }

    const busAlpha = detailFade(panel.depth, BUSBAR_FADE[0], BUSBAR_FADE[1]);
    if (busAlpha > 0.01) {
      const d = busbarPath(panel.rect, CELL_SPEC, cam);
      if (d) {
        cellDetail.push(
          <path
            key={`cb${panel.key}`}
            d={d}
            fill="none"
            stroke="#82a5c8"
            strokeWidth={widthForDepth(panel.depth, 0.45)}
            opacity={0.36 * busAlpha}
          />,
        );
      }
    }

    const diamondAlpha = detailFade(panel.depth, DIAMOND_FADE[0], DIAMOND_FADE[1]);
    if (diamondAlpha > 0.01) {
      const d = cornerDiamondPath(panel.rect, CELL_SPEC, cam);
      if (d) {
        cellDetail.push(
          <path
            key={`cd${panel.key}`}
            d={d}
            fill="#a6c6e6"
            opacity={0.5 * diamondAlpha}
          />,
        );
      }
    }
  }

  // --- structural lines ----------------------------------------------------
  // Drawn in passes: the dormant stroke, a wide halo, a mid band, a hot core.
  const dormant: React.ReactNode[] = [];
  const halo: React.ReactNode[] = [];
  const core: React.ReactNode[] = [];

  const emitMajor = (
    key: string,
    ax: number,
    az: number,
    bx: number,
    bz: number,
    intensity: number,
  ) => {
    for (const [n, p] of linePieces(ax, az, bx, bz, cam, MAJOR_MAX_DEPTH, 8).entries()) {
      const fade = 1 - p.depth / MAJOR_MAX_DEPTH;
      dormant.push(
        <line
          key={`d${key}-${n}`}
          x1={p.x1}
          y1={p.y1}
          x2={p.x2}
          y2={p.y2}
          stroke="#c6dcf7"
          strokeWidth={widthForDepth(p.depth, 1.7)}
          opacity={0.42 * fade}
        />,
      );
      if (intensity <= 0.02) continue;
      const lit = intensity * props.glow;
      halo.push(
        <line
          key={`h${key}-${n}`}
          x1={p.x1}
          y1={p.y1}
          x2={p.x2}
          y2={p.y2}
          stroke="#1d7ad8"
          strokeWidth={widthForDepth(p.depth, 11) * (0.5 + lit)}
          strokeLinecap="round"
          opacity={Math.min(0.8, 0.62 * lit * fade)}
        />,
        <line
          key={`m${key}-${n}`}
          x1={p.x1}
          y1={p.y1}
          x2={p.x2}
          y2={p.y2}
          stroke="#5ab6ff"
          strokeWidth={widthForDepth(p.depth, 4.4) * (0.6 + 0.8 * lit)}
          strokeLinecap="round"
          opacity={Math.min(0.95, 0.7 * lit * fade)}
        />,
      );
      core.push(
        <line
          key={`c${key}-${n}`}
          x1={p.x1}
          y1={p.y1}
          x2={p.x2}
          y2={p.y2}
          stroke="#f2faff"
          strokeWidth={widthForDepth(p.depth, 2.3) * (0.7 + 0.6 * lit)}
          strokeLinecap="round"
          opacity={Math.min(1, lit * fade * 1.3)}
        />,
      );
    }
  };

  for (let i = iMajX0; i <= iMajX1; i++) {
    emitMajor(`x${i}`, i * MAJOR, zMin, i * MAJOR, zMax, lineIntensity(0, i, env, t));
  }
  for (let i = iMajZ0; i <= iMajZ1; i++) {
    emitMajor(`z${i}`, xMin, i * MAJOR, xMax, i * MAJOR, lineIntensity(1, i, env, t));
  }

  // --- dust ----------------------------------------------------------------
  const dustSeeds = useMemo(() => {
    const rnd = seeded(0x5eed1);
    return Array.from({ length: props.dustCount }, () => ({
      x: (rnd() - 0.5) * 60,
      y: rnd(),
      z: rnd(),
      size: 0.7 + rnd() * 1.7,
      phase: rnd() * Math.PI * 2,
      drift: 0.25 + rnd() * 0.7,
    }));
  }, [props.dustCount]);

  const dustSpan = 46;
  const dust = dustSeeds.map((d, i) => {
    // Wrap each mote into the band ahead of the camera so the field is endless.
    const wz = cam.dolly - 4 + ((d.z * dustSpan + t * d.drift) % dustSpan);
    const wy = cam.height - (0.1 + d.y * 2.6) - Math.sin(t * 0.7 + d.phase) * 0.12;
    const p = project(d.x + cam.panX, wz, cam, wy);
    if (!p || p.depth > 34) return null;
    if (p.x < -40 || p.x > BASE_WIDTH + 40 || p.y < -40 || p.y > BASE_HEIGHT + 40) {
      return null;
    }
    const r = Math.max(0.7, (d.size * 7) / p.depth);
    const twinkle = 0.35 + 0.6 * Math.abs(Math.sin(t * 1.3 + d.phase));
    return (
      <circle
        key={`dust${i}`}
        cx={p.x}
        cy={p.y}
        r={r}
        fill="#e6f3ff"
        opacity={Math.min(0.95, twinkle * (1 - p.depth / 34))}
      />
    );
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#02040a" }}>
      <svg
        viewBox={`0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`}
        width="100%"
        height="100%"
        style={{ display: "block" }}
      >
        <defs>
          <radialGradient id="ng-sky" cx="50%" cy="72%" r="78%">
            <stop offset="0%" stopColor="#13294a" />
            <stop offset="55%" stopColor="#081428" />
            <stop offset="100%" stopColor="#02060f" />
          </radialGradient>
          <linearGradient id="ng-face" x1="0%" y1="0%" x2="22%" y2="100%">
            <stop offset="0%" stopColor="#132339" />
            <stop offset="45%" stopColor="#0b1626" />
            <stop offset="100%" stopColor="#060c16" />
          </linearGradient>
          <radialGradient id="ng-vignette" cx="50%" cy="50%" r="72%">
            <stop offset="58%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.66" />
          </radialGradient>
          <filter id="ng-bloom" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <filter id="ng-bloom-wide" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="44" />
          </filter>
        </defs>

        <rect width={BASE_WIDTH} height={BASE_HEIGHT} fill="url(#ng-sky)" />

        <g>{faces}</g>
        <g>{cellDetail}</g>
        <g>{dormant}</g>
        <g filter="url(#ng-bloom)" opacity={0.7}>{halo}</g>
        <g>{halo}</g>
        {/* Two blurred copies of the hot core give the neon its falloff. */}
        <g filter="url(#ng-bloom-wide)" opacity={0.9 * env}>{core}</g>
        <g filter="url(#ng-bloom)" opacity={0.95}>{core}</g>
        <g>{core}</g>
        <g>{dust}</g>

        <rect width={BASE_WIDTH} height={BASE_HEIGHT} fill="url(#ng-vignette)" />
      </svg>
    </AbsoluteFill>
  );
};
