/**
 * The single source of truth for everything that differs between the two
 * versions of this piece. Every colour and every piece of copy in the
 * animation is read from here - there is no hex literal and no label string
 * anywhere else in `src/doc-approval/`.
 */

export type VariantName = "approved" | "rejected";

/** How the central verdict icon's inner symbol is shaped. */
export type VerdictMode = "check" | "cross";

/** How the inner symbol arrives on screen. */
export type VerdictEntrance = "draw" | "stamp";

/** The glyph inside each document's small circular mark. */
export type MarkGlyph = "check" | "cross";

export type Palette = {
  /** Flat fill behind everything. */
  backgroundDeep: string;
  /** Soft radial wash centred behind the verdict icon. */
  backgroundWash: string;
  /** Filled continents - deliberately barely above the background. */
  mapLand: string;
  /** The drifting character columns. */
  columnDim: string;
  /** The brighter flickering squares among the columns. */
  columnBright: string;
  /** The verdict icon itself. */
  icon: string;
  /** The bloom around the verdict icon. */
  iconGlow: string;
  /** Document outlines and their text lines. */
  docOutline: string;
  /** The small circular mark at each document's lower right. */
  docMark: string;
  /** Rating stars. Null on variants that have no stars. */
  star: string | null;
  /** Label, rating text and the frame brackets. */
  textPale: string;
  /** Used sparsely - the short dashed rules only. */
  accent: string;
};

export type RatingSpec =
  | { kind: "stars"; count: number }
  | { kind: "score"; text: string; strikeThrough: true };

export type DocumentSpec = {
  mark: MarkGlyph;
  /** Indices (0-5, left to right) that get a diagonal strikethrough. */
  strikeThrough: readonly number[];
  /** Whether individual documents briefly drop opacity during the hold. */
  flicker: boolean;
};

export type Variant = {
  label: string;
  palette: Palette;
  verdict: { mode: VerdictMode; entrance: VerdictEntrance };
  documents: DocumentSpec;
  rating: RatingSpec;
};

export const VARIANTS: Record<VariantName, Variant> = {
  approved: {
    label: "Document Approval",
    palette: {
      backgroundDeep: "#050F2E",
      backgroundWash: "#0C1F52",
      mapLand: "#14305C",
      columnDim: "#1A3A6B",
      columnBright: "#4F8FD4",
      icon: "#3FD4F5",
      iconGlow: "#7FE8FF",
      docOutline: "#E8F2FF",
      docMark: "#A8D8F0",
      star: "#F5C43F",
      textPale: "#A8C8E8",
      accent: "#C44FA8",
    },
    verdict: { mode: "check", entrance: "draw" },
    documents: { mark: "check", strikeThrough: [], flicker: false },
    rating: { kind: "stars", count: 5 },
  },
  rejected: {
    label: "Document Rejected",
    palette: {
      backgroundDeep: "#180410",
      backgroundWash: "#3D0A20",
      mapLand: "#4A1028",
      columnDim: "#5C1428",
      columnBright: "#C4405C",
      icon: "#FF3A5C",
      iconGlow: "#FF8FA0",
      docOutline: "#F0D8DC",
      docMark: "#D4909C",
      star: null,
      textPale: "#E8B4C0",
      accent: "#F5A03F",
    },
    verdict: { mode: "cross", entrance: "stamp" },
    // Three of six - a partial rejection reads as a review outcome rather
    // than as a system error.
    documents: { mark: "cross", strikeThrough: [0, 2, 5], flicker: true },
    rating: { kind: "score", text: "0 / 5", strikeThrough: true },
  },
};
