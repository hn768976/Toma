export type Anchor = 'right' | 'left' | 'above' | 'below';

export type City = {
  name: string;
  capital: boolean;
  x: number;
  y: number;
  anchor: Anchor;
  // Set when the label had to be pushed away from a crowded cluster; the
  // composition draws a leader line from the marker to this point.
  leader?: {x: number; y: number};
};

export type Placed = {name: string; x: number; y: number};

// Everything below is produced by tools/bake.mjs, in composition coordinates
// (3840 x 2160). See README.md.
export type CountryGeo = {
  slug: string;
  name: string;
  subjectBox: [number, number, number, number];
  subject: string;
  borders: string;
  lakes: string;
  neighbours: Placed[];
  seas: Placed[];
  cities: City[];
  capital: {x: number; y: number};
  nameAt: {x: number; y: number};
  nameSize: number;
  territories: 'include' | 'mainland-only' | 'inset';
  insets: Inset[];
};

// A distant territory drawn into a box in a corner — Alaska on a map of the
// United States. Produced by tools/bake.mjs in composition coordinates.
export type Inset = {
  box: [number, number, number, number];
  image: [number, number, number, number];
  plate: string;
  subject: string;
  borders: string;
  label: string | null;
};
