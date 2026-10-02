import { FlagDef, starPoints } from "./shared";

// GB 12982-2004 construction: 30 x 20 grid on the upper hoist quarter.
// Large star: centre (5,5), circumradius 3. Small stars: circumradius 1 at
// (10,2), (12,4), (12,7), (10,9), each with one point aimed at (5,5).
const RED = "#EE1C25";
const YELLOW = "#FFFF00";
const SMALL = [
  [10, 2],
  [12, 4],
  [12, 7],
  [10, 9],
];
const INNER = 0.381966;

export const ChinaFlag: FlagDef = {
  width: 30,
  height: 20,
  draw: () => (
    <>
      <rect width={30} height={20} fill={RED} />
      <polygon points={starPoints(5, 5, 3, 3 * INNER)} fill={YELLOW} />
      {SMALL.map(([x, y]) => {
        // Rotate the "up" point toward the big star centre.
        const toBig = (Math.atan2(5 - y, 5 - x) * 180) / Math.PI;
        return (
          <polygon
            key={`${x}-${y}`}
            points={starPoints(x, y, 1, INNER, 5, toBig + 90)}
            fill={YELLOW}
          />
        );
      })}
    </>
  ),
};
