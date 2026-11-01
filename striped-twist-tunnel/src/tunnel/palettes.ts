export type Rgb = [number, number, number];

export type TunnelLook = {
  ink: Rgb;
  paper: Rgb;
  deep: Rgb;
  deepInk: Rgb;
  grain: number;
};

const hex = (h: string): Rgb => {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** Version 1 – matches the reference: navy-black ink on warm off-white paper. */
export const MONOCHROME: TunnelLook = {
  ink: hex("#0e1a22"),
  paper: hex("#dcdcd6"),
  deep: hex("#8593a3"),
  deepInk: hex("#16232d"),
  grain: 0.018,
};

/** Version 2 – alternative palette: deep indigo ink on saffron/amber paper. */
export const SAFFRON_INDIGO: TunnelLook = {
  ink: hex("#1b1446"),
  paper: hex("#f2b544"),
  deep: hex("#c0436a"),
  deepInk: hex("#241450"),
  grain: 0.018,
};
