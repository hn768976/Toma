import {AbsoluteFill} from 'remotion';
import {ArcLayer} from './components/ArcLayer';
import {BackgroundWash} from './components/BackgroundWash';
import {DotMap} from './components/DotMap';
import {FilmFinish} from './components/FilmFinish';
import {NodePulse} from './components/NodePulse';
import type {Tilt, VariantName} from './config';
import {useLandOutline} from './lib/use-land-outline';
import {useScene} from './lib/scene';
import {THEMES} from './theme';

export type NetworkMapProps = {
  variant: VariantName;
};

/**
 * Lays the map plane back in 3D. Only the map, the arcs and the pulses are
 * tilted: the background wash stays flat so it still fills the frame behind the
 * plane, and the vignette and grain stay flat because they belong to the
 * camera, not to the scene.
 *
 * Transforms apply right to left, so the plane is scaled up, then rotated away
 * from the viewer at the top, then nudged vertically in screen space.
 */
const TiltedPlane: React.FC<{tilt: Tilt; children: React.ReactNode}> = ({
  tilt,
  children,
}) => (
  <AbsoluteFill
    style={{perspective: tilt.perspective, perspectiveOrigin: '50% 50%'}}
  >
    <AbsoluteFill
      style={{
        transform: `translateY(${tilt.offsetY}px) rotateX(${tilt.angleDeg}deg) scale(${tilt.scale})`,
        transformOrigin: '50% 50%',
      }}
    >
      {children}
    </AbsoluteFill>
  </AbsoluteFill>
);

/** Wraps the map plane in a tilt when the variant asks for one, otherwise not
 * at all - an identity transform would still isolate the layers into their own
 * stacking context and change how the untilted variant composites. */
const MapPlane: React.FC<{tilt?: Tilt; children: React.ReactNode}> = ({
  tilt,
  children,
}) =>
  tilt ? <TiltedPlane tilt={tilt}>{children}</TiltedPlane> : <>{children}</>;

/**
 * Both versions of the map are this component with a different `variant`.
 * Everything geographic comes from `src/config.ts`.
 */
export const NetworkMap: React.FC<NetworkMapProps> = ({variant}) => {
  const outline = useLandOutline();
  const scene = useScene(variant, outline);

  return (
    <AbsoluteFill style={{backgroundColor: THEMES.backgroundDeep}}>
      <BackgroundWash projection={scene?.projection ?? null} />
      {scene ? (
        <MapPlane tilt={scene.config.tilt}>
          <DotMap
            config={scene.config}
            projection={scene.projection}
            dotMap={scene.dotMap}
          />
          <ArcLayer config={scene.config} arcs={scene.arcs} />
          <NodePulse config={scene.config} arcs={scene.arcs} />
        </MapPlane>
      ) : null}
      <FilmFinish />
    </AbsoluteFill>
  );
};
