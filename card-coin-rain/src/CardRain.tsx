import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useState } from "react";
import { AbsoluteFill, useDelayRender, useRemotionEnvironment, useVideoConfig } from "remotion";
import { CAM_BASE, FAR, NEAR, VFOV_DEG } from "./lib/loop";
import { LOOKS } from "./lib/looks";
import { Assets, loadAssets } from "./three/assets";
import { Disable, Scene } from "./three/Scene";

export type CardRainProps = {
  look: keyof typeof LOOKS;
  /** Verification only: render 601 frames so frame 600 can be compared with 0. */
  loopCheck?: boolean;
  /** Verification only: switch groups off to bisect loop/determinism issues. */
  disable?: Disable;
};

/** Preview in the Studio at 1080p; renders use the true device scale. */
const STUDIO_DPR = 0.5;

export const CardRain: React.FC<CardRainProps> = ({ look: lookId, disable }) => {
  const look = LOOKS[lookId];
  const { width, height } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender(`Loading HDRI, font and baking textures (${lookId})`, { timeoutInMilliseconds: 120000 }));
  // Asset readiness only; nothing animated is driven by state.
  const [assets, setAssets] = useState<Assets | null>(null);

  useEffect(() => {
    let alive = true;
    loadAssets(look)
      .then((a) => {
        if (!alive) return;
        setAssets(a);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
    return () => {
      alive = false;
    };
  }, [look, handle, continueRender, cancelRender]);

  const dpr = isRendering && typeof window !== "undefined" ? window.devicePixelRatio : STUDIO_DPR;

  return (
    <AbsoluteFill style={{ backgroundColor: look.backdrop.edge }}>
      {assets ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
          camera={{ fov: VFOV_DEG, near: NEAR, far: FAR, position: [CAM_BASE.x, CAM_BASE.y, CAM_BASE.z] }}
        >
          <Scene look={look} assets={assets} disable={disable ?? {}} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
