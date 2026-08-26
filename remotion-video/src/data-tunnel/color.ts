// Colour plumbing. Takes the hex strings out of theme.ts and turns them into
// the rgba()/rgb() forms canvas and CSS need, so no other module has to
// carry a colour literal of its own.

const parseHex = (hex: string) => {
  const raw = hex.charAt(0) === "#" ? hex.slice(1) : hex;
  const full =
    raw.length === 3
      ? raw.charAt(0) + raw.charAt(0) + raw.charAt(1) + raw.charAt(1) + raw.charAt(2) + raw.charAt(2)
      : raw;
  const value = parseInt(full, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

export const withAlpha = (hex: string, alpha: number) => {
  const { r, g, b } = parseHex(hex);
  return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
};

export const rgbChannels = (hex: string) => parseHex(hex);

// Lighten toward white by `amount` (0 = unchanged, 1 = white). Used for the
// bright face highlight on filled chips.
export const lighten = (hex: string, amount: number, alpha: number) => {
  const { r, g, b } = parseHex(hex);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return "rgba(" + mix(r) + ", " + mix(g) + ", " + mix(b) + ", " + alpha + ")";
};
