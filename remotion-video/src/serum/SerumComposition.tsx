/**
 * Composition entry point.
 *
 * The camera is fixed on every look -- no push-in, no orbit. All motion is in
 * the field.
 */
import { ThreeCanvas } from '@remotion/three';
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { CAMERA_Z, FOV } from './build';
import { lookById } from './looks';
import { SerumScene } from './Scene';

export const SerumComposition: React.FC<{ lookId: string; hide?: string[] }> = ({
  lookId,
  hide,
}) => {
  const look = lookById(lookId);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Look 5 ships with its own luma matte: the first half is the beauty pass,
  // the second is the identical animation as solid black on pure white. Both
  // halves are driven by the same motion frame so they line up exactly.
  const beautyLength = look.isLoop ? look.durationInFrames : look.durationInFrames / 2;
  const matte = !look.isLoop && frame >= beautyLength;
  const motionFrame = matte ? frame - beautyLength : frame;

  return (
    <AbsoluteFill style={{ backgroundColor: matte ? '#ffffff' : '#000000' }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: FOV, position: [0, 0, CAMERA_Z], near: 0.1, far: 80 }}
        gl={{ antialias: false }}
      >
        <SerumScene
          look={look}
          frame={frame}
          width={width}
          height={height}
          matte={matte}
          motionFrame={motionFrame}
          hide={hide}
        />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
