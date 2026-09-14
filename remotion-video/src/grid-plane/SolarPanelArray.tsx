import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { BASE_HEIGHT, BASE_WIDTH } from "./constants";
import {
  Camera,
  project,
  projectPolygon,
  projectPolygon3,
  projectSegment,
} from "./camera";
import {
  busbarPath,
  CellSpec,
  cornerDiamondPath,
  detailFade,
  gapLinePath,
  strokeFor,
} from "./solar-surface";
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

/** One module's footprint, and the gap left between neighbours. */
const PANEL_W = 4.0;
const PANEL_D = 1.35;
const GAP = 0.1;

/**
 * How far the module stands proud of its mounting plane — an aluminium frame
 * is roughly this fraction of the panel's width, and drawing the resulting
 * side walls is what makes the array read as solid objects rather than tiles
 * painted on the floor.
 */
const PANEL_LIFT = 0.17;

/**
 * Cells on the face of a single panel. The panel is ~3:1, so 14 x 5 keeps the
 * individual cells square, as they are on a real module.
 */
const CELL_SPEC: CellSpec = {
  cellsX: 14,
  cellsZ: 5,
  busbars: 2,
  diamond: 0.115,
};

/** Depths at which each kind of cell detail is fully drawn / fully gone. */
const DIAMOND_FADE: [number, number] = [9, 21];
const BUSBAR_FADE: [number, number] = [7, 17];
const GAP_FADE: [number, number] = [16, 38];

/** How far out geometry is generated, relative to the camera. */
const X_REACH = 78;
const Z_BACK = 12;
const Z_AHEAD = 90;

const PANEL_MAX_DEPTH = 62;

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

/** Aluminium, shaded by which way the frame wall faces. */
const WALL_NEAR = "#93aecb";
const WALL_SIDE = "#5c738f";
const WALL_FAR = "#31415a";

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
  const topY = cam.height - PANEL_LIFT;

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
        topY,
      );
      if (!quad) continue;
      const centre = project((x0 + x1) / 2, (z0 + z1) / 2, cam, topY);
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

  // --- modules: deck, frame walls, glass, cell detail -----------------------
  // Each module is a slab standing PANEL_LIFT above the mounting plane. All
  // four frame walls are emitted, then the glass on top: walls facing away
  // project inside the top face's silhouette and are covered by it, so the
  // drawing order does the hidden-surface removal for free.
  const deck: React.ReactNode[] = [];
  const walls: React.ReactNode[] = [];
  const faces: React.ReactNode[] = [];
  const cells: React.ReactNode[] = [];
  const edges: React.ReactNode[] = [];

  for (const p of panels) {
    const fade = 1 - p.depth / PANEL_MAX_DEPTH;
    // A little per-panel variation stops the array reading as a printed texture.
    const tint = hash2(p.row, p.col);
    const rect = { x0: p.x0, x1: p.x1, z0: p.z0, z1: p.z1 };

    // Mounting plane under this module, out to half the gap on every side, so
    // neighbouring decks tile exactly and the gaps read as shadowed recesses.
    const half = GAP / 2;
    const deckQuad = projectPolygon(
      [
        [p.x0 - half, p.z0 - half],
        [p.x1 + half, p.z0 - half],
        [p.x1 + half, p.z1 + half],
        [p.x0 - half, p.z1 + half],
      ],
      cam,
    );
    if (deckQuad) {
      deck.push(
        <polygon
          key={`k${p.key}`}
          points={deckQuad.points}
          fill="#050b16"
          opacity={0.3 + 0.6 * fade}
        />,
      );
    }

    // Frame walls, from the top edge down to the mounting plane.
    const wall = (
      id: string,
      ax: number,
      az: number,
      bx: number,
      bz: number,
      colour: string,
      shade: number,
    ) => {
      const q = projectPolygon3(
        [
          [ax, topY, az],
          [bx, topY, bz],
          [bx, cam.height, bz],
          [ax, cam.height, az],
        ],
        cam,
      );
      if (!q) return;
      walls.push(
        <polygon
          key={`w${id}${p.key}`}
          points={q.points}
          fill={colour}
          opacity={shade * (0.4 + 0.6 * fade)}
        />,
      );
    };
    // z0 is the edge nearest the lens, so its wall faces the camera and takes
    // the light; the far wall is almost always hidden behind the glass.
    wall("n", p.x0, p.z0, p.x1, p.z0, WALL_NEAR, 0.95);
    wall("l", p.x0, p.z1, p.x0, p.z0, WALL_SIDE, 0.8);
    wall("r", p.x1, p.z0, p.x1, p.z1, WALL_SIDE, 0.66);
    wall("f", p.x1, p.z1, p.x0, p.z1, WALL_FAR, 0.7);

    faces.push(
      <polygon
        key={`f${p.key}`}
        points={p.poly}
        fill="url(#sp-face)"
        opacity={(0.82 + tint * 0.18) * (0.4 + 0.6 * fade)}
      />,
    );

    // Cell detail is pale backsheet showing between the dark cells, so each
    // layer is drawn light over the face rather than as its own cell shapes.
    const gapAlpha = detailFade(p.depth, GAP_FADE[0], GAP_FADE[1]);
    if (gapAlpha > 0.01 && p.screenW > 26) {
      const d = gapLinePath(rect, CELL_SPEC, cam, topY);
      if (d) {
        const s = strokeFor(p.depth, 0.85);
        cells.push(
          <path
            key={`cg${p.key}`}
            d={d}
            fill="none"
            stroke="#9dbcdd"
            strokeWidth={s.width}
            opacity={0.5 * gapAlpha * s.alpha}
          />,
        );
      }
    }

    const busAlpha = detailFade(p.depth, BUSBAR_FADE[0], BUSBAR_FADE[1]);
    if (busAlpha > 0.01) {
      const d = busbarPath(rect, CELL_SPEC, cam, topY);
      if (d) {
        const s = strokeFor(p.depth, 0.5);
        cells.push(
          <path
            key={`cb${p.key}`}
            d={d}
            fill="none"
            stroke="#8fb0d4"
            strokeWidth={s.width}
            opacity={0.34 * busAlpha * s.alpha}
          />,
        );
      }
    }

    const diamondAlpha = detailFade(p.depth, DIAMOND_FADE[0], DIAMOND_FADE[1]);
    if (diamondAlpha > 0.01) {
      const d = cornerDiamondPath(rect, CELL_SPEC, cam, topY);
      if (d) {
        cells.push(
          <path
            key={`cd${p.key}`}
            d={d}
            fill="#b3cee9"
            opacity={0.62 * diamondAlpha}
          />,
        );
      }
    }

    // The top lip of the frame, catching the light.
    const lip = strokeFor(p.depth, 1.2);
    edges.push(
      <polygon
        key={`e${p.key}`}
        points={p.poly}
        fill="none"
        stroke="#d8ecff"
        strokeWidth={lip.width}
        strokeLinejoin="round"
        opacity={Math.min(0.9, 0.45 + 0.5 * fade) * lip.alpha}
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

      const seg = projectSegment(p.x0, p.z0, p.x0, p.z1, cam, topY);
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
          strokeWidth={Math.max(1, widthForDepth(p.depth, 2.0))}
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
            <stop offset="0%" stopColor="#16273f" />
            <stop offset="42%" stopColor="#0d1a2c" />
            <stop offset="100%" stopColor="#070e1a" />
          </linearGradient>
          <radialGradient id="sp-sky" cx="50%" cy="78%" r="82%">
            <stop offset="0%" stopColor="#133c76" />
            <stop offset="48%" stopColor="#091c3c" />
            <stop offset="100%" stopColor="#02070f" />
          </radialGradient>
          <radialGradient id="sp-key" cx={`${keyX}%`} cy={`${keyY}%`} r="52%">
            <stop offset="0%" stopColor="#a8d2ff" stopOpacity="0.5" />
            <stop offset="58%" stopColor="#5b9ae8" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sp-vignette" cx="50%" cy="52%" r="70%">
            <stop offset="44%" stopColor="#000510" stopOpacity="0" />
            <stop offset="100%" stopColor="#000510" stopOpacity="0.88" />
          </radialGradient>
          <filter id="sp-bloom" filterUnits="userSpaceOnUse" x="-220" y="-220" width="2360" height="1520">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="sp-bloom-wide" filterUnits="userSpaceOnUse" x="-220" y="-220" width="2360" height="1520">
            <feGaussianBlur stdDeviation="40" />
          </filter>
        </defs>

        <rect width={BASE_WIDTH} height={BASE_HEIGHT} fill="url(#sp-sky)" />

        <g>{deck}</g>
        <g>{walls}</g>
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
