import React, { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide } from "three";
import {
  GUIDE_LINES,
  INPUT_PATHS,
  INPUT_STUBS,
  JUNCTIONS,
  NEXT_PATHS,
  OUTPUT_PATHS,
  T,
  WORKFLOW_PATHS,
  type FlowPath,
} from "../layout";
import type { Palette } from "../theme";
import { clamp01, easeOut, hexToRgb, prog } from "../util";
import { FloorMeshBuilder, roundCorners, sampleAt, toPolyline } from "./lineGeometry";

const ALL_PATHS: FlowPath[] = [...INPUT_STUBS, ...INPUT_PATHS, ...WORKFLOW_PATHS, ...OUTPUT_PATHS, ...NEXT_PATHS];
const STARTS_WITH_DOT = new Set([...INPUT_STUBS, ...INPUT_PATHS, ...NEXT_PATHS]);

const DASH = 0.15;
const GAP = 0.15;
const WIDTH = 0.07;
const FLOW_SPEED = 0.045; // floor units per frame

const unit = (hex: string): [number, number, number] => {
  const [r, g, b] = hexToRgb(hex);
  return [r / 255, g / 255, b / 255];
};

/** Animated dashed data lines, arrowheads, junction dots and faint guides. */
export const FlowLines: React.FC<{ pal: Palette }> = ({ pal }) => {
  const frame = useCurrentFrame();
  const polylines = useMemo(() => ALL_PATHS.map((p) => toPolyline(roundCorners(p.pts, 0.7))), []);
  const guides = useMemo(() => GUIDE_LINES.map((g) => ({ pl: toPolyline(g.pts), a: g.a })), []);

  const geometry = useMemo(() => new BufferGeometry(), []);

  const data = useMemo(() => {
    const b = new FloorMeshBuilder(0.03);
    const line = unit(pal.line);
    const prim = unit(pal.primary);

    // Faint etched guides.
    const gp = prog(frame, T.guideLines, 45, easeOut);
    guides.forEach(({ pl, a }) => {
      b.solid(pl, pl.length * gp, 0.035, [prim[0] * a * 0.7, prim[1] * a * 0.7, prim[2] * a * 0.7]);
    });

    ALL_PATHS.forEach((path, i) => {
      const pl = polylines[i];
      const p = prog(frame, path.start, path.dur, easeOut);
      const fade = path.fadeOut ? 1 - prog(frame, path.fadeOut[0], path.fadeOut[1] - path.fadeOut[0]) : 1;
      if (p <= 0 || fade <= 0) return;
      const col: [number, number, number] = [line[0] * fade, line[1] * fade, line[2] * fade];
      const reveal = pl.length * p;
      const phase = -frame * FLOW_SPEED;
      // A brighter packet travels along each line once it is drawn.
      const packet = ((frame - path.start) * 0.12) % (pl.length + 6);
      b.dashes(pl, reveal, DASH, GAP, WIDTH, phase, col, (s) => {
        const d = Math.abs(s - packet);
        return 0.34 + 0.6 * Math.max(0, 1 - d / 1.2) + (s > reveal - 0.6 ? 0.4 : 0);
      });
      if (path.arrow) {
        const { p: tip, d } = sampleAt(pl, reveal);
        b.arrow(tip, d, 0.42, [col[0] * 0.9, col[1] * 0.9, col[2] * 0.9]);
      }
      // Start-of-line connector dot.
      if (STARTS_WITH_DOT.has(path)) {
        b.disc(pl.pts[0], 0.11, col);
      }
    });

    JUNCTIONS.forEach(({ p, at }) => {
      const k = clamp01((frame - at) / 8);
      if (k <= 0) return;
      b.disc(p, 0.17 * k, [line[0] * 1.4, line[1] * 1.4, line[2] * 1.4]);
    });

    return b.build();
  }, [frame, pal, polylines, guides]);

  useLayoutEffect(() => {
    geometry.setAttribute("position", new BufferAttribute(data.positions, 3));
    geometry.setAttribute("color", new BufferAttribute(data.colors, 3));
    geometry.computeBoundingSphere();
  }, [data, geometry]);

  // Layout effects run before ThreeCanvas's advance() (a passive effect),
  // so the new attributes are always in place for this frame's render.
  return (
    <mesh geometry={geometry} renderOrder={1} frustumCulled={false}>
      <meshBasicMaterial
        vertexColors
        side={DoubleSide}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        fog={false}
        blending={AdditiveBlending}
      />
    </mesh>
  );
};
