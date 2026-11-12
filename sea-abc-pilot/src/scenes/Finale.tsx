import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { LottieAt } from '../lib/LottieAt';
import { breathe, ease, track } from '../lib/motion';
import { BubbleBurst, GroundShadow, H, sandTop, W } from '../set/Seabed';
import { C } from '../theme';
import { Clam, PuffIdle, SetBack, SetFront } from './WideShot';

const START = 345;
const NOVA = { left: 760, size: 480 }; // nova_cheer.json is 600x600, feet at (300,470)
const K = NOVA.size / 600;

/** 345-450: back to the wide (slightly closer). Nova cheers, Puff spins, bubbles burst. */
export const Finale: React.FC = () => {
  const f = useCurrentFrame() + START;
  const lf = f - START; // nova_cheer frame (0..89, then held)
  const feetX = NOVA.left + 300 * K;
  const feetY = sandTop(feetX) + 14;
  const top = feetY - 470 * K;
  const zoom = track(f, [[345, 1.06, ease.inOut], [450, 1.085]]);
  const hold = f >= 435 ? breathe(f - 435, 0, 0.015, 30) : 1; // held pose still breathes
  const shadow = track(lf, [[0, 1], [5, 1.08], [14, 0.62], [16, 0.62], [22, 1.1], [26, 1], [34, 1.06], [42, 0.7], [44, 0.7], [50, 1.1], [54, 1]]);
  // Puff: one spin with anticipation and overshoot
  const spin = track(f, [[372, 0, ease.inOut], [378, -28, ease.out], [393, 372, ease.inOut], [398, 356, ease.inOut], [403, 360]]);
  const hop = track(f, [[376, 0, ease.out], [385, -60, ease.in], [395, 0, ease.out], [398, -8, ease.inOut], [401, 0]]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.water, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: '960px 640px', scale: `${zoom}` }}>
        <SetBack f={f} />
        <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
          <GroundShadow x={520} y={sandTop(520) + 58} w={470} />
          <GroundShadow x={feetX} y={feetY + 4} w={260} s={shadow} />
          <GroundShadow x={1440} y={sandTop(1440) + 34} w={120} s={1 + hop / 200} />
        </svg>
        <Clam f={f} openAt={-200} />
        <PuffIdle f={f} box={{ left: 1292, top: 612 + hop, size: 306 }} rot={spin} />
        <div
          style={{
            position: 'absolute',
            left: NOVA.left,
            top,
            width: NOVA.size,
            height: NOVA.size,
            transformOrigin: `50% ${(470 / 600) * 100}%`,
            scale: `${2 - hold} ${hold}`,
          }}
        >
          <LottieAt file="nova_cheer.json" frame={lf} style={{ width: NOVA.size, height: NOVA.size }} />
        </div>
        <SetFront
          f={f}
          extra={
            <>
              <BubbleBurst f={f} start={351} x={feetX} y={top + 200} count={28} seed={5} />
              <BubbleBurst f={f} start={394} x={1440} y={720} count={10} seed={9} />
            </>
          }
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
