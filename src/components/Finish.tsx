import React, {useMemo} from 'react';
import {AbsoluteFill, random} from 'remotion';
import {THEMES, withAlpha, type Variant} from '../theme';

const GRAIN_TILE = 256;

/** Vignette and fine film grain, sitting above everything. */
export const Finish: React.FC<{variant: Variant}> = ({variant}) => {
  const theme = THEMES[variant];

  const grainUrl = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = GRAIN_TILE;
    c.height = GRAIN_TILE;
    const ctx = c.getContext('2d');
    if (!ctx) return '';

    const r = parseInt(theme.grain.slice(1, 3), 16);
    const g = parseInt(theme.grain.slice(3, 5), 16);
    const b = parseInt(theme.grain.slice(5, 7), 16);

    const img = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
    for (let i = 0; i < GRAIN_TILE * GRAIN_TILE; i++) {
      const o = i * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = Math.floor(random(`grain-${variant}-${i}`) * 256);
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }, [variant, theme.grain]);

  return (
    <>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 62% 62% at 50% 50%, ${withAlpha(
            theme.vignette,
            0,
          )} 0%, ${withAlpha(theme.vignette, 0.05)} 62%, ${withAlpha(
            theme.vignette,
            0.15,
          )} 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `url(${grainUrl})`,
          backgroundRepeat: 'repeat',
          backgroundSize: `${GRAIN_TILE}px ${GRAIN_TILE}px`,
          opacity: 0.03,
        }}
      />
    </>
  );
};
