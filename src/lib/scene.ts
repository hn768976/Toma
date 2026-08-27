import {buildGridLines, type GridLines} from './grid';
import {buildMaskField, type MaskField} from './mask';
import {sampleParticles, type ParticleSet} from './particles';
import {buildSphere, type SphereField} from './sphere'; // @only:sphere
import {buildStreams, type StreamField} from './streams'; // @only:stream
import {VARIANTS, type VariantName} from '../variants';

export type Scene = {
  field: MaskField;
  grid: GridLines;
  particles: ParticleSet;
  streams: StreamField | null; // @only:stream
  sphere: SphereField | null; // @only:sphere
};

/**
 * The particle set is sampled exactly once per variant and then reused for
 * every frame. Re-sampling per frame would make the figure boil.
 */
const cache = new Map<VariantName, Scene>();

export const getScene = (variant: VariantName): Scene => {
  const hit = cache.get(variant);
  if (hit) return hit;

  const spec = VARIANTS[variant];
  const field = buildMaskField(spec.silhouette, spec.creases);
  const scene: Scene = {
    field,
    grid: buildGridLines(field),
    particles: sampleParticles(field, `${variant}:subject`),
    streams: spec.subject === 'stream' ? buildStreams(field, `${variant}:flow`) : null, // @only:stream
    sphere: spec.subject === 'sphere' ? buildSphere(`${variant}:orb`) : null, // @only:sphere
  };
  cache.set(variant, scene);
  return scene;
};
