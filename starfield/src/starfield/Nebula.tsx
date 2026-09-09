import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {DESIGN_W, DURATION} from './constants';
import {makeCloudTileUrl} from './noise';
import type {NebulaRegion, Palette} from './palettes';

/** Tile footprints in 4K px. Two very different scales read as depth. */
const LAYER_TILES = [2600, 1720];

type Props = {palette: Palette; seed: number};

const Region: React.FC<{
  region: NebulaRegion;
  tiles: string[];
  t: number;
  scale: number;
}> = ({region, tiles, t, scale}) => {
  const mask = `radial-gradient(ellipse ${region.size} at ${region.at}, #000 0%, rgba(0,0,0,0.62) 46%, rgba(0,0,0,0) 80%)`;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        mixBlendMode: 'screen',
        opacity: region.opacity,
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    >
      {tiles.map((url, i) => {
        // Each layer walks a circle of its own radius and direction. One layer
        // alone would just slide; two out-of-phase layers interfere, which is
        // what makes the cloud appear to morph while only the offset animates.
        const dir = i === 0 ? 1 : -1;
        const phase = i * 1.9;
        const r = region.sway[i];
        const ax = Math.cos(Math.PI * 2 * t * dir + phase) * r * scale;
        const ay = Math.sin(Math.PI * 2 * t * dir + phase) * r * scale;
        const size = LAYER_TILES[i] * scale;
        const layerMask = `url(${url})`;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `linear-gradient(${region.angle}deg, ${region.from}, ${region.to})`,
              mixBlendMode: i === 0 ? 'normal' : 'screen',
              opacity: i === 0 ? 1 : 0.8,
              WebkitMaskImage: layerMask,
              maskImage: layerMask,
              WebkitMaskRepeat: 'repeat',
              maskRepeat: 'repeat',
              WebkitMaskSize: `${size}px ${size}px`,
              maskSize: `${size}px ${size}px`,
              WebkitMaskPosition: `${ax}px ${ay}px`,
              maskPosition: `${ax}px ${ay}px`,
            }}
          />
        );
      })}
    </div>
  );
};

export const Nebula: React.FC<Props> = ({palette, seed}) => {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const scale = width / DESIGN_W;
  const t = (frame % DURATION) / DURATION;

  // Two uncorrelated tileable cloud fields, shared by both regions.
  const tiles = useMemo(
    () => [
      makeCloudTileUrl(`${palette.id}:${seed}:cloud-a`, 512, 0.41, 0.86, 1.15),
      makeCloudTileUrl(`${palette.id}:${seed}:cloud-b`, 512, 0.45, 0.92, 1.35),
    ],
    [palette.id, seed],
  );

  return (
    <>
      {palette.regions.map((region, i) => (
        <Region key={i} region={region} tiles={tiles} t={t} scale={scale} />
      ))}
    </>
  );
};
