import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, getRemotionEnvironment, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { loadFonts } from "./kit/fonts";
import { Post } from "./kit/post";
import { WalletWorld } from "./kit/world";
import { VERSIONS, type Version } from "./versions";

// Builds the world once, then on every frame: update(frame) -> render.
// Rendering happens synchronously in a layout effect, before @remotion/three
// releases the frame, so each screenshot shows exactly this frame.
const World: React.FC<{ version: Version; onReady: () => void }> = ({ version, onReady }) => {
  const frame = useCurrentFrame();
  const { gl, size } = useThree();
  const world = useMemo(() => new WalletWorld(version, gl), [version, gl]);
  const post = useMemo(() => new Post(gl, world.scene, world.camera), [gl, world]);
  const sizing = useRef({ k: 1, w: 1, h: 1 });
  const readyOnce = useRef(false);

  useEffect(() => () => {
    post.dispose();
    world.dispose();
  }, [post, world]);

  useLayoutEffect(() => {
    const k = post.setSize(size.width, size.height);
    const buf = gl.getDrawingBufferSize(new THREE.Vector2());
    sizing.current = { k, w: buf.x, h: buf.y };
  }, [post, gl, size.width, size.height]);

  useLayoutEffect(() => {
    const { k, w, h } = sizing.current;
    world.camera.aspect = size.width / size.height;
    world.camera.updateProjectionMatrix();
    world.update(frame, k, w, h);
    post.setFrame(frame % version.loopFrames, world.focusDistance, 2.4);
    post.render();
    if (!readyOnce.current) {
      readyOnce.current = true;
      onReady();
    }
  }, [frame, world, post, version.loopFrames, size.width, size.height, onReady]);

  // Priority 1 stops R3F from drawing its own default scene over ours. It
  // does not read any clock; all drawing happens in the layout effect above.
  useFrame(() => undefined, 1);
  return null;
};

export const WalletScene: React.FC<{ versionId: string }> = ({ versionId }) => {
  const version = VERSIONS.find((v) => v.id === versionId)!;
  const { width, height } = useVideoConfig();
  const [handle] = useState(() => delayRender("Loading fonts and building the 3D scene"));
  const [fontsReady, setFontsReady] = useState(false);
  const onReady = useMemo(() => () => continueRender(handle), [handle]);

  useEffect(() => {
    loadFonts().then(() => setFontsReady(true));
  }, []);

  // Render at the device pixel ratio Remotion sets from --scale, so a
  // 3840x2160 composition at scale 1/3 draws exactly 1280x720 pixels. In the
  // Studio, cap it to keep software-GL previews responsive.
  const dpr = getRemotionEnvironment().isRendering ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 0.5);

  return (
    <AbsoluteFill style={{ backgroundColor: version.palette.background }}>
      {fontsReady ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          flat
          gl={{ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance", alpha: false, stencil: false }}
        >
          <World version={version} onReady={onReady} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
