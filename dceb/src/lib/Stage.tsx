/**
 * Shared wrapper for every look:
 *  - loads the look's assets (fonts, textures, canvas textures) BEFORE the
 *    <ThreeCanvas/> mounts, holding the render with delayRender, so the very
 *    first frame that is rendered — whichever frame that is — already has
 *    everything;
 *  - picks the drawing-buffer pixel ratio (in a render it is exactly the
 *    --scale factor, so 720p previews cost 720p GPU work);
 *  - mounts the scene and the deterministic post pipeline.
 */
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useState } from "react";
import { AbsoluteFill, useDelayRender, useRemotionEnvironment, useVideoConfig } from "remotion";
import { PostRenderer, PostSettings } from "./Post";

export function useAssets<T>(key: string, load: () => Promise<T>): T | null {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender(`Loading assets: ${key}`, { timeoutInMilliseconds: 120000 }));
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    load()
      .then((v) => {
        if (!alive) return;
        setValue(v);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

export const Stage: React.FC<{
  background: string;
  post: PostSettings;
  camera: { fov: number; near: number; far: number };
  shadows?: "variance" | "soft" | false;
  children: React.ReactNode;
}> = ({ background, post, camera, shadows = false, children }) => {
  const { width, height } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();
  const dpr =
    typeof window === "undefined"
      ? 1
      : isRendering
        ? window.devicePixelRatio
        : Math.min(window.devicePixelRatio, 0.5);
  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        flat
        linear
        shadows={shadows}
        gl={{
          antialias: false,
          alpha: false,
          depth: true,
          stencil: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        }}
        camera={{ fov: camera.fov, near: camera.near, far: camera.far, position: [0, 0, 10] }}
      >
        {children}
        <PostRenderer settings={post} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

/** Drawing-buffer size in real pixels (CSS size × dpr), from the r3f store. */
export const useBufferSize = () => {
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  return { w: Math.max(1, Math.round(size.width * dpr)), h: Math.max(1, Math.round(size.height * dpr)) };
};
