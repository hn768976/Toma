import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { LottieAt } from '../lib/LottieAt';
import { breathe, ease, track } from '../lib/motion';
import { BubbleBurst, GroundShadow, H, sandTop, WORLD_W } from '../set/Seabed';
import { C } from '../theme';
import { Camera, Clam, PuffIdle, puffBox, SetBack, SetFront } from './WideShot';

const START = 345;
// nova_cheer.json is 600x600 with the feet at (300,470); shown at 1.52x like the side-view Nova
const NOVA_SIZE = 912;
const K = NOVA_SIZE / 600;
const FEET_X = 1190;
const PUFF = { x: 1670, y: 745 };

/** 345-450: back to the wide (slightly closer). Nova cheers, Puff spins, bubbles burst. */
export const Finale: React.FC = () => {
  const f = useCurrentFrame() + START;
  const lf = f - START; // nova_cheer frame (0..89, then held)
  const feetY = sandTop(FEET_X) + 14;
  const top = feetY - 470 * K;
  const left = FEET_X - 300 * K;
  const zoom = track(f, [[345, 1.06, ease.inOut], [450, 1.066]]);
  const hold = f >= 435 ? breathe(f - 435, 0, 0.015, 30) : 1; // held pose still breathes
  const shadow = track(lf, [[0, 1], [5, 1.08], [14, 0.62], [16, 0.62], [22, 1.1], [26, 1], [34, 1.06], [42, 0.7], [44, 0.7], [50, 1.1], [54, 1]]);
  // Puff: one spin with anticipation and overshoot, plus a little hop
  const spin = track(f, [[372, 0, ease.inOut], [378, -28, ease.out], [393, 372, ease.inOut], [398, 356, ease.inOut], [403, 360]]);
  const hop = track(f, [[376, 0, ease.out], [385, -90, ease.in], [395, 0, ease.out], [398, -12, ease.inOut], [401, 0]]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.water, overflow: 'hidden' }}>
      <Camera x={690} y={40} zoom={zoom}>
        <SetBack f={f} />
        <svg width={WORLD_W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
          <GroundShadow x={330} y={sandTop(330) + 52} w={640} />
          <GroundShadow x={FEET_X} y={feetY + 4} w={400} s={shadow} />
          <GroundShadow x={PUFF.x} y={sandTop(PUFF.x) + 30} w={240} s={1 + hop / 300} />
        </svg>
        <Clam f={f} openAt={-200} />
        <PuffIdle f={f} box={puffBox(PUFF.x, PUFF.y + hop)} rot={spin} />
        <div
          style={{
            position: 'absolute',
            left,
            top,
            width: NOVA_SIZE,
            height: NOVA_SIZE,
            transformOrigin: `50% ${(470 / 600) * 100}%`,
            scale: `${2 - hold} ${hold}`,
          }}
        >
          <LottieAt file="nova_cheer.json" frame={lf} style={{ width: NOVA_SIZE, height: NOVA_SIZE }} />
        </div>
        <SetFront
          f={f}
          extra={
            <>
              <BubbleBurst f={f} start={351} x={FEET_X} y={top + 380} count={30} seed={5} />
              <BubbleBurst f={f} start={394} x={PUFF.x} y={PUFF.y - 60} count={12} seed={9} />
            </>
          }
        />
      </Camera>
    </AbsoluteFill>
  );
};
