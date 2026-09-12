// Coarse continent outlines in [lon, lat] degrees, rasterised onto a dot
// grid to produce the dot-matrix world map in the backdrop. Outlines are
// deliberately low-poly: at the ~11px dot pitch used here anything finer
// is thrown away by the sampler, and a small vertex list keeps the
// rasterise step cheap enough to run once per composition mount.

type Ring = readonly (readonly [number, number])[];

const NORTH_AMERICA: Ring = [
  [-168, 66], [-166, 60], [-160, 58], [-152, 59], [-146, 61], [-141, 60],
  [-135, 57], [-130, 54], [-124, 49], [-124, 42], [-121, 36], [-117, 32],
  [-114, 30], [-112, 26], [-106, 23], [-104, 19], [-96, 16], [-92, 14],
  [-87, 13], [-83, 8], [-79, 9], [-83, 11], [-88, 16], [-91, 18], [-95, 19],
  [-97, 21], [-97, 26], [-94, 29], [-89, 29], [-85, 30], [-82, 27], [-80, 25],
  [-81, 31], [-76, 35], [-74, 39], [-70, 42], [-67, 45], [-64, 45], [-60, 47],
  [-56, 52], [-64, 57], [-78, 62], [-85, 66], [-80, 70], [-75, 68], [-68, 70],
  [-80, 74], [-95, 75], [-110, 74], [-125, 70], [-133, 69], [-145, 70],
  [-157, 71],
];

const SOUTH_AMERICA: Ring = [
  [-79, 9], [-72, 12], [-62, 11], [-52, 5], [-50, 0], [-44, -2], [-35, -5],
  [-38, -13], [-39, -18], [-48, -25], [-53, -34], [-58, -38], [-62, -40],
  [-65, -45], [-68, -50], [-69, -53], [-74, -52], [-73, -45], [-73, -37],
  [-71, -30], [-70, -20], [-74, -14], [-79, -6], [-81, -4], [-80, 1], [-77, 6],
];

const AFRICA: Ring = [
  [-17, 15], [-16, 21], [-13, 28], [-6, 35], [3, 37], [10, 37], [20, 33],
  [25, 32], [32, 31], [35, 24], [38, 18], [43, 12], [48, 12], [51, 11],
  [45, 3], [41, -2], [40, -8], [40, -15], [35, -20], [32, -26], [25, -34],
  [20, -35], [18, -33], [13, -23], [12, -16], [9, -1], [9, 4], [3, 6],
  [-4, 5], [-8, 4], [-13, 9],
];

const EURASIA: Ring = [
  [-10, 37], [-9, 44], [-2, 44], [-2, 49], [2, 51], [4, 52], [8, 54],
  [10, 57], [5, 61], [8, 64], [15, 69], [22, 70], [28, 71], [40, 68],
  [50, 69], [60, 71], [70, 73], [80, 74], [95, 78], [110, 77], [125, 74],
  [140, 73], [155, 71], [170, 69], [180, 66], [180, 62], [165, 60],
  [160, 55], [155, 52], [143, 54], [140, 48], [135, 43], [130, 43],
  [128, 36], [122, 31], [118, 24], [110, 21], [107, 13], [105, 9], [102, 6],
  [100, 13], [97, 17], [94, 21], [90, 22], [88, 21], [80, 15], [77, 8],
  [74, 15], [70, 21], [66, 25], [61, 25], [57, 23], [54, 17], [50, 12],
  [45, 13], [43, 15], [40, 22], [35, 29], [36, 33], [32, 36], [28, 37],
  [23, 38], [20, 40], [15, 37], [16, 41], [13, 45], [8, 44], [3, 43],
  [-2, 37],
];

const AUSTRALIA: Ring = [
  [113, -22], [114, -28], [116, -33], [120, -34], [126, -32], [131, -32],
  [135, -35], [138, -35], [141, -38], [146, -39], [150, -37], [153, -30],
  [153, -25], [146, -19], [142, -11], [137, -12], [133, -11], [130, -12],
  [126, -14], [122, -17], [117, -20],
];

const GREENLAND: Ring = [
  [-45, 60], [-52, 64], [-55, 68], [-58, 72], [-52, 77], [-45, 82], [-30, 83],
  [-22, 80], [-20, 74], [-25, 70], [-32, 66], [-40, 62],
];

const ISLANDS: Ring[] = [
  // Madagascar
  [[44, -12], [49, -13], [50, -18], [47, -25], [45, -23], [43, -18]],
  // Great Britain
  [[-5, 50], [-6, 55], [-3, 58], [0, 54], [1, 51]],
  // Ireland
  [[-10, 52], [-10, 55], [-6, 55], [-6, 52]],
  // Japan
  [[129, 31], [131, 36], [136, 37], [141, 42], [145, 44], [146, 43],
   [141, 39], [137, 35], [133, 33], [130, 31]],
  // New Zealand
  [[172, -34], [174, -37], [178, -38], [176, -41], [172, -43], [167, -46],
   [166, -45], [170, -41]],
  // Sumatra
  [[95, 6], [98, 4], [104, -2], [106, -6], [103, -6], [98, 1]],
  // Borneo
  [[109, 2], [117, 4], [119, 1], [117, -4], [110, -3]],
  // Sulawesi
  [[119, 1], [125, 1], [125, -5], [120, -5]],
  // New Guinea
  [[131, -1], [141, -3], [147, -6], [150, -10], [143, -9], [137, -8], [131, -4]],
  // Philippines
  [[120, 6], [126, 8], [126, 14], [121, 18], [120, 14], [118, 10]],
  // Iceland
  [[-24, 64], [-22, 66], [-14, 66], [-13, 64], [-18, 63]],
  // Java
  [[105, -6], [114, -8], [115, -9], [105, -7]],
  // Cuba
  [[-85, 22], [-77, 21], [-74, 20], [-78, 19], [-84, 21]],
  // Sri Lanka
  [[80, 6], [82, 7], [82, 9], [80, 9]],
];

const LAND: Ring[] = [
  NORTH_AMERICA,
  SOUTH_AMERICA,
  AFRICA,
  EURASIA,
  AUSTRALIA,
  GREENLAND,
  ...ISLANDS,
];

// Equirectangular window. Antarctica is cropped out below -58 to match
// the reference framing, which shows only the populated latitudes.
const LAT_TOP = 84;
const LAT_BOTTOM = -58;

const insideRing = (lon: number, lat: number, ring: Ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
};

const isLand = (lon: number, lat: number) =>
  LAND.some((ring) => insideRing(lon, lat, ring));

export type MapDot = {
  x: number;
  y: number;
  size: number;
  /** 0..1 base brightness */
  bright: number;
  /** 0..1 phase offset for the twinkle cycle */
  phase: number;
  /** true for the sparse subset that flares to the bright colour */
  hot: boolean;
};

export type MapWindow = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** centre-to-centre spacing of the dot grid, in design units */
  pitch: number;
};

// Rasterises the land polygons into a grid of dots inside `win`. Called
// once per composition (memoised), never per frame.
export const buildMapDots = (
  win: MapWindow,
  rand: () => number,
): MapDot[] => {
  const dots: MapDot[] = [];
  const cols = Math.floor(win.width / win.pitch);
  const rows = Math.floor(win.height / win.pitch);

  for (let r = 0; r < rows; r++) {
    const v = (r + 0.5) / rows;
    const lat = LAT_TOP - v * (LAT_TOP - LAT_BOTTOM);
    for (let c = 0; c < cols; c++) {
      const u = (c + 0.5) / cols;
      const lon = -180 + u * 360;
      if (!isLand(lon, lat)) continue;

      const jitterX = (rand() - 0.5) * win.pitch * 0.18;
      const jitterY = (rand() - 0.5) * win.pitch * 0.18;
      const roll = rand();
      dots.push({
        x: win.x + c * win.pitch + win.pitch / 2 + jitterX,
        y: win.y + r * win.pitch + win.pitch / 2 + jitterY,
        size: win.pitch * (roll > 0.9 ? 0.56 : 0.42),
        bright: 0.5 + rand() * 0.5,
        phase: rand(),
        hot: roll > 0.88,
      });
    }
  }
  return dots;
};
