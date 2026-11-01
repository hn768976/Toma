import type { Look } from "./scene";

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// Sampled from the reference: aubergine backdrop, porcelain tubes, raspberry.
export const PORCELAIN_RASPBERRY: Look = {
  bg: hex("#3a3247"),
  white: hex("#f2f2f4"),
  pink: hex("#d9516f"),
  pinkLight: hex("#f0a8b8"),
  shade: hex("#8f93a6"),
};
