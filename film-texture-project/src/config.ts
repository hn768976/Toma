export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION = 600; // 20s, seamless loop

/** Design space is 4K; `scale` converts it to output device pixels. */
export type Version = {
  id: string;
  seed: number;

  /** Dust specks spawned per frame; each lives 1-3 frames. */
  dustSpawnMin: number;
  dustSpawnMax: number;

  /** Lanes for hairs; a hard ceiling on how many are on screen at once. */
  hairLanes: number;
  /** Share of each hair lane's spans that actually carry a hair. */
  hairOccupancy: number;

  /** Concurrent scratch lanes, and the share of each lane's slots that carry one. */
  scratchLanes: number;
  scratchOccupancy: number;

  gateBorder: boolean;
  /** Horizontal weave of the whole plate, in output device pixels. */
  weavePx: number;
  /** Peak dimming of the white field, as a fraction (0.04 = 4%). */
  flickerDepth: number;
};

export const VERSIONS: Record<string, Version> = {
  // Heavy 16mm: dense dust, frequent scratches, visible gate, strong flicker.
  'V1-FilmTextureHeavy': {
    id: 'V1-FilmTextureHeavy',
    seed: 0x16aa,
    dustSpawnMin: 22,
    dustSpawnMax: 37,
    hairLanes: 2,
    hairOccupancy: 0.62,
    scratchLanes: 4,
    scratchOccupancy: 0.75,
    gateBorder: true,
    weavePx: 2.5,
    flickerDepth: 0.045,
  },
  // Subtle 35mm: sparse dust, the odd fine hair, no gate, gentle flicker.
  'V2-FilmTextureSubtle': {
    id: 'V2-FilmTextureSubtle',
    seed: 0x35bb,
    dustSpawnMin: 4,
    dustSpawnMax: 6,
    hairLanes: 1,
    hairOccupancy: 0.07,
    scratchLanes: 1,
    scratchOccupancy: 0.55,
    gateBorder: false,
    weavePx: 0,
    flickerDepth: 0.022,
  },
  // Scratches only: a clean plate for adding wear without dirt.
  'V3-FilmScratchesOnly': {
    id: 'V3-FilmScratchesOnly',
    seed: 0x5c33,
    dustSpawnMin: 0,
    dustSpawnMax: 0,
    hairLanes: 0,
    hairOccupancy: 0,
    scratchLanes: 8,
    scratchOccupancy: 0.85,
    gateBorder: false,
    weavePx: 0,
    flickerDepth: 0.03,
  },
};
