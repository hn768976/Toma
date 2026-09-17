import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {NoToneMapping} from 'three';
import {Texture} from 'three';
import {aspectOf, countryByCode, textureOf} from '../data/countries';
import {DURATION_IN_FRAMES, FLAG_WORLD_HEIGHT, Framing} from './constants';
import {FlagMesh} from './FlagMesh';
import {useEnvironment} from './useEnvironment';
import {useFlagTexture} from './useFlagTexture';
import {CameraRig} from './CameraRig';
import {Sky} from './Sky';
import {Pole} from './Pole';
import {Grade} from './Grade';

const DEG = Math.PI / 180;

/**
 * Key from the upper front-left, a cool sky fill from above, and a dim bounce
 * from below. No tone mapping: an ACES-style curve would shift the flag's
 * colours, and the exact shade is part of the specification.
 */
const Lights: React.FC = () => (
  <>
    <directionalLight position={[-6, 4.5, 3.2]} intensity={2.35} color="#fff6ea" />
    <hemisphereLight args={['#cfe3f5', '#4a5b6b', 0.5]} />
    <directionalLight position={[1, -3.5, 2.5]} intensity={0.3} color="#dfe6ec" />
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

  // Same apparent size for every country; the true ratio decides which
  // dimension is the binding one.
  const flagHeight = Math.min(visH * 0.46, (visW * 0.5) / aspect);
  const flagWidth = flagHeight * aspect;

  const poleX = -visW / 6; // the left third
  const poleRadius = visH * 0.009;
  const flagCentreY = screenCentreY + visH * 0.15;
  const flagCentreX = poleX + poleRadius + flagWidth / 2;
  const flagTopY = flagCentreY + flagHeight / 2;

  const skyDistance = 60;
  const skyH = 2 * Math.tan((fov / 2) * DEG) * (dist + skyDistance) * 1.45;

  return (
    <>
      <CameraRig position={[0, 0, dist]} tilt={tilt} fov={fov} />
      <Lights />
      <Sky t={t} width={skyH * frameAspect} height={skyH} distance={skyDistance} />
      <Pole
        x={poleX}
        topY={flagTopY + visH * 0.05}
        bottomY={screenCentreY - visH * 1.2}
        radius={poleRadius}
        envMap={envMap}
      />
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

  // Largest 16:9 box that fits inside this flag, then zoomed in so that no
  // edge of the cloth can swing into frame and reveal the background — the
  // shot must read as fabric edge to edge.
  const fitH = Math.min(flagWidth / frameAspect, flagHeight);
  const visH = fitH / 1.32;
  const dist = visH / (2 * Math.tan((fov / 2) * DEG));

  // Framed a little toward the fly, so the folds have grown by the time they
  // cross the frame, while the design stays recognisable.
  const centreU = 0.53;
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
 */
export const WavingFlag: React.FC<{
  readonly countryCode: string;
  readonly framing: Framing;
}> = ({countryCode, framing}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const country = countryByCode(countryCode);
  const aspect = aspectOf(country);
  const frameAspect = width / height;

  // ThreeCanvas draws once, on create, with frameloop "never". Anything that
  // arrives asynchronously after that draw would simply be missing from the
  // frame, so the texture is resolved before the canvas mounts.
  const texture = useFlagTexture(textureOf(country));

  // Loop phase. Every wave term completes a whole number of cycles over this
  // range, so the last frame hands back to the first.
  const t = (frame % DURATION_IN_FRAMES) / DURATION_IN_FRAMES;

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
