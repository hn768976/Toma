// Entirely invented newsprint. No real publication, organisation, person or
// headline appears here — every body, place and claim below is fictional, and
// the phrasing is deliberately generic so the montage reads as "news" without
// quoting any.
//
// Each pool is sorted short-to-long on purpose: a line picks the *widest*
// phrase that still fits inside the distance it is allowed to travel in one
// loop, so having short entries in every pool guarantees a fit.

/** Large, near lines: two- or three-word slabs in heavy sans. */
export const FRAGMENTS = [
  "THAW",
  "LEDGER",
  "SIGNAL",
  "MARGIN",
  "NIGHT DESK",
  "WIDE MARGIN",
  "SLOW THAW",
  "GRID REPORT",
  "OPEN LEDGER",
  "QUIET SURGE",
  "MARKET SHIFT",
  "DEEP INDEX",
  "POLICY REVIEW",
  "SECOND EDITION",
  "NORTH CORRIDOR",
  "FIELD DISPATCH",
];

/** Mid-depth lines: headline-shaped, sentence case. */
export const HEADLINES = [
  "Ports weigh new tariffs",
  "Analysts weigh impact",
  "Report finds a shift",
  "Lenders trim outlook",
  "Board delays decision",
  "Freight rates steady",
  "Survey points to a pause",
  "Committee reviews draft",
  "Logistics firms adopt tools",
  "Coastal permit put on hold",
  "Regional hiring slows again",
  "Consortium outlines timeline",
];

/** Small, far lines: body-copy fragments in a serif. */
export const BODY = [
  "it added",
  "the filing said",
  "sources indicated",
  "the council added",
  "figures due Tuesday",
  "no timetable was given",
  "according to the review",
  "the bureau declined to say",
  "the measure takes effect later",
  "a spokesperson confirmed the change",
  "the revised numbers arrive next quarter",
];

/** Small caps rules and standfirsts. */
export const SMALL_CAPS = [
  "PAGE ELEVEN",
  "NORTH DESK",
  "LATE EDITION",
  "FILED AT NOON",
  "REGIONAL BUREAU",
  "CONTINUED ON ELEVEN",
  "REPORTING FROM THE COAST",
];

/** Drawn between tile repeats so the loop point is not a hard cut. */
export const SEPARATOR = "  ·  ";
