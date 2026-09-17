import React from 'react';
import {AbsoluteFill, staticFile} from 'remotion';
import {Framing} from './constants';

/** Deterministic per-frame offset for the grain tile — no accumulation. */
const hash = (n: number, salt: number) => {
  const x = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const GRAIN_TILE = 1024;

/**
 * Photographic finish, composited over the 3D render as DOM layers.
 *
 * V1 gets a lens vignette plus a slight softening of detail and chroma toward
 * the corners. V2 gets the shallow depth of field instead: the sharp band runs
 * 30%-70% of frame height, and only the outer sixth carries real defocus. An
 * earlier, much stronger falloff started ramping at 37% and was softening the
 * emblem itself, which is the product in V2.
 *
 * Both get ~1.5% grain. Without it the V1 sky gradient bands badly in H.264 —
 * and that only shows in the encoded file, not the preview.
 */
export const Grade: React.FC<{
  readonly framing: Framing;
  readonly frame: number;
  readonly width: number;
  readonly height: number;
}> = ({framing, frame, width, height}) => {
  // Grain cell is 2 composition pixels, so it lands at ~1px in the 1080p
  // previews and ~2px at full 4K.
  const grainSize = GRAIN_TILE * 2;
  const ox = Math.floor(hash(frame, 1) * grainSize);
  const oy = Math.floor(hash(frame, 2) * grainSize);

  const vignetteRadius = Math.max(width, height);

  return (
    <>
      {framing === 'closeup' ? (
        <>
          {/* Outer edges only: the strongest defocus. */}
          <AbsoluteFill
            style={{
              backdropFilter: `blur(${height * 0.0055}px)`,
              WebkitBackdropFilter: `blur(${height * 0.0055}px)`,
              maskImage:
                'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 16%, rgba(0,0,0,0) 84%, rgba(0,0,0,1) 100%)',
            }}
          />
          {/* Gentle falloff, stacking onto the layer above. The sharp band runs
              30%-70% of frame height, so it comfortably contains the emblem. */}
          <AbsoluteFill
            style={{
              backdropFilter: `blur(${height * 0.0022}px)`,
              WebkitBackdropFilter: `blur(${height * 0.0022}px)`,
              maskImage:
                'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 70%, rgba(0,0,0,1) 100%)',
            }}
          />
          <AbsoluteFill
            style={{
              background: `radial-gradient(ellipse ${vignetteRadius * 0.8}px ${
                vignetteRadius * 0.68
              }px at 50% 50%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.16) 100%)`,
            }}
          />
        </>
      ) : (
        <>
          {/* Lens falloff: detail and chroma soften toward the corners. */}
          <AbsoluteFill
            style={{
              backdropFilter: `blur(${height * 0.0014}px) saturate(0.94)`,
              WebkitBackdropFilter: `blur(${height * 0.0014}px) saturate(0.94)`,
              maskImage: `radial-gradient(ellipse ${vignetteRadius * 0.66}px ${
                vignetteRadius * 0.56
              }px at 50% 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,1) 100%)`,
            }}
          />
          <AbsoluteFill
            style={{
              background: `radial-gradient(ellipse ${vignetteRadius * 0.8}px ${
                vignetteRadius * 0.68
              }px at 50% 48%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.3) 100%)`,
            }}
          />
        </>
      )}

      <AbsoluteFill
        style={{
          backgroundImage: `url(${staticFile('grain.png')})`,
          backgroundRepeat: 'repeat',
          backgroundSize: `${grainSize}px ${grainSize}px`,
          backgroundPosition: `${ox}px ${oy}px`,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }}
      />
    </>
  );
};
