import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {VARIANT, VARIANT_KEY} from './variants';
import {buildScene} from './geometry';
import {energyProfile} from './motion';
import {BackgroundWash} from './components/BackgroundWash';
import {FilamentBundle} from './components/FilamentBundle';
import {SynapseLayer} from './components/SynapseLayer';
import {NeuronNode} from './components/NeuronNode';
import {ParticleField} from './components/ParticleField';
import {FinishLayer} from './components/FinishLayer';

export const NeuronField: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const cfg = VARIANT;

  // The entire seeded scene is generated once; every frame only applies
  // motion offsets to it.
  const scene = useMemo(() => buildScene(VARIANT_KEY, cfg, width, height), [cfg, width, height]);

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
