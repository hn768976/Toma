import React from 'react';
import { PixiStage, type SceneFactory } from './lib/PixiStage';
import type { Row } from './data';
import { flareScene } from './looks/flare';
import { galaxyScene } from './looks/galaxy';
import { neuralScene } from './looks/neural';
import { inkScene } from './looks/inkbloom';
import { lightningScene } from './looks/lightning';

const FACTORIES: Record<Row['look'], SceneFactory<any>> = {
  flare: flareScene,
  galaxy: galaxyScene,
  neural: neuralScene,
  inkbloom: inkScene,
  lightning: lightningScene,
} as any;

export const Look: React.FC<{ row: Row; durationOverride?: number }> = ({ row }) => (
  <PixiStage factory={FACTORIES[row.look]} params={{ ...row.params, loopFrames: row.frames }} />
);
