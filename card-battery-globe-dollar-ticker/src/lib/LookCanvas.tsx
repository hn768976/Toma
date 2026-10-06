import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  getInputProps,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  Camera,
  LinearSRGBColorSpace,
  NoToneMapping,
  Scene,
  WebGLRenderer,
} from "three";
import { Assets, loadAssets } from "./assets";
import { Pipeline, PostSettings } from "./postfx";
import { makeShared, Shared } from "./shared";

/**
 * A look is plain three.js: two scenes, a camera, post settings and an
 * `update(frame)` that sets every animated value from the frame number alone.
 */
export interface Look {
  opaque: Scene;
  overlay: Scene;
  camera: Camera;
  post: PostSettings;
  update: (frame: number) => void;
  dispose?: () => void;
}

export type LookFactory<P> = (ctx: {
  gl: WebGLRenderer;
  assets: Assets;
  shared: Shared;
  params: P;
  width: number;
  height: number;
}) => Look;

interface Ctx<P> {
  factory: LookFactory<P>;
  params: P;
  assets: Assets;
}

const useLook = <P,>({ factory, params, assets }: Ctx<P>) => {
  const { gl } = useThree();
  const { width, height } = useVideoConfig();
  const shared = useMemo(() => makeShared(), []);
  const look = useMemo(() => {
    gl.outputColorSpace = LinearSRGBColorSpace;
    gl.toneMapping = NoToneMapping;
    return factory({ gl, assets, shared, params, width, height });
  }, [gl, assets, shared, factory, params, width, height]);
  const pipeline = useMemo(() => new Pipeline(gl, shared), [gl, shared]);
  useEffect(
    () => () => {
      look.dispose?.();
      pipeline.dispose();
    },
    [look, pipeline],
  );
  return { gl, look, pipeline, shared };
};

/** Renders one frame: everything derives from `frame`. */
const renderFrame = (
  look: Look,
  pipeline: Pipeline,
  shared: Shared,
  frame: number,
  fps: number,
) => {
  shared.uFrame.value = frame;
  shared.uTime.value = frame / fps;
  look.update(frame);
  // Debug aid (loop/flicker hunting): `--props='{"skip":"map,lines"}'` hides
  // objects by name.
  const skip = String((getInputProps() as { skip?: string }).skip ?? "");
  if (skip) {
    for (const sc of [look.opaque, look.overlay])
      sc.traverse((o) => {
        if (o.name && skip.split(",").includes(o.name)) o.visible = false;
      });
  }
  pipeline.render(look.opaque, look.overlay, look.camera, look.post, frame);
};

const LookContext = React.createContext<Ctx<unknown> | null>(null);

/**
 * Draws the look. @remotion/three calls R3F's `advance()` once per Remotion
 * frame; a priority-1 useFrame callback is R3F's hook for taking over the
 * render pass (R3F then skips its own default draw). The callback ignores
 * R3F's clock and delta entirely — the frame number comes from
 * useCurrentFrame() via a ref set in the same commit.
 */
const LookRenderer: React.FC = () => {
  const ctx = React.useContext(LookContext)!;
  const { look, pipeline, shared } = useLook(ctx);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frameRef = useRef(frame);
  const { invalidate } = useThree();
  useLayoutEffect(() => {
    frameRef.current = frame;
    invalidate();
  }, [frame, invalidate]);
  useFrame(() => {
    renderFrame(look, pipeline, shared, frameRef.current, fps);
  }, 1);
  return null;
};

export function LookCanvas<P>({
  factory,
  params,
}: {
  factory: LookFactory<P>;
  params: P;
}) {
  const { width, height } = useVideoConfig();
  const [assets, setAssets] = useState<Assets | null>(null);
  const [handle] = useState(() => delayRender("Loading fonts + Natural Earth"));
  useEffect(() => {
    let alive = true;
    loadAssets().then((a) => {
      if (alive) setAssets(a);
      continueRender(handle);
    });
    return () => {
      alive = false;
    };
  }, [handle]);

  const ctx = useMemo(
    () => (assets ? ({ factory, params, assets } as Ctx<unknown>) : null),
    [assets, factory, params],
  );

  if (!ctx) return <AbsoluteFill style={{ backgroundColor: "black" }} />;

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      
      <LookContext.Provider value={ctx}>
        <ThreeCanvas
          width={width}
          height={height}
          frameloop="demand"
          linear
          flat
          gl={{
            antialias: false,
            alpha: false,
            preserveDrawingBuffer: true, // Remotion screenshots the canvas after the draw
            powerPreference: "high-performance",
            stencil: false,
            depth: false,
          }}
        >
          <LookContext.Provider value={ctx}>
            <LookRenderer />
          </LookContext.Provider>
        </ThreeCanvas>
      </LookContext.Provider>
    </AbsoluteFill>
  );
}
