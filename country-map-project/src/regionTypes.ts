/** Shape of the baked region JSON produced by scripts/build-assets.ts. */

import type {BakedFraming} from './geo/projection';

export interface LabelPoint {
  name: string;
  x: number;
  y: number;
}

export interface CityPoint extends LabelPoint {
  capital: boolean;
  /** Which side of the marker the label was placed on, resolved offline. */
  side: 'r' | 'l' | 't' | 'b' | 'tr' | 'br' | 'tl' | 'bl';
}

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SatelliteData {
  planeWidth: number;
  lon0: number;
  /** Horizontal squeeze eased in with the zoom, correcting equirectangular
   *  longitude stretch by the time the closing frame lands. */
  kx: number;
  openScale: number;
  endScale: number;
  zoomFactor: number;
  openCenter: [number, number];
  endCenter: [number, number];
  subjectPath: string;
  subjectBBox: BBox;
  /** Bounding box of the parts the framing actually fits, excluding distant
   *  territories that are drawn but never pull the frame. */
  fitBBox: BBox;
  title: {x: number; y: number};
  world: {file: string; x: number; y: number; w: number; h: number};
  /** null when the closing frame is wide enough that the world layer already
   *  carries the right resolution. */
  crop: {file: string; x: number; y: number; w: number; h: number} | null;
  /** Zoom progress at which the close-up crop reaches full opacity. */
  cropFadeEnd: number;
  flag: {
    viewBox: number[];
    inner: string;
    rect: {x: number; y: number; w: number; h: number};
  } | null;
  flagRatioOk: boolean | null;
  endSpanKm: number;
  endMetresPerPixel: number;
  sourceMetresPerPixel: number;
  upscale: number;
}

export interface Region {
  code: string;
  name: string;
  displayName: string;
  framing: BakedFraming;
  paths: {
    land: string;
    lakes: string;
    coast: string;
    borders: string;
    subject: string;
  };
  subjectBBox: BBox;
  /** Bounding box of the parts the framing actually fits, excluding distant
   *  territories that are drawn but never pull the frame. */
  fitBBox: BBox;
  title: {x: number; y: number};
  /** Upper bound on the rendered width of the country name, resolved offline
   *  against both the frame and the country's own extent. */
  titleMaxWidth: number;
  neighbourLabels: LabelPoint[];
  marineLabels: LabelPoint[];
  cities: CityPoint[];
  /** The shortlist the label placer worked from, before collisions thinned it. */
  cityCandidates: string[];
  relief: {
    width: number;
    height: number;
    files: Record<string, string>;
  };
  v3: SatelliteData | null;
}
