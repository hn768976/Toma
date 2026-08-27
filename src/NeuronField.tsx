import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {VariantKey} from './variants';
import {VARIANTS} from './variants';
import {buildScene} from './geometry';
import {energyProfile} from './motion';
import {BackgroundWash} from './components/BackgroundWash';
import {FilamentBundle} from './components/FilamentBundle';
import {SynapseLayer} from './components/SynapseLayer';
import {NeuronNode} from './components/NeuronNode';
import {ParticleField} from './components/ParticleField';
import {FinishLayer} from './components/FinishLayer';

export type NeuronFieldProps = {
  variant: VariantKey;
};

export const NeuronField: React.FC<NeuronFieldProps> = ({variant}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const cfg = VARIANTS[variant];

  // The entire seeded scene is generated once; every frame only applies
  // motion offsets to it.
  const scene = useMemo(() => buildScene(variant, cfg, width, height), [variant, cfg, width, height]);

  const energy =
    cfg.motionMode === 'retract' && cfg.retract ? energyProfile(frame, cfg.retract) : 0;

  return (
    <AbsoluteFill style={{backgroundColor: cfg.palette.bgDeep}}>
      <BackgroundWash cfg={cfg} width={width} height={height} />
      <FilamentBundle scene={scene} cfg={cfg} frame={frame} width={width} height={height} />
      <SynapseLayer scene={scene} cfg={cfg} frame={frame} width={width} height={height} />
      {scene.nodes.map((node, i) => (
        <NeuronNode key={i} node={node} cfg={cfg} frame={frame} energy={energy} />
      ))}
      <ParticleField scene={scene} cfg={cfg} frame={frame} width={width} height={height} />
      <FinishLayer frame={frame} width={width} height={height} />
    </AbsoluteFill>
  );
};
