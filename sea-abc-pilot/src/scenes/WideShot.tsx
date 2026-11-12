import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { NovaRig } from '../characters/NovaRig';
import { LottieAt } from '../lib/LottieAt';
import { breathe, clamp, ease, track } from '../lib/motion';
import {
  AmbientBubbles, Backdrop, BranchCoral, BubbleCoral, GroundShadow, H, Kelp, Plankton, Sand, sandTop, Slate, WORLD_W,
} from '../set/Seabed';
import { C } from '../theme';
import { NOVA_SIZE, novaWidePose } from './novaWidePose';

// World layout (the wide shot world is 2400 px wide; the camera pans across it).
// clam_open.json is 520x440 -> shown at 680 wide (1.31x)
export const CLAM_BOX = { left: -10, top: 344, width: 680, height: 575 };
// puff_*.json canvas is 440x440 -> shown at 581 (1.32x, ~1.9x the first pilot)
export const PUFF_SIZE = 581;
export const puffBox = (cx: number, cy: number) => ({ left: cx - PUFF_SIZE / 2, top: cy - PUFF_SIZE / 2, size: PUFF_SIZE });
export const PUFF_WIDE = { x: 1700, y: 745 };
// Puff is startled when Nova lands beside him and scoots under the slate, clearing her swim path.
const puffScoot = (f: number) => ({
  x: track(f, [[52, 0, ease.inOut], [56, -18, ease.in], [66, 300, ease.out], [70, 286, ease.inOut], [74, 290]]),
  y: track(f, [[56, 0, ease.rise], [61, -70, ease.fall], [66, 0, ease.out], [74, 0]]),
  // vertical stretch: squash on anticipation, stretch in the hop, squash on landing
  st: track(f, [[52, 1, ease.inOut], [56, 0.84, ease.snap], [58, 1.18, ease.inOut], [64, 1.05, ease.in], [66, 0.82, ease.out], [70, 1.05, ease.inOut], [74, 1]]),
  rot: track(f, [[52, 0, ease.inOut], [56, -10, ease.snap], [60, 12, ease.inOut], [66, 0, ease.out], [70, -4, ease.inOut], [74, 0]]),
});

/** Shared seabed layers behind the characters (world coordinates). */
export const SetBack: React.FC<{ f: number }> = ({ f }) => (
  <svg width={WORLD_W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
    <Backdrop f={f} />
    <Plankton f={f} />
    <Kelp f={f} x={760} height={360} width={28} phase={2.2} color="#79B83A" dark="#5E9E30" />
    <Kelp f={f} x={1180} height={300} width={26} phase={4.1} color="#79B83A" dark="#5E9E30" />
    <Kelp f={f} x={1730} height={380} width={30} phase={1.1} color="#79B83A" dark="#5E9E30" />
    <Kelp f={f} x={2390} height={340} width={28} phase={3.0} color="#79B83A" dark="#5E9E30" />
    <Slate f={f} />
    <Sand />
    {/* corals kept clear of the clam so nothing reads as part of it */}
    <BranchCoral f={f} x={1420} scale={0.9} />
    <BranchCoral f={f} x={2070} scale={0.65} color={C.grape} phase={1.4} />
    <BubbleCoral f={f} x={2330} scale={0.95} />
  </svg>
);

export const SetFront: React.FC<{ f: number; extra?: React.ReactNode }> = ({ f, extra }) => (
  <svg width={WORLD_W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
    <AmbientBubbles
      f={f}
      count={22}
      vents={[{ x: 330, y: 760 }, { x: 1000, y: 880 }, { x: 1760, y: 880 }, { x: 2300, y: 870 }]}
    />
    {extra}
    <Kelp f={f} x={40} height={560} width={40} phase={0} />
    <Kelp f={f} x={2370} height={430} width={36} phase={3.3} />
  </svg>
);

/** World camera: screen = (world - cam) * zoom. */
export const Camera: React.FC<{ x: number; y: number; zoom: number; children: React.ReactNode }> = ({ x, y, zoom, children }) => (
  <AbsoluteFill style={{ transformOrigin: '0 0', translate: `${-x * zoom}px ${-y * zoom}px`, scale: `${zoom}` }}>
    {children}
  </AbsoluteFill>
);

export const Clam: React.FC<{ f: number; openAt: number }> = ({ f, openAt }) => {
  const s = f > openAt + 60 ? breathe(f, 0.5, 0.01, 64) : 1;
  return (
    <div style={{ position: 'absolute', ...CLAM_BOX, transformOrigin: '50% 100%', scale: `${2 - s} ${s}` }}>
      <LottieAt file="clam_open.json" frame={f - openAt} style={{ width: CLAM_BOX.width, height: CLAM_BOX.height }} />
    </div>
  );
};

export const PuffIdle: React.FC<{ f: number; box: { left: number; top: number; size: number }; rot?: number; st?: number }> = ({
  f,
  box,
  rot = 0,
  st = 1,
}) => (
  <div
    style={{
      position: 'absolute', left: box.left, top: box.top, width: box.size, height: box.size,
      rotate: `${rot}deg`, transformOrigin: '50% 66%', scale: `${1 / Math.sqrt(st)} ${Math.sqrt(st)}`,
    }}
  >
    <LottieAt file="puff_idle.json" frame={f} loop style={{ width: box.size, height: box.size }} />
  </div>
);

/** 0-150: clam opens, Nova bursts out, swims a mid-water arc to the slate, points. */
export const WideShot: React.FC = () => {
  const f = useCurrentFrame();
  const pose = novaWidePose(f);
  // 60 -> 135: slow push-in (1.00 -> 1.12) while panning to keep Nova and the slate framed
  const zoom = track(f, [[60, 1, ease.inOut], [135, 1.12]]);
  const camX = track(f, [[60, 0, ease.inOut], [135, 656]]);
  const camY = track(f, [[60, 0, ease.inOut], [135, 70]]);
  const groundY = sandTop(pose.x) + 12;
  const belly = 112 * NOVA_SIZE;
  const air = clamp((groundY - pose.y - belly) / 520, 0, 1);
  const scoot = puffScoot(f);
  const puffX = PUFF_WIDE.x + scoot.x;
  return (
    <AbsoluteFill style={{ backgroundColor: C.water, overflow: 'hidden' }}>
      <Camera x={camX} y={camY} zoom={zoom}>
        <SetBack f={f} />
        <svg width={WORLD_W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
          <GroundShadow x={330} y={sandTop(330) + 52} w={640} />
          <GroundShadow x={puffX} y={sandTop(puffX) + 30} w={240} s={(0.95 + 0.05 * Math.sin((f / 30) * Math.PI * 2)) * (1 + scoot.y / 300)} />
          {f >= 44 ? <GroundShadow x={pose.x} y={groundY + 10} w={720} s={1 - air * 0.6} /> : null}
        </svg>
        <Clam f={f} openAt={20} />
        <PuffIdle f={f} box={puffBox(puffX, PUFF_WIDE.y + scoot.y)} rot={scoot.rot} st={scoot.st} />
        <NovaRig pose={pose} width={WORLD_W} height={H} id="wide" />
        <SetFront f={f} />
      </Camera>
    </AbsoluteFill>
  );
};
