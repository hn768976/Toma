/**
 * The two colourways. Geometry, timing and glitch behaviour are identical
 * between them - only these values change - so the pair reads as matched.
 */
export type ColourwayName = 'green' | 'blue';

export type Colourway = {
  readonly name: ColourwayName;
  /** Near-black base, with the colourway's cast in it. */
  readonly background: string;
  /** The two glitch band colours: the hotter one and the cooler one. */
  readonly bandHot: string;
  readonly bandCool: string;
  /** Country outline, and the brighter leading point of the trace. */
  readonly outline: string;
  readonly traceHead: string;
  /** Country fill, drawn at ~70% opacity. */
  readonly fill: string;
  readonly fillOpacity: number;
  /** Corner blooms, where the field is brightest. */
  readonly bloom: string;
  /** The LOADING ring and counter. */
  readonly ui: string;
};

export const COLOURWAYS: Record<ColourwayName, Colourway> = {
  green: {
    name: 'green',
    background: '#030a04',
    bandHot: '#c8ff20',
    bandCool: '#7aff10',
    outline: '#5bff2a',
    traceHead: '#e8ffd0',
    fill: '#c8ff20',
    fillOpacity: 0.7,
    bloom: '#9bd41a',
    ui: '#a9e830',
  },
  blue: {
    name: 'blue',
    background: '#030814',
    bandHot: '#20d8ff',
    bandCool: '#1080ff',
    outline: '#38e6ff',
    traceHead: '#d8f6ff',
    fill: '#1080ff',
    fillOpacity: 0.7,
    bloom: '#1a6ad4',
    ui: '#30c8e8',
  },
};
