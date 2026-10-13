import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  getRemotionEnvironment,
  useCurrentFrame,
} from "remotion";
import { HEIGHT, LOOP, WIDTH } from "./constants";
import { loadMonoFont } from "./fonts";
import { Pipeline } from "./pipeline";
import type { WorldFactory } from "./world";

const WorldView: React.FC<{ factory: WorldFactory; t: number }> = ({
  factory,
  t,
}) => {
  const gl = useThree((s) => s.gl);
  const world = useMemo(() => factory(gl), [factory, gl]);
  const pipe = useRef<Pipeline | null>(null);
  // Set during React render, read in the render callback: the frame drawn is
  // always the frame Remotion asked for.
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => () => pipe.current?.dispose(), []);

  // useFrame is used only as R3F's render hook (priority 1 replaces R3F's
  // own render). Its clock/delta are never read.
  useFrame(() => {
    const p = pipe.current;
    const bw = gl.domElement.width;
    const bh = gl.domElement.height;
    if (!p || p.width !== bw || p.height !== bh) {
      p?.dispose();
      pipe.current = new Pipeline(gl, world.post);
    }
    const cur = pipe.current!;
    world.update(tRef.current, cur.pxScale);
    cur.render(world.scene, world.camera, world.overlay, tRef.current);
  }, 1);
  return null;
};

/** Gate: fonts (for canvas-texture text) must be loaded before any frame. */
const useAssetsReady = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadMonoFont().then(() => setReady(true));
  }, []);
  // Release only after the commit that mounts <ThreeCanvas/>, whose own
  // delayRender() then holds the frame until three.js has drawn it.
  useEffect(() => {
    if (ready) continueRender(handle);
  }, [ready, handle]);
  return ready;
};

export const Stage: React.FC<{ factory: WorldFactory; background: string }> = ({
  factory,
  background,
}) => {
  const frame = useCurrentFrame();
  const t = frame % LOOP; // frame 600 === frame 0, exactly
  const ready = useAssetsReady();
  const env = getRemotionEnvironment();
  // Rendering: draw at the real output size (--scale sets devicePixelRatio).
  // Studio: a lighter buffer to keep scrubbing responsive.
  const dpr =
    typeof window === "undefined"
      ? 1
      : env.isRendering
        ? window.devicePixelRatio
        : Math.min(window.devicePixelRatio, 0.5);
  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      {ready ? (
        <ThreeCanvas
          width={WIDTH}
          height={HEIGHT}
          dpr={dpr}
          flat
          linear
          gl={{
            antialias: false,
            alpha: false,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance",
          }}
        >
          <WorldView factory={factory} t={t} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
