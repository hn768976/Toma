import {geoDistance} from 'd3-geo';
import type {DotField} from './dots';
import type {HotspotConfig} from '../variants';

export type RegionMembership = {
  /** Indices of the dots inside this region. */
  dots: Uint32Array;
  /** Each dot's distance from the centre, as a fraction of the radius. */
  fraction: Float32Array;
};

/**
 * Which dots belong to which region, resolved once. Per frame this turns the
 * hotspot pass into a walk over a few hundred indices instead of a
 * great-circle test against eight centres for every dot in the field.
 */
export const buildRegionMembership = (
  field: DotField,
  config: HotspotConfig,
): RegionMembership[] =>
  config.regions.map((region) => {
    const radius = (region.radiusDeg * Math.PI) / 180;
    const centre: [number, number] = [region.lon, region.lat];
    const dots: number[] = [];
    const fraction: number[] = [];
    for (let i = 0; i < field.n; i++) {
      const d = geoDistance(centre, [field.lon[i], field.lat[i]]);
      if (d <= radius) {
        dots.push(i);
        fraction.push(d / radius);
      }
    }
    return {
      dots: Uint32Array.from(dots),
      fraction: Float32Array.from(fraction),
    };
  });
