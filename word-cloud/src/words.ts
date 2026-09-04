/**
 * The vocabulary of the field. Swap this constant for a different word set
 * and the whole piece re-themes to another niche - nothing else references
 * business language.
 *
 * Kept verbatim as a flat list (PROGRESS appears twice, as briefed); the
 * field generator de-duplicates before it picks, so a repeat in the source
 * list only nudges frequency, it never places the same word twice in the
 * same place.
 */
export const WORDS = [
  "PROGRESS",
  "MISSION",
  "PLANNING",
  "MANAGEMENT",
  "STRATEGY",
  "MARKETING",
  "LEADERSHIP",
  "SUCCESS",
  "TEAMWORK",
  "INNOVATION",
  "SOLUTION",
  "RESULTS",
  "VISION",
  "FUTURE",
  "TARGET",
  "CAREER",
  "FINANCE",
  "IDEA",
  "OPPORTUNITY",
  "INSPIRING",
  "PROGRESS",
  "GROWTH",
] as const;
