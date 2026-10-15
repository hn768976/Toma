import React from 'react';
import { Composition } from 'remotion';
import { BURST_ROWS, CAPSULE_ROWS, DNA_ROWS, DROP_ROWS } from './data';
import { DNAParticles } from './dna/DNAParticles';
import { RadialBurst } from './burst/RadialBurst';
import { CapsuleRelease } from './capsule/CapsuleRelease';
import { WaterDrop } from './waterdrop/WaterDrop';

// Compositions are defined at 3840x2160, 30 fps; every data row in data.ts
// becomes one composition. Remotion IDs cannot contain "_", so the ID is the
// row id with "-" (CapsuleRelease_White -> CapsuleRelease-White).
// REMOTION_LOOP_TEST_EXTRA=1 adds one frame to every loop so frame 600 can be
// rendered and compared with frame 0.
const W = 3840;
const H = 2160;
const FPS = 30;
export const compId = (id: string) => id.replace(/_/g, '-');
const loopExtra = Number(process.env.REMOTION_LOOP_TEST_EXTRA ?? 0);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {CAPSULE_ROWS.map((row) => (
        <Composition key={row.id} id={compId(row.id)} component={CapsuleRelease}
          durationInFrames={row.durationInFrames}
          fps={FPS} width={W} height={H} defaultProps={{ row }} />
      ))}
      {DNA_ROWS.map((row) => (
        <Composition key={row.id} id={compId(row.id)} component={DNAParticles}
          durationInFrames={row.durationInFrames + (row.mode === 'loop' ? loopExtra : 0)}
          fps={FPS} width={W} height={H} defaultProps={{ row }} />
      ))}
      {DROP_ROWS.map((row) => (
        <Composition key={row.id} id={compId(row.id)} component={WaterDrop}
          durationInFrames={row.durationInFrames + loopExtra}
          fps={FPS} width={W} height={H} defaultProps={{ row }} />
      ))}
      {BURST_ROWS.map((row) => (
        <Composition key={row.id} id={compId(row.id)} component={RadialBurst}
          durationInFrames={row.durationInFrames + loopExtra}
          fps={FPS} width={W} height={H} defaultProps={{ row }} />
      ))}
    </>
  );
};
