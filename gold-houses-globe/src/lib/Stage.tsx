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
  const { isRendering } = useRemotionEnvironment();
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

  const [warm] = useState<{ done: boolean; p: Promise<void> | null }>(() => ({ done: false, p: null }));
  useEffect(() => {
    const draw = (f: number) => {
      inst.update(f);
      inst.scene.updateMatrixWorld(true);
      inst.camera.updateMatrixWorld(true);
      inst.beforeRender?.(gl);
      post.render(inst.scene, inst.camera, f);
    };
    const finish = () => {
      draw(frame);
      if (handle.h !== null) {
        continueRender(handle.h);
        handle.h = null;
      }
    };
    if (warm.done || !isRendering) return finish();
    // Pipeline warm-up, once per browser tab. ANGLE first draws with quickly
    // linked GPU pipelines and swaps in optimised ones compiled in the
    // background; the two can differ in the last bit. Drawing a spread of
    // frames and waiting lets the optimised pipelines land before the first
    // real frame, so a frame rendered cold matches the same frame rendered
    // mid-sequence byte for byte. Costs ~10 s per tab, not per frame.
    if (!warm.p) {
      warm.p = (async () => {
        for (let i = 0; i < 8; i++) {
          draw(Math.floor((i * period) / 8));
          gl.getContext().finish();
          await new Promise((r) => setTimeout(r, 1200));
        }
        warm.done = true;
      })();
    }
    warm.p.then(finish);
  }, [frame, inst, post, gl, handle, continueRender, warm, period, isRendering]);
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
