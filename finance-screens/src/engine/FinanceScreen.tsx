import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useLayoutEffect, useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import { loadAssets, type Assets } from "./assets";
import { Pipeline } from "./Pipeline";
import { LOOP } from "./rng";
import type { LookInstance } from "../looks/types";
import { buildLook, type Version } from "../versions";

// Renders one composition. <ThreeCanvas> (from @remotion/three) owns the
// WebGL2 context and Remotion's per-frame sync; inside it, <FrameRenderer>
// redraws everything from useCurrentFrame() alone in a layout effect:
// canvases -> textures -> scene -> DoF -> bloom -> grain/dither.
// R3F's own render of its (empty) default scene is a no-op because
// autoClear is off.

const FrameRenderer: React.FC<{
  version: Version;
  assets: Assets;
  width: number;
  height: number;
  onFirstFrame: () => void;
}> = ({ version, assets, width, height, onFirstFrame }) => {
  const { gl } = useThree();
  const frame = useCurrentFrame();
  const dpr = Math.min(1, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  const W = Math.round(width * dpr);
  const H = Math.round(height * dpr);
  const firstDone = useRef(false);

  const { pipeline, look } = useMemo(() => {
    gl.autoClear = false;
    gl.setPixelRatio(1);
    gl.setSize(W, H, false);
    const p = new Pipeline(gl);
    p.setSize(W, H);
    const l: LookInstance = buildLook(version, {
      W,
      H,
      q: W / 3840,
      maxAniso: gl.capabilities.getMaxAnisotropy(),
      maxTex: gl.capabilities.maxTextureSize,
      assets,
    });
    return { pipeline: p, look: l };
  }, [gl, W, H, version, assets]);

  useLayoutEffect(() => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    if (size.x !== W || size.y !== H) {
      gl.setPixelRatio(1);
      gl.setSize(W, H, false);
    }
    gl.autoClear = false;
    // Every motion is periodic in 600 frames by construction; evaluating it at
    // frame % 600 makes frame 600 bit-identical to frame 0 (otherwise phase
    // 1.0 vs 0.0 differs in the last float bits of texture coordinates).
    const f = ((frame % LOOP) + LOOP) % LOOP;
    look.update(f);
    pipeline.render(look.scene, look.camera, look.post, f);
    if (!firstDone.current) {
      firstDone.current = true;
      onFirstFrame();
    }
  }, [frame, gl, look, pipeline, W, H, onFirstFrame]);

  return null;
};

export const FinanceScreen: React.FC<{ version: Version }> = ({ version }) => {
  const { width, height } = useVideoConfig();
  const { delayRender, continueRender } = useDelayRender();
  const [handle] = useState(() => delayRender(`Loading fonts + map for ${version.id}`));
  const [assets, setAssets] = useState<Assets | null>(null);
  const continued = useRef(false);

  useEffect(() => {
    loadAssets().then(setAssets);
  }, []);

  const onFirstFrame = React.useCallback(() => {
    if (!continued.current) {
      continued.current = true;
      continueRender(handle);
    }
  }, [continueRender, handle]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {assets ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={Math.min(1, window.devicePixelRatio || 1)}
          gl={{
            antialias: false,
            alpha: false,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance",
          }}
          flat
          linear
        >
          <FrameRenderer
            version={version}
            assets={assets}
            width={width}
            height={height}
            onFirstFrame={onFirstFrame}
          />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
