import { FlagDef, PENTAGRAM_INNER, starPoints } from "./shared";

// Executive Order 10834 construction, hoist A = 1.0 → 1000 units.
// Fly B = 1.9, union C = 7/13 tall x D = 0.76 wide, star spacing
// E = F = 0.054 (vertical), G = H = 0.063 (horizontal), star diameter K = 0.0616.
const RED = "#B31942"; // Old Glory Red
const BLUE = "#0A3161"; // Old Glory Blue
const WHITE = "#FFFFFF";
const A = 1000;
const STRIPE = A / 13;

export const USAFlag: FlagDef = {
  width: 1900,
  height: A,
  draw: () => {
    const stars: React.ReactNode[] = [];
    for (let row = 0; row < 9; row++) {
      const y = 54 * (row + 1);
      const even = row % 2 === 0; // 6-star rows: 1st, 3rd, ... 9th
      for (let col = 0; col < (even ? 6 : 5); col++) {
        const x = 63 * (even ? 1 + col * 2 : 2 + col * 2);
        stars.push(
          <polygon
            key={`${row}-${col}`}
            points={starPoints(x, y, 30.8, 30.8 * PENTAGRAM_INNER)}
            fill={WHITE}
          />,
        );
      }
    }
    return (
      <>
        <rect width={1900} height={A} fill={WHITE} />
        {Array.from({ length: 7 }, (_, i) => (
          <rect key={i} y={i * 2 * STRIPE} width={1900} height={STRIPE} fill={RED} />
        ))}
        <rect width={760} height={STRIPE * 7} fill={BLUE} />
        {stars}
      </>
    );
  },
};
