import React, {useCallback} from 'react';
import {AbsoluteFill, staticFile} from 'remotion';
import * as THREE from 'three';
import {EXRLoader} from 'three/examples/jsm/loaders/EXRLoader.js';
import {ThreeStage} from '../three/ThreeStage';
import {loadBinary, loadFonts, once, useLoaded} from '../lib/assets';
import {loadLandCoarse, Polygon} from '../lib/geo';
import {CoinScene, RainData} from './CoinScene';
import {COIN_VERSIONS} from './versions';

export type CoinGrowthProps = {version: keyof typeof COIN_VERSIONS};

const loadEnv = () =>
  once('hdri:studio', () => new Promise<THREE.DataTexture>((resolve, reject) => {
    new EXRLoader().load(staticFile('hdri/studio.exr'), resolve, undefined, reject);
  }));

const loadRain = () =>
  once('coinrain', async (): Promise<RainData> => {
    const buf = await loadBinary('coinrain.bin');
    const h = new Uint32Array(buf, 0, 4);
    if (h[0] !== 0x314e5243) throw new Error('coinrain.bin: bad header (run npm run build:coinrain)');
    return {frames: h[1], coins: h[2], floats: h[3], data: new Float32Array(buf, 16)};
  });

type Assets = {env: THREE.DataTexture; rain: RainData | null; land: Polygon[] | null};

const loaders: Record<string, () => Promise<Assets>> = {};
const loaderFor = (version: string) => {
  const v = COIN_VERSIONS[version];
  loaders[version] ??= async () => {
    const [env, rain, land] = await Promise.all([
      loadEnv(),
      v.layout === 'rain' ? loadRain() : Promise.resolve(null),
      v.overlay === 'candlesWarm' ? loadLandCoarse() : Promise.resolve(null),
      loadFonts(),
    ]);
    return {env, rain, land};
  };
  return loaders[version];
};

export const CoinGrowth: React.FC<CoinGrowthProps> = ({version}) => {
  const assets = useLoaded(`coin-assets:${version}`, loaderFor(version));
  const create = useCallback(
    (gl: THREE.WebGLRenderer, w: number, h: number) => new CoinScene(gl, w, h, COIN_VERSIONS[version], assets!.env, assets!.rain, assets!.land),
    [version, assets],
  );
  return <AbsoluteFill style={{backgroundColor: '#E6E8EA'}}>{assets ? <ThreeStage create={create} /> : null}</AbsoluteFill>;
};
