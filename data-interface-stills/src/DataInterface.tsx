import React, {useCallback, useMemo, useRef, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender, useVideoConfig} from 'remotion';
import {BinaryBlock} from './interface/components/BinaryBlock';
import {ChartPanel} from './interface/components/ChartPanel';
import {FocusPass} from './interface/components/FocusPass';
import {GridPlane} from './interface/components/GridPlane';
import {LabelledPanel} from './interface/components/LabelledPanel';
import {NodeWeb} from './interface/components/NodeWeb';
import type {BlockProps} from './interface/components/shared';
import {TablePanel} from './interface/components/TablePanel';
import {WaveformPanel} from './interface/components/WaveformPanel';
import {LAYOUTS} from './interface/layouts';
import {PALETTES, type PaletteName} from './interface/palettes';
import {bucketForDepth, depthAt} from './interface/plane';
import {Rng} from './interface/rng';
import {
  DENSITIES,
  type ContentKind,
  type DensityName,
  type LayoutName,
  type Tilt,
} from './interface/types';

export type DataInterfaceProps = {
  seed: string;
  palette: PaletteName;
  layout: LayoutName;
  tilt: Tilt;
  density: DensityName;
};

const KIND_COMPONENTS: Record<ContentKind, React.FC<BlockProps>> = {
  binary: BinaryBlock,
  labelled: LabelledPanel,
  chart: ChartPanel,
  table: TablePanel,
  waveform: WaveformPanel,
};

/**
 * A single still: one tilted plane of interface panels, drawn once into a
 * canvas. Every visible decision comes from the five props.
 */
export const DataInterface: React.FC<DataInterfaceProps> = ({
  seed,
  palette,
  layout,
  tilt,
  density,
}) => {
  const {width, height} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [handle] = useState(() => delayRender(`Drawing still "${seed}"`));
  const onComplete = useCallback(() => continueRender(handle), [handle]);

  const p = PALETTES[palette] ?? PALETTES.blue;
  const densitySpec = DENSITIES[density] ?? DENSITIES.medium;
  const build = LAYOUTS[layout] ?? LAYOUTS.leftBinary;

  const scene = useMemo(
    () => build(new Rng(`${seed}|layout|${layout}|${density}`), densitySpec),
    [build, seed, layout, density, densitySpec],
  );

  return (
    <AbsoluteFill style={{backgroundColor: p.bg}}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{width: '100%', height: '100%', display: 'block'}}
      />
      <FocusPass
        canvasRef={canvasRef}
        width={width}
        height={height}
        palette={p}
        tilt={tilt}
        seed={seed}
        onComplete={onComplete}
      >
        <GridPlane palette={p} tilt={tilt} z={0} />
        {scene.regions.map((region, i) => {
          const Component = KIND_COMPONENTS[region.kind];
          const centre = region.x + region.w / 2;
          return (
            <Component
              key={`r${i}`}
              rect={region}
              palette={p}
              rng={new Rng(`${seed}|block|${i}|${region.kind}`)}
              density={densitySpec}
              scale={region.scale}
              bucket={bucketForDepth(depthAt(centre, tilt))}
              z={i + 1}
            />
          );
        })}
        {scene.webs.map((spec, i) => (
          <NodeWeb
            key={`w${i}`}
            spec={spec}
            palette={p}
            rng={new Rng(`${seed}|web|${i}`)}
            tilt={tilt}
            z={900 + i}
          />
        ))}
      </FocusPass>
    </AbsoluteFill>
  );
};
