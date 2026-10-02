import { FlagDef } from "./shared";

// 2:3, three equal vertical bands (hoist blue). Colours as used by the
// Élysée since 2020: blue #000091, red #E1000F.
export const FranceFlag: FlagDef = {
  width: 3,
  height: 2,
  draw: () => (
    <>
      <rect width={1} height={2} fill="#000091" />
      <rect x={1} width={1} height={2} fill="#FFFFFF" />
      <rect x={2} width={1} height={2} fill="#E1000F" />
    </>
  ),
};
