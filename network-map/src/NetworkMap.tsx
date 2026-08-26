import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ArcLayer} from './components/ArcLayer';
import {BackgroundWash} from './components/BackgroundWash';
import {DotMap} from './components/DotMap';
import {FilmFinish} from './components/FilmFinish';
import {NodePulse} from './components/NodePulse';
import {getVariant, LOOP_FRAMES, type Tilt, type VariantName} from './config';
import {useLandOutline} from './lib/use-land-outline';
import {useScene} from './lib/scene';

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
}) => {
  const frame = useCurrentFrame();
  // Eases in over the first half of the loop and back out over the second. Both
  // the value and its rate of change are zero at frame 0 and frame 600, so the
  // push-in closes the loop instead of snapping back.
  const t = (frame % LOOP_FRAMES) / LOOP_FRAMES;
  const push = 1 + tilt.zoom * (1 - Math.cos(2 * Math.PI * t)) * 0.5;
  const scale = tilt.scale * push;

  return (
    <AbsoluteFill
      style={{perspective: tilt.perspective, perspectiveOrigin: '50% 50%'}}
    >
      <AbsoluteFill
        style={{
          transform: `translateY(${tilt.offsetY}px) rotateX(${tilt.angleDeg}deg) scale(${scale})`,
          transformOrigin: '50% 50%',
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

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
  // Read straight from the config rather than the scene, so the frame is the
  // right colour even on the frames where the outline is still loading.
  const {background} = getVariant(variant);

  return (
    <AbsoluteFill style={{backgroundColor: background.deep}}>
      <BackgroundWash
        background={background}
        projection={scene?.projection ?? null}
      />
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
