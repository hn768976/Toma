import { FlagDef } from "./shared";

// Act on National Flag and Anthem (1999): 2:3, disc diameter 3/5 of the
// hoist, centred. Colour: beni-iro, commonly rendered #BC002D.
export const JapanFlag: FlagDef = {
  width: 300,
  height: 200,
  draw: () => (
    <>
      <rect width={300} height={200} fill="#FFFFFF" />
      <circle cx={150} cy={100} r={60} fill="#BC002D" />
    </>
  ),
};
