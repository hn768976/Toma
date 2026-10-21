import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { findSegment, Pack, PACKS, validatePack } from "./data";
import { MOVE_NAMES, MOVES } from "./moves";
import { STAGES } from "./moves/types";
import { Pipeline } from "./three/Pipeline";
import { StudioScene } from "./three/StudioScene";

const CSS_BG: Record<Pack["background"], string> = {
  white: "#F4F5F7",
  black: "#000000",
  graphite: "#0B0C0E",
  green: "#00FF00",
};

// Lives inside the R3F tree, so the shot and the render happen in one commit.
const PackShot: React.FC<{ pack: Pack }> = ({ pack }) => {
  const frame = useCurrentFrame();
  const seg = findSegment(pack, frame);
  const stage = STAGES[pack.background];
  const shot = MOVES[seg.move]({
    f: frame - seg.start,
    L: seg.length,
    g: frame,
    n: seg.phones,
    params: seg.params ?? {},
    stage,
  });
  return (
    <>
      <StudioScene background={pack.background} camera={shot.camera} phones={shot.phones} globalFrame={frame} />
      <Pipeline frame={frame} />
    </>
  );
};

export const PhonePack: React.FC<{ packId: string }> = ({ packId }) => {
  const { width, height } = useVideoConfig();
  const pack = useMemo(() => {
    const p = PACKS.find((x) => x.id === packId);
    if (!p) {
      throw new Error(`Unknown pack ${packId}`);
    }
    validatePack(p, MOVE_NAMES);
    return p;
  }, [packId]);

  // Make the drawing buffer an exact integer size at any --scale
  // (three floors width * dpr, and 3840 * 0.3333 would floor to 1279).
  const raw = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  const dpr = (Math.round(width * raw) + 0.25) / width;

  return (
    <AbsoluteFill style={{ backgroundColor: CSS_BG[pack.background] }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        flat
        linear
        shadows={false}
        gl={{ antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: "high-performance" }}
      >
        <PackShot pack={pack} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
