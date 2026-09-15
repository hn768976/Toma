import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Backdrop} from '../components/Backdrop';
import {RunnerFrame} from '../components/RunnerFrame';
import {DriftLines} from '../components/DriftLines';
import {CYAN} from '../theme';

/** Version 2 — same layout, dark cyan, with a light line running the border. */
export const CyanBorder: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#000000'}}>
    <Backdrop palette={CYAN} />
    <DriftLines palette={CYAN} id="cyan" />
    <RunnerFrame palette={CYAN} id="cyan" />
  </AbsoluteFill>
);
