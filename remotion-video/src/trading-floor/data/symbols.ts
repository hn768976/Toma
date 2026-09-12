// Invented ticker symbols. Nothing here maps to a real listed company,
// and every price on screen is synthetic.

export const SYMBOLS = [
  "NVEX",
  "ARCL",
  "TOMA",
  "QVRA",
  "BLTN",
  "KORVA",
  "SEDIX",
  "MIRA",
  "PALTO",
  "ZENTA",
  "HALOQ",
  "CRESA",
  "VANTIQ",
  "NORLIN",
  "OSPRA",
  "TERRIS",
  "LUMEN",
  "AXIOM",
  "KESTRA",
  "PRIMA",
  "VOLTA",
  "NEXOR",
  "ORICA",
  "BRAVIA",
  "SOLTA",
  "CYGNA",
  "DELTIS",
  "FERRIC",
  "GRANIT",
  "HYDRIA",
  "IONEX",
  "JARVA",
  "KIBAN",
  "LATRO",
  "MERIDA",
  "NIMBUS",
  "OCTAVA",
  "PYRON",
  "QUILLA",
  "RAVENA",
  "SABRA",
  "TRIDEX",
  "ULTOR",
  "VERANT",
  "WESTRA",
  "XANTHE",
  "YARROW",
  "ZEPHRA",
  "ACCIO",
  "BOREAL",
  "CALDRA",
  "DUNARA",
] as const;

// Warrant / forward suffixes, mirroring the derivative lines that show up
// in a real tape.
const SUFFIXES = ["", "", "", "", "", "-W1", "-W2", "-R", "-F", "-WS"] as const;

// A few deliberately long names, rendered as highlighted block trades.
export const BLOCK_SYMBOLS = [
  "NVEX13C2508A",
  "KORVA19P2511B",
  "TERRIS13C2509A",
  "AXIOM41C2601X",
  "NEXOR08P2512C",
] as const;

export const symbolAt = (rnd: () => number): string => {
  const base = SYMBOLS[Math.floor(rnd() * SYMBOLS.length)];
  const suffix = SUFFIXES[Math.floor(rnd() * SUFFIXES.length)];
  return base + suffix;
};

export const blockSymbolAt = (rnd: () => number): string =>
  BLOCK_SYMBOLS[Math.floor(rnd() * BLOCK_SYMBOLS.length)];

// The instrument the quote + chart windows are focused on.
export const FOCUS_SYMBOL = "TOMA";
export const FOCUS_LAST = 82.5;
export const FOCUS_PREV_CLOSE = 82.5;
export const FOCUS_HIGH = 83.25;
export const FOCUS_LOW = 82.0;
export const FOCUS_CEILING = 107.0;
export const FOCUS_FLOOR = 57.75;
