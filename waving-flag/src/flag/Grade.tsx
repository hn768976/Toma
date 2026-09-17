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
 * the corners. V2 gets the shallow depth of field instead: a sharp band across
 * the middle third, progressively blurred toward the top and bottom edges.
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
          {/* Outer edges: strongest defocus. */}
          <AbsoluteFill
            style={{
              backdropFilter: `blur(${height * 0.0075}px)`,
              WebkitBackdropFilter: `blur(${height * 0.0075}px)`,
              maskImage:
                'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 74%, rgba(0,0,0,1) 100%)',
            }}
          />
          {/* Inner falloff, stacking onto the layer above for a smooth ramp. */}
          <AbsoluteFill
            style={{
              backdropFilter: `blur(${height * 0.0035}px)`,
              WebkitBackdropFilter: `blur(${height * 0.0035}px)`,
              maskImage:
                'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 37%, rgba(0,0,0,0) 63%, rgba(0,0,0,1) 100%)',
            }}
          />
          <AbsoluteFill
            style={{
              background: `radial-gradient(ellipse ${vignetteRadius * 0.75}px ${
                vignetteRadius * 0.62
              }px at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.22) 100%)`,
            }}
          />
        </>
      ) : (
        <>
          {/* Lens falloff: detail and chroma soften toward the corners. */}
          <AbsoluteFill
            style={{
              backdropFilter: `blur(${height * 0.0016}px) saturate(0.93)`,
              WebkitBackdropFilter: `blur(${height * 0.0016}px) saturate(0.93)`,
              maskImage: `radial-gradient(ellipse ${vignetteRadius * 0.62}px ${
                vignetteRadius * 0.52
              }px at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,1) 100%)`,
            }}
          />
          <AbsoluteFill
            style={{
              background: `radial-gradient(ellipse ${vignetteRadius * 0.78}px ${
                vignetteRadius * 0.66
              }px at 50% 48%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.34) 100%)`,
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
