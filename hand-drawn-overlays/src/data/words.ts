/**
 * Handwritten word clips. Add a word by adding one row: a new composition
 * appears in Remotion Studio and can be rendered by its id.
 *
 *   id    composition id (letters, numbers, underscores)
 *   text  the word or short phrase (Caveat covers Latin letters, digits, punctuation)
 *   mark  the extra pen mark drawn after the word
 *   seed  any whole number >= 1; changes the boil and the mark's wobble
 */
export type WordMark = "underline" | "heart" | "flourish" | "arrow" | "none";

export type WordRow = { id: string; text: string; mark: WordMark; seed: number };

export const WORDS: WordRow[] = [
  { id: "Handwritten_Hello", text: "Hello", mark: "underline", seed: 11 },
  { id: "Handwritten_ThankYou", text: "Thank you", mark: "heart", seed: 23 },
  { id: "Handwritten_Welcome", text: "Welcome", mark: "flourish", seed: 37 },
  { id: "Handwritten_Subscribe", text: "Subscribe", mark: "arrow", seed: 41 },
];
