// Hand-authored icon set, drawn on a 24 x 24 grid.
//
// Each icon is a list of stroked outlines plus a list of solid shapes.
// Strokes are rendered with round caps/joins at a shared width so the
// whole set reads as one family; solids are used only for the small
// details (dots, bars) that would close up if they were stroked.

import { circlePath, gearPath, roundRectPath } from "./svg-shapes";

export type Icon = {
  id: string;
  stroke: string[];
  solid?: string[];
  /** Fill rule for the solid shapes; `evenodd` punches holes. */
  solidRule?: "nonzero" | "evenodd";
};

export const ICONS: Icon[] = [
  {
    id: "cloud",
    stroke: [
      "M 5.5 17 H 17 A 3.6 3.6 0 0 0 17.2 9.8 A 5.2 5.2 0 0 0 7.4 8.6 A 4.2 4.2 0 0 0 5.5 17 Z",
    ],
  },
  {
    id: "lock",
    stroke: [
      "M 8 10.5 V 8.2 A 4 4 0 0 1 16 8.2 V 10.5",
      roundRectPath(4.8, 10.5, 14.4, 9.2, 1.6),
    ],
    solid: [circlePath(12, 14.3, 1.05)],
  },
  {
    id: "magnifier",
    stroke: [circlePath(10.6, 10.6, 5), "M 14.3 14.3 L 19.2 19.2"],
  },
  {
    id: "chat",
    stroke: [
      "M 4 6.6 A 2.1 2.1 0 0 1 6.1 4.5 H 17.9 A 2.1 2.1 0 0 1 20 6.6 V 13.9 A 2.1 2.1 0 0 1 17.9 16 H 10.6 L 6.6 19.5 V 16 H 6.1 A 2.1 2.1 0 0 1 4 13.9 Z",
    ],
  },
  {
    id: "gear",
    stroke: [],
    solid: [gearPath(12, 12, 7.4, 10.2, 3.3, 8)],
    solidRule: "evenodd",
  },
  {
    id: "bulb",
    stroke: [
      circlePath(12, 10, 5.1),
      "M 9.4 15.6 H 14.6",
      "M 9.8 17.8 H 14.2",
      "M 10.7 19.9 H 13.3",
    ],
  },
  {
    id: "document",
    stroke: [
      "M 6.6 3.6 H 14 L 17.6 7.2 V 20.4 H 6.6 Z",
      "M 14 3.6 V 7.2 H 17.6",
      "M 9.2 11.6 H 15",
      "M 9.2 15.2 H 15",
    ],
  },
  {
    id: "envelope",
    stroke: [roundRectPath(3.4, 6, 17.2, 12, 1.5), "M 4.2 7 L 12 13 L 19.8 7"],
  },
  {
    id: "chart",
    stroke: ["M 3.6 20.2 H 20.4"],
    solid: [
      roundRectPath(5, 13.2, 3.3, 5.6, 0.5),
      roundRectPath(10.4, 9, 3.3, 9.8, 0.5),
      roundRectPath(15.8, 5.4, 3.3, 13.4, 0.5),
    ],
  },
  {
    id: "camera",
    stroke: [
      roundRectPath(3, 7, 18, 12.6, 2.2),
      circlePath(12, 13.3, 3.6),
      "M 8.4 7 L 9.7 4.4 H 14.3 L 15.6 7",
    ],
  },
  {
    id: "microphone",
    stroke: [
      "M 12 3.5 A 3 3 0 0 1 15 6.5 V 11.4 A 3 3 0 0 1 9 11.4 V 6.5 A 3 3 0 0 1 12 3.5 Z",
      "M 6.6 11 A 5.4 5.4 0 0 0 17.4 11",
      "M 12 16.4 V 20",
      "M 8.9 20 H 15.1",
    ],
  },
  {
    id: "database",
    stroke: [
      "M 4.6 6.6 A 7.4 3 0 0 1 19.4 6.6 A 7.4 3 0 0 1 4.6 6.6 Z",
      "M 4.6 6.6 V 17.4 A 7.4 3 0 0 0 19.4 17.4 V 6.6",
      "M 4.6 12 A 7.4 3 0 0 0 19.4 12",
    ],
  },
  {
    id: "shield",
    stroke: [
      "M 12 3.5 L 19.4 6.4 V 12 C 19.4 16.4 16.1 19.4 12 20.5 C 7.9 19.4 4.6 16.4 4.6 12 V 6.4 Z",
      "M 9 12.3 L 11.2 14.5 L 15.2 10.2",
    ],
  },
  {
    id: "question",
    stroke: ["M 8.6 9 A 3.4 3.4 0 1 1 12 12.8 V 14.8"],
    solid: [circlePath(12, 18, 1.15)],
  },
  {
    id: "code",
    stroke: [
      "M 9.2 7.4 L 4.6 12 L 9.2 16.6",
      "M 14.8 7.4 L 19.4 12 L 14.8 16.6",
    ],
  },
  {
    id: "wifi",
    stroke: [
      "M 3.8 9.4 A 12 12 0 0 1 20.2 9.4",
      "M 7 12.6 A 7.6 7.6 0 0 1 17 12.6",
      "M 9.8 15.8 A 3.4 3.4 0 0 1 14.2 15.8",
    ],
    solid: [circlePath(12, 18.6, 1.2)],
  },
  {
    id: "gift",
    stroke: [
      roundRectPath(4.4, 10.4, 15.2, 9.2, 1.2),
      roundRectPath(3.2, 6.8, 17.6, 3.6, 0.9),
      "M 12 6.8 V 19.6",
      "M 12 6.8 C 12 4.1 9.9 3.1 8.7 4.3 C 7.5 5.5 9.1 6.8 12 6.8 Z",
      "M 12 6.8 C 12 4.1 14.1 3.1 15.3 4.3 C 16.5 5.5 14.9 6.8 12 6.8 Z",
    ],
  },
  {
    id: "calendar",
    stroke: [
      roundRectPath(3.8, 5.6, 16.4, 14.4, 1.6),
      "M 3.8 10 H 20.2",
      "M 8 3.6 V 7",
      "M 16 3.6 V 7",
    ],
    solid: [
      circlePath(8, 13.6, 0.95),
      circlePath(12, 13.6, 0.95),
      circlePath(16, 13.6, 0.95),
      circlePath(8, 16.9, 0.95),
      circlePath(12, 16.9, 0.95),
    ],
  },
];

export const ICON_STROKE_WIDTH = 1.75;
