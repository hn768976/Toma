import { pick, rand } from "./random";

// Latin filler only. The reference frames carry blocks of CJK text; those
// are deliberately not reproduced - generated strings can't be verified,
// and at this size the text is texture, so Latin reads identically.
const LOREM = `lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod
tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis
nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis
aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur
excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt
mollit anim id est laborum sed perspiciatis unde omnis iste natus error volup
tatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab
illo inventore veritatis et quasi architecto beatae vitae dicta explicabo nemo
enim ipsam voluptatem quia voluptas aspernatur aut odit fugit sed quia conse
quuntur magni dolores eos ratione sequi nesciunt neque porro quisquam est`
  .split(/\s+/)
  .filter(Boolean);

/** A deterministic run of lorem words of roughly `chars` characters. */
export const loremLine = (seed: number, chars: number): string => {
  let out = "";
  let i = 0;
  while (out.length < chars) {
    out += (out ? " " : "") + LOREM[Math.floor(rand(seed * 131 + i) * LOREM.length)];
    i++;
  }
  return out.slice(0, chars);
};

/** `lines` lines of lorem, each of a slightly different length. */
export const loremLines = (seed: number, lines: number, chars: number): string[] =>
  new Array(lines)
    .fill(0)
    .map((_, i) => loremLine(seed * 977 + i * 13, Math.round(chars * (0.82 + rand(seed + i) * 0.18))));

// Short invented codes for readouts. No brand names, product names,
// hostnames, addresses or paths appear anywhere in the frame.
const CODE_HEADS = ["AX", "DR", "KP", "LV", "MT", "NC", "QS", "RF", "TU", "VX", "ZL", "HS"] as const;

export const shortCode = (seed: number): string =>
  `${pick(seed, CODE_HEADS)}${Math.floor(rand(seed * 41) * 90 + 10)}`;

export const numCode = (seed: number, digits: number): string => {
  let out = "";
  for (let i = 0; i < digits; i++) out += Math.floor(rand(seed * 313 + i * 71) * 10);
  return out;
};

const UNITS = ["Hz", "ms", "dB", "kV", "pt", "%"] as const;

export const unitLabel = (seed: number): string =>
  `${Math.floor(rand(seed * 613) * 98 + 1)} ${pick(seed * 17, UNITS)}`;
