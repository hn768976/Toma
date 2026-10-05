import React, {useCallback} from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {ThreeStage} from '../three/ThreeStage';
import {loadFonts, useLoaded} from '../lib/assets';
import {loadMapRasters} from '../lib/geo';
import {LogisticsScene} from './LogisticsScene';
import {MAP_VERSIONS} from './versions';

export type LogisticsMapProps = {version: keyof typeof MAP_VERSIONS; loopCheck?: boolean};

const loadAll = async () => {
  const [rasters] = await Promise.all([loadMapRasters(), loadFonts()]);
  return rasters;
};

export const LogisticsMap: React.FC<LogisticsMapProps> = ({version}) => {
  const rasters = useLoaded('logistics-assets', loadAll);
  const create = useCallback(
    (gl: THREE.WebGLRenderer, w: number, h: number) => new LogisticsScene(gl, w, h, MAP_VERSIONS[version], rasters!),
    [version, rasters],
  );
  return <AbsoluteFill style={{backgroundColor: '#03080A'}}>{rasters ? <ThreeStage create={create} /> : null}</AbsoluteFill>;
};
