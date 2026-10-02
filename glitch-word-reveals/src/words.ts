// THE DATA. One row per clip: style, word, seed.
// To add a word, add one row here. Nothing else needs to change.

export type StyleName = "AttackGlitch" | "DataRain";

export type WordRow = {
  style: StyleName;
  word: string;
  seed: number;
};

export const WORDS: WordRow[] = [
  // Style A — Attack Glitch
  { style: "AttackGlitch", word: "RANSOMWARE", seed: 1101 },
  { style: "AttackGlitch", word: "MALWARE", seed: 1102 },
  { style: "AttackGlitch", word: "PHISHING", seed: 1103 },
  { style: "AttackGlitch", word: "DATA BREACH", seed: 1104 },
  { style: "AttackGlitch", word: "CYBER ATTACK", seed: 1105 },
  { style: "AttackGlitch", word: "SYSTEM HACKED", seed: 1106 },
  { style: "AttackGlitch", word: "SPYWARE", seed: 1107 },
  { style: "AttackGlitch", word: "ROGUE AI", seed: 1108 },
  { style: "AttackGlitch", word: "AI SCAM", seed: 1109 },
  { style: "AttackGlitch", word: "AI HACKING", seed: 1110 },
  { style: "AttackGlitch", word: "AI THREAT", seed: 1111 },
  { style: "AttackGlitch", word: "AI SURVEILLANCE", seed: 1112 },

  // Style B — Data Rain
  { style: "DataRain", word: "CYBERSECURITY", seed: 2201 },
  { style: "DataRain", word: "CLOUD COMPUTING", seed: 2202 },
  { style: "DataRain", word: "QUANTUM COMPUTING", seed: 2203 },
  { style: "DataRain", word: "DATA PRIVACY", seed: 2204 },
  { style: "DataRain", word: "ENCRYPTION", seed: 2205 },
  { style: "DataRain", word: "BIG DATA", seed: 2206 },
  { style: "DataRain", word: "DIGITAL IDENTITY", seed: 2207 },
  { style: "DataRain", word: "GENERATIVE AI", seed: 2208 },
  { style: "DataRain", word: "AI IN HEALTHCARE", seed: 2209 },
  { style: "DataRain", word: "AI IN FINANCE", seed: 2210 },
  { style: "DataRain", word: "AI AGENTS", seed: 2211 },
  { style: "DataRain", word: "AI ETHICS", seed: 2212 },
];

// Remotion IDs may only use letters, digits and "-", so spaces become "-".
// Render output files use "_" instead: AttackGlitch_AI_SURVEILLANCE.mp4
export const compositionId = (row: WordRow) =>
  `${row.style}-${row.word.replace(/[^A-Za-z0-9]+/g, "-")}`;
export const outputName = (row: WordRow) =>
  `${row.style}_${row.word.replace(/[^A-Za-z0-9]+/g, "_")}`;
