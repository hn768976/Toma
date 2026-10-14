import { useEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PostPipeline } from "./post";
import { LOOP } from "./rng";
import type { BuildCtx, LookHandle } from "./types";

type Factory<P> = (ctx: BuildCtx, params: P) => LookHandle;

function Runner<P>({ factory, params }: { factory: Factory<P>; params: P }) {
  // The ONLY time source: Remotion's frame, wrapped onto the 600-frame loop.
  const frame = useCurrentFrame() % LOOP;
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);
  const advance = useThree((s) => s.advance);
  const { delayRender, continueRender } = useDelayRender();
  const readyRef = useRef(false);

  const { handle, post } = useMemo(() => {
    gl.toneMapping = THREE.NoToneMapping;
    gl.autoClear = false;
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    const ctx: BuildCtx = {
      gl,
      width: size.x,
      height: size.y,
      pxScale: size.y / 720,
      resolution: size.clone(),
    };
    return { handle: factory(ctx, params), post: new PostPipeline(gl, size.x, size.y) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  useEffect(() => {
    const h = delayRender("Building scene / loading textures");
    let alive = true;
    Promise.resolve(handle.ready).then(() => {
      if (!alive) return;
      readyRef.current = true;
      // render the current frame now that everything is resident
      advance(performance.now());
      continueRender(h);
    });
    return () => {
      alive = false;
      continueRender(h);
    };
  }, [handle, advance, delayRender, continueRender]);

  useEffect(
    () => () => {
      handle.dispose?.();
      post.dispose();
    },
    [handle, post],
  );

  // Priority 1 => R3F skips its own render; this callback is only a render
  // hook. Its clock/delta arguments are deliberately ignored.
  useFrame(() => {
    if (!readyRef.current) return;
    const f = frameRef.current;
    handle.update(f);
    handle.camera.updateMatrixWorld();
    handle.preRender?.(gl);
    post.render(handle.scene, handle.camera, handle.post, f);
  }, 1);

  return null;
}

export function Stage<P>({ factory, params }: { factory: Factory<P>; params: P }) {
  const { width, height } = useVideoConfig();
  // Remotion's --scale sets devicePixelRatio. Use it exactly (R3F would
  // otherwise clamp to >=1 and render 4K for a 720p preview). The +0.25
  // keeps floor(width*dpr) from landing one pixel short.
  const dpr =
    typeof window === "undefined" ? 1 : (Math.round(width * window.devicePixelRatio) + 0.25) / width;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      flat
      linear
      gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      style={{ background: "#000" }}
    >
      <Runner factory={factory} params={params} />
    </ThreeCanvas>
  );
}
