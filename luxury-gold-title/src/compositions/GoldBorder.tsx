import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Backdrop} from '../components/Backdrop';
import {ShimmerFrame} from '../components/ShimmerFrame';
import {GOLD} from '../theme';

/** Version 1 — a like-for-like recreation of the reference clip. */
export const GoldBorder: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#000000'}}>
    <Backdrop palette={GOLD} />
    <ShimmerFrame palette={GOLD} id="gold" />
  </AbsoluteFill>
);
