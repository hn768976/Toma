import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import type { Font } from "opentype.js";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import type { AcronymRow } from "./data/acronyms";
import { loadFont } from "./lib/font";
import { buildWorld } from "./scene/world";

export type AcronymCubesProps = {
  row: AcronymRow;
  /** Only for the loop self-test: renders 601 frames instead of 600. */
  loopTest?: boolean;
  /** Log per-stage GPU timings to the browser console. */
  profile?: boolean;
};

/**
 * Renders inside the R3F canvas, but owns the frame: every value on screen is
 * derived from useCurrentFrame() in a layout effect, then drawn through the
 * custom post pipeline. R3F's own render loop is disabled (priority-1 no-op).
 */
const Scene: React.FC<{ row: AcronymRow; font: Font; profile: boolean; onFirstFrame: () => void }> = ({
  row,
  font,
  profile,
  onFirstFrame,
}) => {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const frame = useCurrentFrame();
  const world = useMemo(() => buildWorld(gl, row, font, profile), [gl, row, font, profile]);
  const first = useRef(true);

  useEffect(() => () => world.dispose(), [world]);
  useFrame(() => undefined, 1);

  useLayoutEffect(() => {
    const w = gl.domElement.width;
    const h = gl.domElement.height;
    world.update(frame);
    world.render(frame, w, h);
    if (first.current) {
      first.current = false;
      onFirstFrame();
    }
  }, [frame, world, gl, size, onFirstFrame]);

  return null;
};

export const AcronymCubes: React.FC<AcronymCubesProps> = ({ row, profile = false }) => {
  const { width, height } = useVideoConfig();
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender(`Loading font and building ${row.word}`));
  const [font, setFont] = useState<Font | null>(null);

  useEffect(() => {
    loadFont().then(setFont).catch((e) => cancelRender(e));
  }, [cancelRender]);

  const onFirstFrame = useMemo(() => {
    let done = false;
    return () => {
      if (!done) {
        done = true;
        continueRender(handle);
      }
    };
  }, [continueRender, handle]);

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {font ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          flat
          linear
          gl={{ antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: "high-performance" }}
        >
          <Scene row={row} font={font} profile={profile} onFirstFrame={onFirstFrame} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
