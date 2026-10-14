import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useRemotionEnvironment, useVideoConfig } from "remotion";
import { CellEngine } from "./cells/CellEngine";
import { buildDivisionScene } from "./cells/divisionScene";
import { buildFieldScene } from "./cells/fieldScene";
import type { CellSceneDef } from "./cells/types";
import { BandsEngine } from "./bands/BandsEngine";
import { ROWS, type BandRow, type CellRow } from "./data/versions";

// Layouts are generated once per row from the row's seed and cached.
const defCache = new Map<string, CellSceneDef>();
const getDef = (row: CellRow): CellSceneDef => {
  let d = defCache.get(row.id);
  if (!d) {
    d =
      row.look === "division"
        ? buildDivisionScene({ seed: row.seed, frames: row.frames })
        : buildFieldScene({ seed: row.seed, loopFrames: row.loopFrames, fragments: !!row.fragments, hero: row.look === "hero" });
    defCache.set(row.id, d);
  }
  return d;
};

// Each frame is rendered from the Remotion frame number alone. The R3F
// render loop only tells us *when* to draw (priority 1 takes over
// rendering); its clock is never read.
const CellDriver: React.FC<{ row: CellRow; isolate?: boolean; profile?: boolean }> = ({ row, isolate, profile }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);
  const engine = useMemo(() => new CellEngine(gl, getDef(row), row.colors, row.loopFrames), [gl, row]);
  engine.isolate = !!isolate;
  engine.profile = !!profile;
  useEffect(() => () => engine.dispose(), [engine]);
  useFrame(() => engine.render(frameRef.current), 1);
  return null;
};

const BandsDriver: React.FC<{ row: BandRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);
  const engine = useMemo(() => new BandsEngine(gl, row.colors, row.seed, row.loopFrames), [gl, row]);
  useEffect(() => () => engine.dispose(), [engine]);
  useFrame(() => engine.render(frameRef.current), 1);
  return null;
};

export type SceneProps = { rowId: string; durationOverride?: number; isolate?: boolean; profile?: boolean };

export const VersionScene: React.FC<SceneProps> = ({ rowId, isolate, profile }) => {
  const { width, height } = useVideoConfig();
  const env = useRemotionEnvironment();
  const row = ROWS.find((r) => r.id === rowId);
  if (!row) throw new Error(`Unknown row ${rowId}`);
  // When rendering, match Remotion's --scale (device scale factor). In the
  // Studio, render at half the composition size to keep it interactive.
  const dpr = env.isRendering ? window.devicePixelRatio : 0.5;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        flat
        linear
        gl={{ preserveDrawingBuffer: true, antialias: false, alpha: false, depth: true, stencil: false }}
      >
        {row.look === "bands" ? <BandsDriver row={row} /> : <CellDriver row={row} isolate={isolate} profile={profile} />}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
