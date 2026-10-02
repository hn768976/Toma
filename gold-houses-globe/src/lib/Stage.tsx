import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { AbsoluteFill, useCurrentFrame, useDelayRender, useRemotionEnvironment, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { loadAssets, type Assets } from "./assets";
import { Post } from "./post";
import type { Look } from "./look";

// Renders one look. Everything visible is computed in update(frame) from
// useCurrentFrame(); R3F's own clock/render loop is switched off (the
// priority-1 useFrame below is a no-op that only stops R3F from drawing).

function Runner<P>({ look, params, assets, dpr, period }: { look: Look<P>; params: P; assets: Assets; dpr: number; period: number }) {
  const frame = useCurrentFrame();
  const { width: compW, height: compH } = useVideoConfig();
  const gl = useThree((s) => s.gl);
  const { delayRender, continueRender } = useDelayRender();
  const width = Math.floor(compW * dpr);
  const height = Math.floor(compH * dpr);

  const inst = useMemo(() => {
    gl.toneMapping = THREE.NoToneMapping;
    gl.autoClear = true;
    return look.create({ gl, width, height, assets, params, period });
  }, [gl, look, params, assets, width, height, period]);
  const post = useMemo(() => new Post(gl, width, height, inst.post), [gl, inst, width, height]);
  useEffect(() => () => { post.dispose(); inst.dispose?.(); }, [post, inst]);

  useFrame(() => undefined, 1);

  const [handle] = useState<{ h: number | null }>(() => ({ h: null }));
  useLayoutEffect(() => {
    handle.h = delayRender(`render frame ${frame}`);
    return () => {
      if (handle.h !== null) continueRender(handle.h);
      handle.h = null;
    };
  }, [frame, handle, delayRender, continueRender]);

  useEffect(() => {
    inst.update(frame);
    inst.scene.updateMatrixWorld(true);
    inst.camera.updateMatrixWorld(true);
    inst.beforeRender?.(gl);
    post.render(inst.scene, inst.camera, frame);
    if (handle.h !== null) {
      continueRender(handle.h);
      handle.h = null;
    }
  }, [frame, inst, post, gl, handle, continueRender]);
  return null;
}

export function Stage<P>({ look, params, period }: { look: Look<P>; params: P; period: number }) {
  const { width, height } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [assets, setAssets] = useState<Assets | null>(null);
  useEffect(() => {
    const h = delayRender("loading assets");
    loadAssets(look.assets)
      .then((a) => { setAssets(a); continueRender(h); })
      .catch((e) => cancelRender(e));
  }, [look, delayRender, continueRender, cancelRender]);

  // Drawing buffer = composition size x render scale. Rounded so that
  // e.g. --scale=1/3 gives exactly 1280x720 (not 1279x719).
  const base = isRendering ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 0.5);
  const dpr = (Math.round(width * base) + 0.001) / width;

  if (!assets) return <AbsoluteFill style={{ backgroundColor: "black" }} />;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        linear
        flat
        gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      >
        <Runner look={look} params={params} assets={assets} dpr={dpr} period={period} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
}
