// Vendored from remotion-lib (~/projects/remotion-lib/src).
// Do not edit here: change it in the library and re-run
// `node scripts/sync-lib.mjs`. Copied in so this project renders standalone.
import { seededStream } from "./seededRandom";

/**
 * Filler-prose generator.
 *
 * Produces INVENTED text that carries no meaning, built from neutral
 * syllables so that at small sizes it has the colour, word-length
 * distribution and sentence rhythm of real set prose without being anybody's
 * actual writing. Intended for anywhere a layout needs believable body copy it
 * must not actually say anything: newsprint, document mock-ups, UI dummy text.
 *
 * Deterministic: the same seed always yields the same text.
 */

const ONSETS = [
  "ta", "re", "in", "con", "ver", "mo", "sa", "li", "ne", "po", "cur", "de",
  "tri", "an", "ol", "es", "mi", "ra", "lu", "gen", "tor", "bel", "na", "fi",
  "cas", "ru", "pel", "om", "dis", "val", "ter", "sen", "ar", "pro", "mer",
  "quo", "vin", "sol", "ced", "lam", "nor", "hab", "pri", "stat", "clu",
];

const ENDINGS = [
  "tion", "ment", "ing", "ed", "al", "us", "um", "is", "or", "ent", "ance",
  "ity", "ly", "er", "on", "ate", "ic", "ous", "ess", "ain", "ure", "ist",
];

const SHORT_WORDS = [
  "the", "a", "of", "in", "to", "and", "for", "on", "as", "at", "by", "an",
  "it", "is", "was", "not", "but", "had", "has", "its", "who", "off",
];

const makeWord = (rand: () => number): string => {
  // Roughly a third of newsprint words are short function words; mixing them
  // in is what gives the block its characteristic texture.
  if (rand() < 0.34) {
    return SHORT_WORDS[Math.floor(rand() * SHORT_WORDS.length)];
  }
  const syllables = 1 + Math.floor(rand() * 2.6);
  let word = "";
  for (let i = 0; i < syllables; i++) {
    word += ONSETS[Math.floor(rand() * ONSETS.length)];
  }
  if (rand() < 0.6) {
    word += ENDINGS[Math.floor(rand() * ENDINGS.length)];
  }
  return word;
};

const makeSentence = (rand: () => number): string => {
  const words = 7 + Math.floor(rand() * 13);
  const parts: string[] = [];
  for (let i = 0; i < words; i++) {
    let w = makeWord(rand);
    if (i === 0) w = w.charAt(0).toUpperCase() + w.slice(1);
    // An occasional comma mid-sentence keeps the rag from looking mechanical.
    if (i > 2 && i < words - 2 && rand() < 0.09) w += ",";
    parts.push(w);
  }
  return parts.join(" ") + ".";
};

/** A paragraph of 2-5 invented sentences. */
export const makeParagraph = (seed: string, index: number): string => {
  const rand = seededStream(`${seed}:para:${index}`);
  const sentences = 2 + Math.floor(rand() * 4);
  const out: string[] = [];
  for (let i = 0; i < sentences; i++) out.push(makeSentence(rand));
  return out.join(" ");
};

export const makeParagraphs = (seed: string, count: number): string[] => {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(makeParagraph(seed, i));
  return out;
};
