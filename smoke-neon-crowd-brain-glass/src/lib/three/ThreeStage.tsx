import { useThree, useFrame } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useEffect, useMemo, useRef } from "react";
import { AbsoluteFill, getRemotionEnvironment, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Assets, useAssets } from "../assets";

export type SceneHandle = {
  /** Draw frame `frame`. Must depend on `frame` (and constants) only. */
  render: (frame: number) => void;
  dispose: () => void;
};

export type SceneFactory<P> = (ctx: { gl: THREE.WebGLRenderer; assets: Assets; props: P }) => SceneHandle;

function Driver<P>({ factory, props, assets }: { factory: SceneFactory<P>; props: P; assets: Assets }) {
  const gl = useThree((s) => s.gl);
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handle = useMemo(() => factory({ gl, assets, props }), [gl]);
  useEffect(() => () => handle.dispose(), [handle]);
  // Priority 1 takes over R3F's render. The R3F clock/state is ignored:
  // everything comes from Remotion's current frame.
  useFrame(() => handle.render(frameRef.current), 1);
  return null;
}

/**
 * Wraps @remotion/three's <ThreeCanvas>. The canvas is laid out at the
 * composition size (3840×2160) and its backing store follows the render
 * scale (devicePixelRatio), so a --scale=1/3 preview renders 1280×720 pixels
 * and a 4K render renders 3840×2160.
 */
export function ThreeStage<P>({
  factory,
  props,
  needHDR = false,
  background = "#000",
}: {
  factory: SceneFactory<P>;
  props: P;
  needHDR?: boolean;
  background?: string;
}) {
  const { width, height } = useVideoConfig();
  const assets = useAssets(needHDR);
  const env = getRemotionEnvironment();
  const dpr = env.isRendering ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 0.5);
  return (
    <AbsoluteFill style={{ background }}>
      {assets ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          flat
          linear
          gl={{
            antialias: false,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance",
            alpha: false,
            stencil: false,
          }}
        >
          <Driver factory={factory} props={props} assets={assets} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
}

export const hex = (c: string) => new THREE.Color(c);
