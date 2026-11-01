export type FirePalette = {
  bg: [number, number, number];
  bgGlow: [number, number, number];
  // emission ramp: coolest -> hottest
  e0: [number, number, number];
  e1: [number, number, number];
  e2: [number, number, number];
  e3: [number, number, number];
  smokeCol: [number, number, number];
  smokeAmb: [number, number, number];
};

const hex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
];

export const FIRE_PALETTES: Record<"inferno" | "plasma", FirePalette> = {
  // Version 1 - matches the reference: cream-white fireball, amber/orange
  // flames, neutral grey smoke on a near-black blue-grey background.
  inferno: {
    bg: hex("#13171c"),
    bgGlow: hex("#3a1608"),
    e0: hex("#5a1a06"),
    e1: hex("#d8661c"),
    e2: hex("#ffa236"),
    e3: hex("#ffecbf"),
    smokeCol: hex("#606265"),
    smokeAmb: hex("#17191c"),
  },
  // Version 2 - alternative palette: cold plasma. White-cyan core, electric
  // blue and violet flames, indigo smoke on deep navy.
  plasma: {
    bg: hex("#070a18"),
    bgGlow: hex("#0f0832"),
    e0: hex("#2a0b5c"),
    e1: hex("#5b3bff"),
    e2: hex("#38c6ff"),
    e3: hex("#e9fbff"),
    smokeCol: hex("#5c608a"),
    smokeAmb: hex("#1a1b35"),
  },
};
