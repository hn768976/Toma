import {useMemo} from 'react';
import {
  FRAME_HEIGHT,
  FRAME_WIDTH,
  getVariant,
  type VariantConfig,
  type VariantName,
} from '../config';
import {buildArcs, type Arc} from './arcs';
import {generateDotMap, type DotMapData} from './dot-map';
import {createLandMask, type LandOutline} from './land-mask';
import {createProjection, type Projection} from './projection';

export type Scene = {
  config: VariantConfig;
  projection: Projection;
  dotMap: DotMapData;
  arcs: Arc[];
};

/**
 * The dot map is expensive to generate and completely static, so it is built
 * once per variant per render tab and reused for every frame.
 */
const sceneCache = new Map<VariantName, Scene>();

const buildScene = (variant: VariantName, outline: LandOutline): Scene => {
  const config = getVariant(variant);
  const projection = createProjection(
    config.viewport,
    FRAME_WIDTH,
    FRAME_HEIGHT,
    config.fit,
  );
  const mask = createLandMask(outline);
  const dotMap = generateDotMap(config, projection, mask, FRAME_WIDTH, FRAME_HEIGHT);
  const arcs = buildArcs(config, projection);
  return {config, projection, dotMap, arcs};
};

export const useScene = (
  variant: VariantName,
  outline: LandOutline | null,
): Scene | null =>
  useMemo(() => {
    if (!outline) return null;
    const hit = sceneCache.get(variant);
    if (hit) return hit;
    const scene = buildScene(variant, outline);
    sceneCache.set(variant, scene);
    return scene;
  }, [variant, outline]);
