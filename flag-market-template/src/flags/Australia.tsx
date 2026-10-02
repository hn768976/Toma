import { FlagDef, starPoints } from "./shared";
import { UnionJack } from "./UnionJack";

// Flags Act 1953 construction, 1:2. H = 5040 (grid 10080 x 5040).
// Union Flag in the upper hoist quarter. Commonwealth Star (7 points,
// outer diameter 3/10 H, inner 4/9 of outer) centred in the lower hoist
// quarter. Southern Cross in the fly (centre line x = 3/4 W):
//   Alpha  1/6 H above the bottom edge, on the centre line
//   Gamma  1/6 H below the top edge, on the centre line
//   Beta   1/4 H left of centre line, 1/16 H above the horizontal centre
//   Delta  2/9 H right of centre line, 31/240 H above the horizontal centre
//   Epsilon 1/10 H right, 1/24 H below — 5 points, outer diameter 1/12 H
// Other Southern Cross stars: 7 points, outer diameter 1/7 H, inner 4/9.
const H = 5040;
const W = 10080;
const BLUE = "#012169";
const RED = "#E4002B";
const WHITE = "#FFFFFF";
const FX = W * 0.75;
const CY = H / 2;
const SC = [
  { x: FX, y: H - H / 6 }, // Alpha
  { x: FX, y: H / 6 }, // Gamma
  { x: FX - H / 4, y: CY - H / 16 }, // Beta
  { x: FX + (2 * H) / 9, y: CY - (31 * H) / 240 }, // Delta
];

export const AustraliaFlag: FlagDef = {
  width: W,
  height: H,
  draw: (uid) => (
    <>
      <rect width={W} height={H} fill={BLUE} />
      <g transform={`scale(${W / 2 / 60})`}>
        <UnionJack uid={uid} red={RED} />
      </g>
      <polygon points={starPoints(W / 4, (3 * H) / 4, 0.15 * H, 0.15 * H * (4 / 9), 7)} fill={WHITE} />
      {SC.map((s, i) => (
        <polygon key={i} points={starPoints(s.x, s.y, H / 14, (H / 14) * (4 / 9), 7)} fill={WHITE} />
      ))}
      <polygon
        points={starPoints(FX + H / 10, CY + H / 24, H / 24, (H / 24) * (4 / 9), 5)}
        fill={WHITE}
      />
    </>
  ),
};
