import React from 'react';
import {Composition} from 'remotion';
import {NeonStockLine} from './NeonStockLine';
import {DURATION, FPS, VIDEO_H, VIDEO_W} from './lib/theme';

/**
 * Both pieces are the same component at the same size for the same length.
 * The only thing that tells them apart is which variant they ask for.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="NeonStockLine"
        component={NeonStockLine}
        durationInFrames={DURATION} // 840
        fps={FPS} // 30  -> 28.0s, seamless loop
        width={VIDEO_W} // 3840
        height={VIDEO_H} // 2160 — render 1080p with --scale=0.5
        defaultProps={{variant: 'bull' as const}}
      />
      <Composition
        id="NeonStockLineBear"
        component={NeonStockLine}
        durationInFrames={DURATION} // 840
        fps={FPS} // 30  -> 28.0s, seamless loop
        width={VIDEO_W} // 3840
        height={VIDEO_H} // 2160 — render 1080p with --scale=0.5
        defaultProps={{variant: 'bear' as const}}
      />
    </>
  );
};
