import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {BackgroundWash} from './components/BackgroundWash';
import {DotGrid} from './components/DotGrid';
import {GrainVignette} from './components/GrainVignette';
import {useDotField} from './lib/useDotField';
import {VARIANTS} from './variants';
import type {VariantName} from './variants';

export type DotMapProps = {
  variant: VariantName;
};

export const DotMap: React.FC<DotMapProps> = ({variant}) => {
  const config = VARIANTS[variant];
  const {width, height} = useVideoConfig();
  const field = useDotField(width, height);

  return (
    <AbsoluteFill style={{backgroundColor: config.palette.deep}}>
      {field ? (
        <>
          <BackgroundWash field={field} config={config} />
          <DotGrid field={field} config={config} />
          <GrainVignette config={config} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
