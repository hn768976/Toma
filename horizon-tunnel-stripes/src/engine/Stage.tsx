import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useDelayRender,
  useRemotionEnvironment,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import { AssetNeeds, Assets, loadAssets } from "./assets";
import { PostPipeline, PostSettings } from "./post";

export type LookInstance = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  // Pure function of the frame number: sets every animated value.
  update: (frame: number) => void;
  dispose?: () => void;
};

export type LookContext<P> = {
  renderer: THREE.WebGLRenderer;
  assets: Assets;
  params: P;
  durationInFrames: number;
};

export type LookFactory<P> = (ctx: LookContext<P>) => LookInstance;

type RunnerProps<P> = {
  factory: LookFactory<P>;
  params: P;
  assets: Assets;
  post: PostSettings;
};

function Runner<P>({ factory, params, assets, post }: RunnerProps<P>) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // The frame number is the only input. Written during render so it is
  // current before @remotion/three calls advance() in its effect.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const look = useMemo(
    () => factory({ renderer: gl, assets, params, durationInFrames }),
    [factory, gl, assets, params, durationInFrames],
  );
  const pipeline = useMemo(() => new PostPipeline(post), [post]);
  useEffect(() => () => look.dispose?.(), [look]);
  useEffect(() => () => pipeline.dispose(), [pipeline]);

  // Priority 1 takes over rendering from R3F. The callback ignores R3F's
  // clock and delta entirely; it only reads frameRef.
  useFrame(() => {
    const f = frameRef.current;
    look.camera.aspect = size.width / size.height;
    look.update(f);
    look.camera.updateProjectionMatrix();
    pipeline.render(gl, look.scene, look.camera, f);
  }, 1);
  return null;
}

export type StageProps<P> = {
  factory: LookFactory<P>;
  params: P;
  post: PostSettings;
  needs?: AssetNeeds;
};

export function Stage<P>({ factory, params, post, needs = {} }: StageProps<P>) {
  const { width, height } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Loading HDRI / Natural Earth data"));
  const [assets, setAssets] = useState<Assets | null>(null);
  const needHdri = !!needs.hdri;
  const needLand = !!needs.land;

  useEffect(() => {
    loadAssets({ hdri: needHdri, land: needLand })
      .then((a) => setAssets(a))
      .catch((e) => cancelRender(e));
  }, [needHdri, needLand, cancelRender]);

  // Release the asset hold only after <ThreeCanvas> has mounted and taken
  // its own delayRender handle, so no frame is captured in between.
  useEffect(() => {
    if (assets) continueRender(handle);
  }, [assets, handle, continueRender]);

  // When rendering, Remotion's --scale sets devicePixelRatio, so a 3840x2160
  // composition rendered with --scale=1/3 draws a 1280x720 buffer. In the
  // Studio, cap the preview buffer at 1080p.
  const dpr =
    typeof window === "undefined"
      ? 1
      : isRendering
        ? window.devicePixelRatio
        : Math.min(window.devicePixelRatio, 1920 / width);

  return (
    <AbsoluteFill style={{ backgroundColor: post.clearColor }}>
      {assets ? (
        <ThreeCanvas
          width={width}
          height={height}
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
          <Runner factory={factory} params={params} assets={assets} post={post} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
}
