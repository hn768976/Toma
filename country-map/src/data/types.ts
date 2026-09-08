export type Anchor = 'right' | 'left' | 'above' | 'below';

export type City = {
  name: string;
  capital: boolean;
  x: number;
  y: number;
  anchor: Anchor;
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
};
