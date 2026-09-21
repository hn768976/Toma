import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { SoftShadows } from '@react-three/drei';
import { Backdrop } from './Backdrop';
import { ComposerSync } from './ComposerSync';
import { Effects } from './Effects';
import { Lighting } from './Lighting';
import { Ribbon } from './Ribbon';
import type { PerspectiveCamera } from 'three';
import { CAMERA, type VersionConfig } from './versions';

const CameraRig: React.FC = () => {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.position.set(...CAMERA.position);
    camera.lookAt(...CAMERA.lookAt);
    (camera as PerspectiveCamera).fov = CAMERA.fov;
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
};

export const Scene: React.FC<{
  cfg: VersionConfig;
  frame: number;
  progress: number;
}> = ({ cfg, frame, progress }) => {
  // PCSS. Deliberately not drei's AccumulativeShadows: it accumulates across
  // frames and Remotion renders frames out of order on separate threads.
  return (
    <>
      <SoftShadows
        size={cfg.shadow.size}
        focus={cfg.shadow.focus}
        samples={cfg.shadow.samples}
      />
      <CameraRig />
      <Lighting cfg={cfg} />
      <Backdrop cfg={cfg} />
      <Ribbon cfg={cfg} progress={progress} />
      <Effects cfg={cfg} frame={frame} />
      <ComposerSync />
    </>
  );
};
