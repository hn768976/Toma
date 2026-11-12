export type Rgb = [number, number, number];

export type TunnelLook = {
  ink: Rgb;
  paper: Rgb;
  deep: Rgb;
  deepInk: Rgb;
  fog: Rgb;
  grain: number;
};

const hex = (h: string): Rgb => {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** Version 1 – matches the reference: navy-black ink on warm off-white paper. */
export const MONOCHROME: TunnelLook = {
  ink: hex("#0c1f24"),
  paper: hex("#d6d9d4"),
  deep: hex("#97a5b0"),
  deepInk: hex("#2c3e48"),
  fog: hex("#a4b2bc"),
  grain: 0.018,
};

/** Version 2 – alternative palette: deep indigo ink on saffron/amber paper. */
export const SAFFRON_INDIGO: TunnelLook = {
  ink: hex("#1b1446"),
  paper: hex("#f2b544"),
  deep: hex("#c0436a"),
  deepInk: hex("#3a1d5e"),
  fog: hex("#d77a6e"),
  grain: 0.018,
};
