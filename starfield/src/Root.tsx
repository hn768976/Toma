import React from 'react';
import {Composition} from 'remotion';
import {DESIGN_H, DESIGN_W, DURATION, FPS} from './starfield/constants';
import {PALETTES} from './starfield/palettes';
import {Starfield, starfieldSchema, type StarfieldProps} from './starfield/Starfield';

const VERSIONS = Object.keys(PALETTES) as StarfieldProps['version'][];

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((version) => (
      <React.Fragment key={version}>
        {/* Delivery master. Also the composition to grab 4K stills from. */}
        <Composition
          id={`Starfield4K-${version}`}
          component={Starfield}
          durationInFrames={DURATION}
          fps={FPS}
          width={DESIGN_W}
          height={DESIGN_H}
          schema={starfieldSchema}
          defaultProps={{version} as StarfieldProps}
        />
        {/* True 1:2 miniature of the master — same design-space geometry. */}
        <Composition
          id={`StarfieldPreview-${version}`}
          component={Starfield}
          durationInFrames={DURATION}
          fps={FPS}
          width={DESIGN_W / 2}
          height={DESIGN_H / 2}
          schema={starfieldSchema}
          defaultProps={{version} as StarfieldProps}
        />
      </React.Fragment>
    ))}
    {/* 601 frames on purpose: frame 600 is the wrap point, so rendering stills
        at frame 0 and frame 600 and diffing them proves the loop is exact.
        See "Verifying the loop" in the README. */}
    <Composition
      id="StarfieldLoopCheck"
      component={Starfield}
      durationInFrames={DURATION + 1}
      fps={FPS}
      width={DESIGN_W / 2}
      height={DESIGN_H / 2}
      schema={starfieldSchema}
      defaultProps={{version: VERSIONS[0]} as StarfieldProps}
    />
  </>
);
