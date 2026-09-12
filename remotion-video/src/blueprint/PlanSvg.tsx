import React from "react";
import type { Theme } from "./constants";
import {
  WALL_T,
  feetInches,
  squareFeet,
  type DimChain,
  type Opening,
  type Plan,
  type Room,
  type WallSeg,
} from "./planGen";
import { BLUEPRINT_FONT_FAMILY } from "../load-fonts";

/**
 * Draws a generated Plan as SVG, in plan units (inches). The caller sizes the
 * <svg> and applies the 3D transform; nothing here knows about the camera.
 */

type Vec = { x: number; y: number };

/** Unit direction and left-hand normal of a wall segment. */
const frame = (s: WallSeg): { d: Vec; n: Vec; o: Vec; len: number } => {
  const o = { x: s.x1, y: s.y1 };
  if (s.vertical) {
    const len = s.y2 - s.y1;
    return { d: { x: 0, y: 1 }, n: { x: 1, y: 0 }, o, len };
  }
  const len = s.x2 - s.x1;
  return { d: { x: 1, y: 0 }, n: { x: 0, y: 1 }, o, len };
};

const at = (o: Vec, d: Vec, n: Vec, along: number, off: number): Vec => ({
  x: o.x + d.x * along + n.x * off,
  y: o.y + d.y * along + n.y * off,
});

/** Spans of wall left solid once the openings are punched out. */
const solidRuns = (len: number, openings: Opening[]) => {
  const runs: [number, number][] = [];
  let cursor = 0;
  for (const op of openings) {
    if (op.at > cursor) runs.push([cursor, op.at]);
    cursor = Math.max(cursor, op.at + op.len);
  }
  if (cursor < len) runs.push([cursor, len]);
  return runs;
};

const Walls: React.FC<{ plan: Plan; theme: Theme }> = ({ plan, theme }) => {
  const heavyPath: string[] = [];
  const lightPath: string[] = [];
  const detailPath: string[] = [];

  for (const seg of plan.walls) {
    const wallPath = seg.heavy ? heavyPath : lightPath;
    const { d, n, o, len } = frame(seg);
    const half = WALL_T / 2;

    // The two parallel faces of the wall, broken at every opening.
    for (const [a, b] of solidRuns(len, seg.openings)) {
      for (const side of [-half, half]) {
        const p = at(o, d, n, a, side);
        const q = at(o, d, n, b, side);
        wallPath.push(`M${p.x} ${p.y}L${q.x} ${q.y}`);
      }
    }

    for (const op of seg.openings) {
      // Jamb caps close the wall off at each side of the opening.
      for (const along of [op.at, op.at + op.len]) {
        const p = at(o, d, n, along, -half);
        const q = at(o, d, n, along, half);
        wallPath.push(`M${p.x} ${p.y}L${q.x} ${q.y}`);
      }

      if (op.kind === "window") {
        // Glazing: the wall faces continue across as hairlines, plus a
        // centre line — the standard plan symbol for a window.
        for (const side of [-half, 0, half]) {
          const p = at(o, d, n, op.at, side);
          const q = at(o, d, n, op.at + op.len, side);
          detailPath.push(`M${p.x} ${p.y}L${q.x} ${q.y}`);
        }
        continue;
      }

      // Door: leaf perpendicular to the wall at the hinge, swing arc back to
      // the far jamb.
      const hingeAlong = op.hinge === 0 ? op.at : op.at + op.len;
      const farAlong = op.hinge === 0 ? op.at + op.len : op.at;
      const hinge = at(o, d, n, hingeAlong, 0);
      const leafEnd = at(o, d, n, hingeAlong, op.swing * op.len);
      const far = at(o, d, n, farAlong, 0);

      const u = { x: leafEnd.x - hinge.x, y: leafEnd.y - hinge.y };
      const v = { x: far.x - hinge.x, y: far.y - hinge.y };
      // In SVG's y-down space a positive cross product is a clockwise turn,
      // which is exactly what sweep-flag 1 means.
      const sweep = u.x * v.y - u.y * v.x > 0 ? 1 : 0;

      detailPath.push(`M${hinge.x} ${hinge.y}L${leafEnd.x} ${leafEnd.y}`);
      detailPath.push(
        `M${leafEnd.x} ${leafEnd.y}A${op.len} ${op.len} 0 0 ${sweep} ${far.x} ${far.y}`,
      );
    }
  }

  return (
    <>
      <path
        d={detailPath.join("")}
        fill="none"
        stroke={theme.detail}
        strokeWidth={theme.wallStroke * 0.6}
        strokeLinecap="round"
      />
      <path
        d={lightPath.join("")}
        fill="none"
        stroke={theme.wall}
        strokeWidth={theme.wallStroke * 0.78}
        strokeLinecap="square"
        opacity={theme.partitions}
      />
      <path
        d={heavyPath.join("")}
        fill="none"
        stroke={theme.wall}
        strokeWidth={theme.wallStroke}
        strokeLinecap="square"
      />
      {/* A hotter core inside the heavy runs. Neon reads as neon because the
          centre of the stroke blows out, not because the glow is wider. */}
      {theme.core ? (
        <path
          d={heavyPath.join("")}
          fill="none"
          stroke={theme.core}
          strokeWidth={theme.wallStroke * 0.34}
          strokeLinecap="square"
        />
      ) : null}
    </>
  );
};

const RoomFurniture: React.FC<{ rooms: Room[]; theme: Theme }> = ({
  rooms,
  theme,
}) => {
  const path: string[] = [];
  for (const room of rooms) {
    const { x, y, w, h } = room.rect;
    const pad = WALL_T + 5;

    if (room.kind === "stair") {
      const run = room.stairVertical ? h - pad * 2 : w - pad * 2;
      const treads = Math.max(4, Math.floor(run / 11));
      const step = run / treads;
      for (let i = 1; i < treads; i++) {
        if (room.stairVertical) {
          const ty = y + pad + i * step;
          path.push(`M${x + pad} ${ty}L${x + w - pad} ${ty}`);
        } else {
          const tx = x + pad + i * step;
          path.push(`M${tx} ${y + pad}L${tx} ${y + h - pad}`);
        }
      }
      // Direction-of-travel line up the middle of the run.
      if (room.stairVertical) {
        path.push(`M${x + w / 2} ${y + pad}L${x + w / 2} ${y + h - pad}`);
      } else {
        path.push(`M${x + pad} ${y + h / 2}L${x + w - pad} ${y + h / 2}`);
      }
      continue;
    }

    for (const f of room.fixtures) {
      path.push(
        `M${f.x} ${f.y}L${f.x + f.w} ${f.y}L${f.x + f.w} ${f.y + f.h}L${f.x} ${f.y + f.h}Z`,
      );
    }

    if (room.kind === "shaft") {
      path.push(
        `M${x + pad} ${y + pad}L${x + w - pad} ${y + h - pad}`,
        `M${x + w - pad} ${y + pad}L${x + pad} ${y + h - pad}`,
      );
    }
  }

  return (
    <path
      d={path.join("")}
      fill="none"
      stroke={theme.detail}
      strokeWidth={theme.wallStroke * 0.55}
    />
  );
};

const Chains: React.FC<{ chains: DimChain[]; theme: Theme }> = ({
  chains,
  theme,
}) => {
  const lines: string[] = [];
  const tick = 7;

  for (const c of chains) {
    lines.push(`M${c.x1} ${c.y1}L${c.x2} ${c.y2}`);
    if (c.vertical) {
      for (const y of [c.y1, c.y2]) {
        // 45-degree slash tick, the drafting convention for a dimension stop.
        lines.push(`M${c.x1 - tick} ${y + tick}L${c.x1 + tick} ${y - tick}`);
        lines.push(`M${c.x1} ${y}L${c.x1 + c.whisker} ${y}`);
      }
    } else {
      for (const x of [c.x1, c.x2]) {
        lines.push(`M${x - tick} ${c.y1 + tick}L${x + tick} ${c.y1 - tick}`);
        lines.push(`M${x} ${c.y1}L${x} ${c.y1 + c.whisker}`);
      }
    }
  }

  return (
    <>
      <path
        d={lines.join("")}
        fill="none"
        stroke={theme.hairline}
        strokeWidth={theme.hairStroke}
      />
      {chains.map((c, i) => {
        const mx = (c.x1 + c.x2) / 2;
        const my = (c.y1 + c.y2) / 2;
        return (
          <text
            key={i}
            x={mx}
            y={my}
            transform={
              c.vertical
                ? `rotate(-90 ${mx} ${my}) translate(0 -11)`
                : `translate(0 -11)`
            }
            textAnchor="middle"
            fill={theme.text}
            fontFamily={BLUEPRINT_FONT_FAMILY}
            fontSize={19}
            fontWeight={500}
            letterSpacing={0.6}
          >
            {c.text}
          </text>
        );
      })}
    </>
  );
};

export const PlanSvg: React.FC<{
  plan: Plan;
  theme: Theme;
  /** Padding around the plan bounds, in plan units. */
  pad: number;
  dots: boolean;
  id: string;
}> = ({ plan, theme, pad, dots, id }) => {
  const { bounds } = plan;
  const vb = [
    bounds.x - pad,
    bounds.y - pad,
    bounds.w + pad * 2,
    bounds.h + pad * 2,
  ].join(" ");

  return (
    <svg
      viewBox={vb}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ overflow: "visible" }}
    >
      <defs>
        <pattern
          id={`${id}-dots`}
          width={13}
          height={13}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={0.9} cy={0.9} r={0.85} fill={theme.dot} />
        </pattern>
      </defs>

      {dots ? (
        <rect
          x={bounds.x - pad}
          y={bounds.y - pad}
          width={bounds.w + pad * 2}
          height={bounds.h + pad * 2}
          fill={`url(#${id}-dots)`}
        />
      ) : null}

      <Chains chains={plan.chains} theme={theme} />
      <RoomFurniture rooms={plan.rooms} theme={theme} />
      <Walls plan={plan} theme={theme} />

      {plan.labels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={l.y}
          transform={l.angle ? `rotate(${l.angle} ${l.x} ${l.y})` : undefined}
          textAnchor="middle"
          fill={l.strong ? theme.textStrong : theme.text}
          fontFamily={BLUEPRINT_FONT_FAMILY}
          fontSize={l.size}
          fontWeight={l.strong ? 500 : 400}
          letterSpacing={l.strong ? 1.1 : 0.5}
        >
          {l.text}
        </text>
      ))}
    </svg>
  );
};

export { feetInches, squareFeet };
