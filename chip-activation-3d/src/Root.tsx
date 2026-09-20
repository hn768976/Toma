import React from 'react';
import { Composition } from 'remotion';
import { WebGPUStage } from './engine/WebGPUStage';
import { THEMES, VERSION_IDS, type Theme } from './themes';

export const FPS = 30;

export interface Variant {
  id: string;
  width: number;
  height: number;
  suffix: string;
}

/**
 * Both variants exist for every version. The 4K composition is the master —
 * it is what the project ships for re-rendering — and the 1080p one is the
 * same scene at delivery size, not a downscale, so the 1080p files are
 * natively rendered rather than resampled.
 */
export const VARIANTS: Variant[] = [
  { id: '4K', width: 3840, height: 2160, suffix: '4K' },
  { id: '1080p', width: 1920, height: 1080, suffix: '1080p' },
];

/** Frames are rounded from each reference clip's exact duration at 30fps. */
export const durationInFrames = (theme: Theme) =>
  Math.round(theme.durationInSeconds * FPS);

export const compositionId = (themeId: string, suffix: string) =>
  `${themeId.toUpperCase()}-${suffix}`;

/**
 * Composition props. `disablePost`, `forceWebGL` and `textureSize` are
 * diagnostics — pass them through --props when developing the look or
 * narrowing down a driver problem; the delivered renders use the defaults.
 */
export interface SceneProps {
  themeId: keyof typeof THEMES;
  disablePost?: boolean;
  forceWebGL?: boolean;
  textureSize?: number;
}

const Scene: React.FC<SceneProps> = ({ themeId, disablePost, forceWebGL, textureSize }) => (
  <WebGPUStage
    theme={THEMES[themeId]}
    disablePost={disablePost}
    forceWebGL={forceWebGL}
    textureSizeOverride={textureSize}
  />
);

export const RemotionRoot: React.FC = () => (
  <>
    {VERSION_IDS.flatMap((id) => {
      const theme = THEMES[id];
      return VARIANTS.map((v) => (
        <Composition
          key={compositionId(id, v.suffix)}
          id={compositionId(id, v.suffix)}
          component={Scene}
          durationInFrames={durationInFrames(theme)}
          fps={FPS}
          width={v.width}
          height={v.height}
          defaultProps={{ themeId: id }}
        />
      ));
    })}
  </>
);
