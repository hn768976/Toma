import React from 'react';
import {SCANLINE_PITCH, SUBPIXEL_PITCH} from '../constants';

/**
 * At macro range the LCD's own structure is clearly visible: dark row gaps
 * laid over everything lit, plus a much fainter vertical subpixel comb.
 * Drawn as translucent black stripes - no blend mode, so the black panel
 * behind stays black.
 */
export const ScreenFx: React.FC = () => (
  <>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundImage:
          `repeating-linear-gradient(to bottom,` +
          ` rgba(0,0,0,0) 0px,` +
          ` rgba(0,0,0,0) ${SCANLINE_PITCH * 0.5}px,` +
          ` rgba(0,0,0,0.62) ${SCANLINE_PITCH * 0.62}px,` +
          ` rgba(0,0,0,0.62) ${SCANLINE_PITCH}px)`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundImage:
          `repeating-linear-gradient(to right,` +
          ` rgba(0,0,0,0) 0px,` +
          ` rgba(0,0,0,0) ${SUBPIXEL_PITCH * 0.55}px,` +
          ` rgba(0,0,0,0.11) ${SUBPIXEL_PITCH * 0.7}px,` +
          ` rgba(0,0,0,0.11) ${SUBPIXEL_PITCH}px)`,
      }}
    />
  </>
);

export const Vignette: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      background:
        'radial-gradient(125% 135% at 52% 48%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.45) 82%, rgba(0,0,0,0.85) 100%)',
    }}
  />
);
