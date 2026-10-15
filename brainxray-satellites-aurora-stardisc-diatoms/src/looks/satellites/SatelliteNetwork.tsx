import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { continueRender, delayRender, getRemotionEnvironment, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { buildSatelliteScene, SatParams } from "./scene";

export type { SatParams };

type Assets = { hero: GLTF; lod: GLTF; night: THREE.Texture };

// Loaded once per page, before the first frame.
let assetPromise: Promise<Assets> | null = null;
const loadAssets = () =>
  (assetPromise ??= (async () => {
    const gltf = new GLTFLoader();
    const [hero, lod, night] = await Promise.all([
      gltf.loadAsync(staticFile("models/satellite_tdrs.glb")),
      gltf.loadAsync(staticFile("models/satellite_tdrs_lod.glb")),
      new THREE.TextureLoader().loadAsync(staticFile("textures/black-marble-2012-4096.jpg")),
    ]);
    return { hero, lod, night };
  })());

const Inner: React.FC<{ assets: Assets; params: SatParams; frame: number; dpr: number; onFirst: () => void }> = ({
  assets,
  params,
  frame,
  dpr,
  onFirst,
}) => {
  const { gl } = useThree();
  const { width, height } = useVideoConfig();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const built = useMemo(
    () => buildSatelliteScene({ gl, width, height, dpr, params, hero: assets.hero, lod: assets.lod, night: assets.night }),
    [gl, width, height, dpr, params, assets],
  );
  useEffect(() => () => built.dispose(), [built]);
  // Priority 1 takes over rendering from R3F. The R3F clock is never read:
  // the scene is a pure function of the Remotion frame.
  useFrame(() => built.render(frameRef.current), 1);
  // Also render on every frame change directly, so the very first frame is
  // drawn even if R3F advanced before this component mounted.
  useLayoutEffect(() => {
    built.render(frame);
    onFirst();
  }, [built, frame, onFirst]);
  return null;
};

export const SatelliteNetwork: React.FC<{ params: SatParams }> = ({ params }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const [assets, setAssets] = useState<Assets | null>(null);
  const [handle] = useState(() => delayRender("Loading satellite model and Black Marble texture"));
  useEffect(() => {
    loadAssets()
      .then((a) => setAssets(a))
      .catch((e) => {
        console.error(e);
        throw e;
      });
  }, [handle]);
  const released = useRef(false);
  const release = React.useCallback(() => {
    if (released.current) return;
    released.current = true;
    continueRender(handle);
  }, [handle]);
  const dpr = getRemotionEnvironment().isRendering ? window.devicePixelRatio : 0.5;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      flat
      linear
      gl={{ preserveDrawingBuffer: true, antialias: false, alpha: false, powerPreference: "high-performance" }}
      style={{ backgroundColor: "#000" }}
    >
      {assets ? <Inner assets={assets} params={params} frame={frame} dpr={dpr} onFirst={release} /> : null}
    </ThreeCanvas>
  );
};
