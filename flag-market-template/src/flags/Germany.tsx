import { FlagDef } from "./shared";

// Federal flag, 3:5, three equal horizontal bands. Colours per the
// Federal Government's corporate design: black, red #DD0000, gold #FFCE00.
export const GermanyFlag: FlagDef = {
  width: 5,
  height: 3,
  draw: () => (
    <>
      <rect width={5} height={1} fill="#000000" />
      <rect y={1} width={5} height={1} fill="#DD0000" />
      <rect y={2} width={5} height={1} fill="#FFCE00" />
    </>
  ),
};
