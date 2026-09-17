import data from './countries.json';

export type Country = {
  code: string;
  name: string;
  slug: string;
  /** Official proportion as the specification states it: [height, width]. */
  ratio: [number, number];
  svgViewBox?: string;
  ratioNote?: string;
  textDirection?: string;
  textNote?: string;
};

export const COUNTRIES = data.countries as Country[];
export const TEXTURE_LONG_EDGE = data.textureLongEdge;

/** width / height */
export const aspectOf = (c: Country) => c.ratio[1] / c.ratio[0];
export const ratioLabel = (c: Country) => `${c.ratio[0]}:${c.ratio[1]}`;
export const textureOf = (c: Country) => `flags/${c.code}.png`;

export const countryByCode = (code: string): Country => {
  const found = COUNTRIES.find((c) => c.code === code);
  if (!found) throw new Error(`Unknown country code: ${code}`);
  return found;
};
