import React from 'react';
import { PLANE_H, PLANE_W } from '../constants';
import type { Theme } from '../theme';
import { Decor } from './Decor';
import { Grid } from './Grid';
import { Panels } from './Panels';
import { Readouts } from './Readouts';
import { CentreAxis } from './CentreAxis';
import { ScanBand } from './ScanBand';
import { ScanFall } from './ScanFall';
import { Sphere } from './Sphere';

/**
 * Everything that lives on the raked plane, in plane coordinates.
 *
 * `variant` picks the full dashboard or the bright-only pass that feeds bloom.
 */
export const PlaneContent: React.FC<{
  theme: Theme;
  frame: number;
  variant?: 'full' | 'bloom';
  idPrefix: string;
}> = ({ theme, frame, variant = 'full', idPrefix }) => {
  const bloom = variant === 'bloom';
  return (
    <svg
      width={PLANE_W}
      height={PLANE_H}
      viewBox={`0 0 ${PLANE_W} ${PLANE_H}`}
      style={{ display: 'block', overflow: 'visible' }}
      fontFamily="ScanMono, ui-monospace, monospace"
      shapeRendering="geometricPrecision"
    >
      {!bloom ? (
        <>
          <Grid theme={theme} />
          <CentreAxis theme={theme} frame={frame} />
          <Readouts theme={theme} frame={frame} />
          <Panels theme={theme} frame={frame} />
          <Decor theme={theme} frame={frame} />
        </>
      ) : null}
      <ScanFall theme={theme} frame={frame} idPrefix={idPrefix} bloom={bloom} />
      <Sphere theme={theme} frame={frame} bloom={bloom} />
      <ScanBand theme={theme} frame={frame} idPrefix={idPrefix} bloom={bloom} />
    </svg>
  );
};
