import {AbsoluteFill} from 'remotion';
import {ArcLayer} from './components/ArcLayer';
import {BackgroundWash} from './components/BackgroundWash';
import {DotMap} from './components/DotMap';
import {FilmFinish} from './components/FilmFinish';
import {NodePulse} from './components/NodePulse';
import type {VariantName} from './config';
import {useLandOutline} from './lib/use-land-outline';
import {useScene} from './lib/scene';
import {THEMES} from './theme';

export type NetworkMapProps = {
  variant: VariantName;
};

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
        <>
          <DotMap
            config={scene.config}
            projection={scene.projection}
            dotMap={scene.dotMap}
          />
          <ArcLayer config={scene.config} arcs={scene.arcs} />
          <NodePulse config={scene.config} arcs={scene.arcs} />
        </>
      ) : null}
      <FilmFinish />
    </AbsoluteFill>
  );
};
