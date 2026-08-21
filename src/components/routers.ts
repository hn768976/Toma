/**
 * The twelve router dots, in map-viewBox coordinates. Positions come from real
 * lon/lat through the same projection as the coastline, nudged a unit or two
 * where a city sits right on its own shoreline so every dot lands on land.
 */
export type Router = {id: string; x: number; y: number};

export const ROUTERS: Router[] = [
  {id: 'seattle', x: 166, y: 116},
  {id: 'losAngeles', x: 183, y: 155},
  {id: 'chicago', x: 256, y: 133},
  {id: 'virginia', x: 290, y: 148},
  {id: 'miami', x: 274, y: 175},
  {id: 'iceland', x: 452, y: 69},
  {id: 'london', x: 496, y: 110},
  {id: 'frankfurt', x: 520, y: 112},
  {id: 'marseille', x: 514, y: 132},
  {id: 'saoPaulo', x: 362, y: 312},
  {id: 'lagos', x: 512, y: 238},
  {id: 'singapore', x: 786, y: 240},
];

export const router = (id: string): Router => {
  const found = ROUTERS.find((r) => r.id === id);
  if (!found) {
    throw new Error(`Unknown router: ${id}`);
  }
  return found;
};
