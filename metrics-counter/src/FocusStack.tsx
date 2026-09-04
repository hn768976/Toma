import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {Plane} from './Plane';
import * as L from './layout';
import type {Theme} from './theme';

/**
 * Shallow depth of field, built as a stack of overlapping horizontal slices
 * rather than one gradient blur — a single gradient reads as a filter, whereas
 * discrete slices with soft joins read as optics.
 *
 * Each slice renders the whole plane at one blur radius and is masked so it
 * paints over everything below its `start`, cross-fading in over FEATHER. The
 * blur is applied before the mask, so a slice's edge carries genuinely blurred
 * neighbouring content instead of fading out to nothing, and because each slice
 * covers the entire frame beneath it there are no gaps.
 */
export const FocusStack: React.FC<{theme: Theme}> = ({theme}) => {
  const {height} = useVideoConfig();

  return (
    <AbsoluteFill>
      {L.SLICES.map((slice, i) => {
        // Blur radii are fractions of composition height, so the depth of field
        // is identical at 1080p preview scale and at full 4K.
        const blur = slice.blur * height;
        const start = slice.start * height;
        const feather = L.FEATHER * height;

        const mask =
          i === 0
            ? undefined
            : `linear-gradient(to bottom, rgba(0,0,0,0) ${start - feather}px, rgba(0,0,0,1) ${start}px, rgba(0,0,0,1) 100%)`;

        return (
          <AbsoluteFill
            key={slice.start}
            style={{
              filter: blur > 0 ? `blur(${blur}px)` : undefined,
              maskImage: mask,
              WebkitMaskImage: mask,
            }}
          >
            <Plane theme={theme} />
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};
