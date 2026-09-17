import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {NoToneMapping, Texture} from 'three';
import {aspectOf, countryByCode, textureOf} from '../data/countries';
import {DURATION_IN_FRAMES, FLAG_WORLD_HEIGHT, Framing, TEXTURE_TIER} from './constants';
import {FlagMesh} from './FlagMesh';
import {useEnvironment} from './useEnvironment';
import {useFlagTexture} from './useFlagTexture';
import {CameraRig} from './CameraRig';
import {Sky} from './Sky';
import {Pole} from './Pole';
import {Grade} from './Grade';

const DEG = Math.PI / 180;

/**
 * Key well off-axis from the upper front-left, so every fold has a clearly lit
 * flank and a clearly shaded one; a cool sky fill from above; a dim bounce from
 * below. The fill is kept low deliberately — a soft, frontal key is what makes
 * cloth read as a printed image on a curved surface.
 *
 * No tone mapping: an ACES-style curve would shift the flag's colours, and the
 * exact shade is part of the specification.
 */
const Lights: React.FC = () => (
  <>
    <directionalLight position={[-7, 4.2, 2.4]} intensity={3.0} color="#fff4e4" />
    <hemisphereLight args={['#cfe3f5', '#48596a', 0.32]} />
    <directionalLight position={[1.5, -3.5, 2.0]} intensity={0.22} color="#dfe6ec" />
  </>
);

const V1Scene: React.FC<{
  readonly texture: Texture;
  readonly t: number;
  readonly aspect: number;
  readonly frameAspect: number;
}> = ({texture, t, aspect, frameAspect}) => {
  const envMap = useEnvironment();
  const fov = 30;
  const dist = 6;
  const tilt = 4 * DEG; // looking up a few degrees
  const visH = 2 * Math.tan((fov / 2) * DEG) * dist;
  const visW = visH * frameAspect;
  const screenCentreY = dist * Math.tan(tilt);

  // The flag dominates the frame: roughly 55-60% of frame width for typical
  // ratios. Whichever dimension binds first decides, so a square flag and a 1:2
  // flag read as the same size of object without either being distorted.
  const flagHeight = Math.min(visH * 0.62, (visW * 0.58) / aspect);
  const flagWidth = flagHeight * aspect;

  const poleX = -visW / 6; // the left third
  const poleRadius = visH * 0.0225; // a substantial mast, not a stick
  const poleZ = 0.15; // sits forward of the cloth, toward camera

  // Sitting close to the vertical centre, so the sky reads as background.
  const flagCentreY = screenCentreY + visH * 0.04;
  const flagCentreX = poleX + poleRadius + flagWidth / 2;
  const flagTopY = flagCentreY + flagHeight / 2;
  const flagBottomY = flagCentreY - flagHeight / 2;

  const skyDistance = 60;
  const skyH = 2 * Math.tan((fov / 2) * DEG) * (dist + skyDistance) * 1.45;

  return (
    <>
      <CameraRig position={[0, 0, dist]} tilt={tilt} fov={fov} />
      <Lights />
      <Sky t={t} width={skyH * frameAspect} height={skyH} distance={skyDistance} />
      <group position={[0, 0, poleZ]}>
        <Pole
          x={poleX}
          topY={flagTopY + visH * 0.035}
          bottomY={screenCentreY - visH * 1.3}
          radius={poleRadius}
          envMap={envMap}
          hoistTopY={flagTopY}
          hoistBottomY={flagBottomY}
        />
      </group>
      <FlagMesh
        texture={texture}
        envMap={envMap}
        aspect={aspect}
        worldHeight={flagHeight}
        framing="pole"
        t={t}
        position={[flagCentreX, flagCentreY, 0]}
      />
    </>
  );
};

const V2Scene: React.FC<{
  readonly texture: Texture;
  readonly t: number;
  readonly aspect: number;
  readonly frameAspect: number;
}> = ({texture, t, aspect, frameAspect}) => {
  const envMap = useEnvironment();
  const fov = 30;
  const flagHeight = FLAG_WORLD_HEIGHT;
  const flagWidth = flagHeight * aspect;

  // Largest 16:9 box that fits inside this flag, then zoomed in so no edge of
  // the cloth can swing into frame and show background.
  const fitH = Math.min(flagWidth / frameAspect, flagHeight);
  const visH = fitH / 1.3;
  const visW = visH * frameAspect;
  const dist = visH / (2 * Math.tan((fov / 2) * DEG));

  // Framed toward the fly, where the quadratic envelope has let the folds grow.
  // Clamped so the window never reaches either edge of the cloth, whatever the
  // country's ratio — a square flag and a 1:2 flag need different centres.
  const halfU = visW / 2 / flagWidth;
  const centreU = Math.min(Math.max(0.58, 0.10 + halfU), 0.90 - halfU);
  const offsetX = (centreU - 0.5) * flagWidth;

  return (
    <>
      <CameraRig position={[offsetX, 0, dist]} tilt={0} fov={fov} />
      <Lights />
      <FlagMesh
        texture={texture}
        envMap={envMap}
        aspect={aspect}
        worldHeight={flagHeight}
        framing="closeup"
        t={t}
      />
    </>
  );
};

/**
 * The template. Mesh, wave, lighting and camera are identical for every
 * country — only the texture and the flag's true aspect ratio change, both of
 * which come from the data set in src/data/countries.json.
 *
 * `shutterOffset` displaces the sampled time by a fraction of a frame. Rendering
 * the composition several times at different offsets and averaging the results
 * is how the motion blur is produced (scripts/render-motion-blur.mjs); it stays
 * a pure function of the frame, so frames can still be rendered out of order.
 */
export const WavingFlag: React.FC<{
  countryCode: string;
  framing: Framing;
  shutterOffset?: number;
}> = ({countryCode, framing, shutterOffset = 0}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const country = countryByCode(countryCode);
  const aspect = aspectOf(country);
  const frameAspect = width / height;

  // ThreeCanvas draws once, on create, with frameloop "never". Anything that
  // arrives asynchronously after that draw would be missing from the frame, so
  // the texture is resolved before the canvas mounts.
  const texture = useFlagTexture(textureOf(country, TEXTURE_TIER[framing]));

  // Loop phase. Every wave term completes a whole number of cycles over this
  // range, so the last frame hands back to the first. The modulo keeps a
  // positive sub-frame offset from running past the end of the loop.
  const t =
    (((frame + shutterOffset) % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES /
    DURATION_IN_FRAMES;

  return (
    <AbsoluteFill style={{backgroundColor: '#0b1622'}}>
      {texture ? (
        <ThreeCanvas
          width={width}
          height={height}
          gl={{antialias: true, toneMapping: NoToneMapping}}
          style={{position: 'absolute', inset: 0}}
        >
          {framing === 'pole' ? (
            <V1Scene texture={texture} t={t} aspect={aspect} frameAspect={frameAspect} />
          ) : (
            <V2Scene texture={texture} t={t} aspect={aspect} frameAspect={frameAspect} />
          )}
        </ThreeCanvas>
      ) : null}
      <Grade framing={framing} frame={frame} width={width} height={height} />
    </AbsoluteFill>
  );
};
