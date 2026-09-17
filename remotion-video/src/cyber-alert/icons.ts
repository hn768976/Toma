// Pixel sprites for the alert badge, authored on the same dot grid as the
// font so the icon and the headline share one physical LED pitch.
//
//   '#' - lit in the alert colour
//   'O' - lit at full brightness (eyes, teeth, keyhole), which is what
//         makes the icon read as a face/mechanism rather than a blob
//   '.' - unlit

export type Sprite = {
  width: number;
  height: number;
  // cells[y][x]: 0 unlit, 1 body, 2 hot core
  cells: Uint8Array[];
};

const parse = (rows: string[]): Sprite => {
  const width = rows[0].length;
  for (const row of rows) {
    if (row.length !== width) {
      throw new Error(
        `Sprite rows must all be ${width} wide, got ${row.length}: "${row}"`,
      );
    }
  }
  return {
    width,
    height: rows.length,
    cells: rows.map((row) => {
      const out = new Uint8Array(width);
      for (let x = 0; x < width; x++) {
        out[x] = row[x] === "O" ? 2 : row[x] === "#" ? 1 : 0;
      }
      return out;
    }),
  };
};

// Angry pixel bug: two antennae, three pairs of legs struck straight
// through the body, slanted eyes and a bared row of teeth.
export const BUG_SPRITE = parse([
  "..#.............#..",
  "...#...........#...",
  "....#.........#....",
  "....###########....",
  "...#############...",
  "...##OO#####OO##...",
  "###################",
  "...#############...",
  "...#O.O.O.O.O.O#...",
  "###################",
  "...#############...",
  "...#############...",
  "###################",
  "....###########....",
  ".....#########.....",
]);

// Padlock with the shackle sprung open — the right leg floats clear of
// the body, which is the whole point of a breach.
export const PADLOCK_SPRITE = parse([
  ".....#######.....",
  "...###.....###...",
  "..###.......###..",
  "..##..........##.",
  "..##..........##.",
  "..##.............",
  "..##.............",
  "..##.............",
  "#################",
  "#################",
  "#################",
  "#######OOO#######",
  "######OOOOO######",
  "######OOOOO######",
  "#######OOO#######",
  "#######OOO#######",
  "######OOOOO######",
  "#################",
  "#################",
  "#################",
]);

export const SPRITES = {
  bug: BUG_SPRITE,
  padlock: PADLOCK_SPRITE,
} as const;

export type SpriteName = keyof typeof SPRITES;
