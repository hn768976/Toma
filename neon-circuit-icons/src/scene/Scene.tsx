import { useCurrentFrame } from 'remotion';
import type { IconAssets } from '../lib/assets';
import { loopT } from '../lib/loop';
import { Beam } from './Beam';
import { Blocks } from './Blocks';
import { Board } from './Board';
import { CameraRig } from './CameraRig';
import { Chips } from './Chips';
import { IconMesh } from './IconMesh';
import { Pads } from './Pads';
import { PostFX } from './PostFX';
import { Sparks } from './Sparks';
import { Traces } from './Traces';

// Everything on screen is a pure function of useCurrentFrame().
export const Scene = ({ assets }: { assets: IconAssets }) => {
  const frame = useCurrentFrame();
  const t = loopT(frame);
  return (
    <>
      <color attach="background" args={['#02040a']} />
      <fog attach="fog" args={['#02040a', 9, 34]} />
      <ambientLight intensity={Math.PI} />
      <CameraRig t={t} />
      <Board />
      <Traces />
      <Chips />
      <Pads t={t} />
      <Sparks t={t} />
      <Blocks />
      <Beam t={t} />
      <IconMesh assets={assets} t={t} />
      <PostFX frame={frame} />
    </>
  );
};
