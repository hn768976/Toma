import { FlagDef } from "./shared";

// IS 1:1968 / Flag Code of India: 2:3, three equal bands, Ashoka Chakra
// (24 spokes) in navy centred on the white band. Chakra diameter taken from
// the IS 1 size table for the large flags (e.g. 1295 mm on a 1400 mm band),
// i.e. 0.925 of the white band. Grid: 225 x 150, band = 50.
const SAFFRON = "#FF671F";
const GREEN = "#046A38";
const NAVY = "#06038D";
const R = (0.925 * 50) / 2; // outer radius of the wheel
const k = R / 20; // the wheel geometry below is drawn for r = 20

export const IndiaFlag: FlagDef = {
  width: 225,
  height: 150,
  draw: () => (
    <>
      <rect width={225} height={50} fill={SAFFRON} />
      <rect y={50} width={225} height={50} fill="#FFFFFF" />
      <rect y={100} width={225} height={50} fill={GREEN} />
      <g transform={`translate(112.5 75) scale(${k})`} fill={NAVY}>
        <circle r={20} />
        <circle r={17.5} fill="#FFFFFF" />
        <circle r={3.5} />
        {Array.from({ length: 24 }, (_, i) => (
          <g key={i} transform={`rotate(${i * 15})`}>
            {/* spoke: thin at hub and rim, widest a third of the way out */}
            <path d="M0,17.5 L0.6,7 L0,2 L-0.6,7 Z" />
            {/* small rim circle between this spoke and the next */}
            <circle r={0.875} transform="rotate(7.5) translate(0 17.5)" />
          </g>
        ))}
      </g>
    </>
  ),
};
