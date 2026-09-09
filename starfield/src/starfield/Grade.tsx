import React, {useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import {DITHER_TILE, DURATION, GRAIN_TILE} from './constants';
import {makeDitherTileUrl, makeGrainTileUrl} from './noise';
import {makeRng} from './rng';

/**
 * Vignette, dither and grain. All three are applied in output space, after the
 * camera move — they belong to the lens and the encode, not to the sky.
 */
export const Grade: React.FC<{seed: number}> = ({seed}) => {
  const frame = useCurrentFrame();

  const grainUrl = useMemo(() => makeGrainTileUrl(`${seed}:grain`), [seed]);
  const ditherUrl = useMemo(() => makeDitherTileUrl(`${seed}:dither`), [seed]);

  // One offset per frame of the loop, drawn from the seeded PRNG. Indexing by
  // `frame % DURATION` makes the grain animation loop for free.
  const grainOffsets = useMemo(() => {
    const rng = makeRng(`${seed}:grain-walk`);
    return Array.from({length: DURATION}, () => [
      Math.floor(rng() * GRAIN_TILE),
      Math.floor(rng() * GRAIN_TILE),
    ]);
  }, [seed]);

  const [gx, gy] = grainOffsets[((frame % DURATION) + DURATION) % DURATION];

  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 76% 76% at 50% 50%, rgba(0,0,0,0) 34%, rgba(0,0,0,0.4) 70%, rgba(0,0,0,0.8) 100%)',
        }}
      />
      {/* ~1 LSB of static noise. Kills the banding a 4K near-black gradient
          would otherwise show as onion rings. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${ditherUrl})`,
          backgroundRepeat: 'repeat',
          backgroundSize: `${DITHER_TILE}px ${DITHER_TILE}px`,
          mixBlendMode: 'screen',
        }}
      />
      {/* Fine grain, ~2%. Screen-blended from a near-black tile so the black
          point lifts by about one part in a hundred and no more. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${grainUrl})`,
          backgroundRepeat: 'repeat',
          backgroundSize: `${GRAIN_TILE}px ${GRAIN_TILE}px`,
          backgroundPosition: `${gx}px ${gy}px`,
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
};
