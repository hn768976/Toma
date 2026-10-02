import React, { useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useFrame } from "@react-three/fiber";
import { loadAssets } from "./lib/assets";
import { Assets, ColonWorld } from "./three/ColonWorld";
import type { Story } from "./stories/common";
import { storyById } from "./stories";

const Scene: React.FC<{ assets: Assets; story: Story }> = ({ assets, story }) => {
  const frame = useCurrentFrame();
  const world = useMemo(() => new ColonWorld(assets), [assets]);
  // Everything on screen is a pure function of this frame number; the ref only
  // hands it to the render callback (no clock, no state carried between frames).
  const frameRef = useRef(frame);
  frameRef.current = frame;
  useEffect(() => () => world.dispose(), [world]);
  useFrame(({ gl }) => {
    const st = story.update(world, frameRef.current);
    world.render(gl, st.view, st.post);
  }, 1);
  return null;
};

export const ColonComposition: React.FC<{ storyId: string }> = ({ storyId }) => {
  const story = storyById(storyId);
  const { width, height } = useVideoConfig();
  const [assets, setAssets] = useState<Assets | null>(null);
  const [handle] = useState(() => delayRender("Loading colon GLBs + centreline"));
  useEffect(() => {
    loadAssets()
      .then((a) => {
        setAssets(a);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [handle]);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
  return (
    <AbsoluteFill style={{ backgroundColor: "#7C93AA" }}>
      {assets ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          flat
          linear
          gl={{
            antialias: false,
            stencil: true,
            alpha: false,
            depth: true,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance",
          }}
        >
          <Scene assets={assets} story={story} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
