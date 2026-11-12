import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { NovaRig } from '../characters/NovaRig';
import { LottieAt } from '../lib/LottieAt';
import { breathe, clamp, ease, track } from '../lib/motion';
import {
  AmbientBubbles, Backdrop, BranchCoral, BubbleCoral, GroundShadow, H, Kelp, Plankton, Sand, sandTop, Slate, W,
} from '../set/Seabed';
import { C } from '../theme';
import { novaWidePose } from './novaWidePose';

export const CLAM_BOX = { left: 270, top: 492, width: 500, height: 423 };
export const PUFF_BOX = { left: 1452, top: 612, size: 306 }; // puff_*.json canvas is 440x440

/** Shared seabed layers behind the characters. */
export const SetBack: React.FC<{ f: number }> = ({ f }) => (
  <svg width={W} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
    <Backdrop f={f} />
    <Plankton f={f} />
    <Kelp f={f} x={1205} height={330} width={28} phase={2.2} color="#79B83A" dark="#5E9E30" />
    <Kelp f={f} x={950} height={250} width={26} phase={4.1} color="#79B83A" dark="#5E9E30" />
    <Kelp f={f} x={250} height={400} width={30} phase={1.1} color="#79B83A" dark="#5E9E30" />
    <Slate f={f} />
    <Sand />
    <BranchCoral f={f} x={735} scale={0.85} />
    <BubbleCoral f={f} x={1845} scale={0.95} />
    <BranchCoral f={f} x={1240} scale={0.6} color={C.grape} phase={1.4} />
  </svg>
);

export const SetFront: React.FC<{ f: number; extra?: React.ReactNode }> = ({ f, extra }) => (
  <svg width={W} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
    <AmbientBubbles f={f} vents={[{ x: 520, y: 800 }, { x: 160, y: 880 }, { x: 1250, y: 880 }, { x: 1860, y: 860 }]} />
    {extra}
    <Kelp f={f} x={70} height={560} width={40} phase={0} />
    <Kelp f={f} x={1890} height={430} width={36} phase={3.3} />
  </svg>
);

export const Clam: React.FC<{ f: number; openAt: number }> = ({ f, openAt }) => {
  const s = f > openAt + 60 ? breathe(f, 0.5, 0.01, 64) : 1;
  return (
    <div
      style={{
        position: 'absolute',
        ...CLAM_BOX,
        transformOrigin: '50% 100%',
        scale: `${2 - s} ${s}`,
      }}
    >
      <LottieAt file="clam_open.json" frame={f - openAt} style={{ width: CLAM_BOX.width, height: CLAM_BOX.height }} />
    </div>
  );
};

export const PuffIdle: React.FC<{ f: number; box?: typeof PUFF_BOX; rot?: number; style?: React.CSSProperties }> = ({
  f,
  box = PUFF_BOX,
  rot = 0,
  style,
}) => (
  <div
    style={{
      position: 'absolute',
      left: box.left,
      top: box.top,
      width: box.size,
      height: box.size,
      rotate: `${rot}deg`,
      ...style,
    }}
  >
    <LottieAt file="puff_idle.json" frame={f} loop style={{ width: box.size, height: box.size }} />
  </div>
);

/** 0-150: clam opens, Nova bursts out, swims to the slate, points. */
export const WideShot: React.FC = () => {
  const f = useCurrentFrame();
  const pose = novaWidePose(f);
  // slow 2D push-in 60 -> 135
  const zoom = track(f, [[60, 1, ease.inOut], [135, 1.12]]);
  const groundY = sandTop(pose.x) + 12;
  const air = clamp((groundY - pose.y - 90) / 520, 0, 1);
  return (
    <AbsoluteFill style={{ backgroundColor: C.water, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: '1180px 520px', scale: `${zoom}` }}>
        <SetBack f={f} />
        <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
          <GroundShadow x={CLAM_BOX.left + CLAM_BOX.width / 2} y={sandTop(520) + 58} w={470} />
          <GroundShadow x={1605} y={sandTop(1605) + 34} w={130} s={0.95 + 0.05 * Math.sin((f / 30) * Math.PI * 2)} />
          {f >= 44 ? <GroundShadow x={pose.x} y={groundY + 10} w={380} s={1 - air * 0.6} /> : null}
        </svg>
        <Clam f={f} openAt={20} />
        <PuffIdle f={f} />
        <NovaRig pose={pose} width={W} height={H} id="wide" />
        <SetFront f={f} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
