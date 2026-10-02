import { ThreeCanvas } from '@remotion/three';
import { useEffect, useState } from 'react';
import { AbsoluteFill, cancelRender, getRemotionEnvironment, useDelayRender, useVideoConfig } from 'remotion';
import { NoToneMapping, SRGBColorSpace } from 'three';
import type { IconRow } from './icons';
import { loadIconAssets, type IconAssets } from './lib/assets';
import { Scene } from './scene/Scene';
import { CAMERA_FOV } from './scene/camera';

// One composition = one icon row. Font + SVG are loaded behind delayRender
// before the canvas mounts, so the very first rendered frame is complete.

export type NeonIconProps = { icon: IconRow; loopCheck?: boolean };

export const NeonIcon = ({ icon }: NeonIconProps) => {
  const { width, height } = useVideoConfig();
  const { delayRender, continueRender } = useDelayRender();
  const [assets, setAssets] = useState<IconAssets | null>(null);
  const [handle] = useState(() => delayRender(`Loading assets for ${icon.id}`));

  useEffect(() => {
    let alive = true;
    loadIconAssets(icon)
      .then((a) => {
        if (!alive) return;
        setAssets(a);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
    return () => {
      alive = false;
    };
  }, [icon, handle, continueRender]);

  // Rendering: use the exact device pixel ratio Remotion gives (--scale), so
  // --scale=0.5 renders 1920×1080 natively. Studio preview: cap at 1080p.
  const dpr = getRemotionEnvironment().isRendering
    ? window.devicePixelRatio
    : Math.min(window.devicePixelRatio, 1920 / width);

  return (
    <AbsoluteFill style={{ backgroundColor: '#02040a' }}>
      {assets && (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          flat
          gl={{
            antialias: false,
            alpha: false,
            stencil: false,
            depth: true,
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance',
            outputColorSpace: SRGBColorSpace,
            toneMapping: NoToneMapping,
          }}
          camera={{ fov: CAMERA_FOV, near: 0.1, far: 80, position: [0, 3, 5] }}
        >
          <Scene assets={assets} />
        </ThreeCanvas>
      )}
    </AbsoluteFill>
  );
};
