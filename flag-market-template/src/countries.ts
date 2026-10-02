import {
  AustraliaFlag,
  CanadaFlag,
  ChinaFlag,
  FlagDef,
  FranceFlag,
  GermanyFlag,
  IndiaFlag,
  JapanFlag,
  SouthKoreaFlag,
  UKFlag,
  USAFlag,
} from "./flags";

export type Country = {
  /** Used in composition ids: FlagMarket-<id>-Up / -Down. Letters/digits only. */
  id: string;
  name: string;
  flag: FlagDef;
  /** Point of the flag (0–1 of its width/height) that must stay visible after the 16:9 crop. */
  focus: { x: number; y: number };
  /** Where in the frame (0–1) that point should land. Defaults to `focus`. */
  anchor?: { x: number; y: number };
  /** Extra zoom on top of "cover" (default 1). */
  zoom?: number;
  /** Drives line shape, label values, arrow positions and ticker rows. */
  seed: number;
};

// One row per country. Adding a country = one flag component + one row here.
export const COUNTRIES: Country[] = [
  { id: "USA", name: "United States", flag: USAFlag, focus: { x: 0.2, y: 0.27 }, seed: 1 },
  { id: "China", name: "China", flag: ChinaFlag, focus: { x: 0.18, y: 0.3 }, seed: 2 },
  {
    id: "Japan",
    name: "Japan",
    flag: JapanFlag,
    focus: { x: 0.5, y: 0.5 },
    anchor: { x: 0.42, y: 0.5 },
    zoom: 1.12,
    seed: 3,
  },
  { id: "Germany", name: "Germany", flag: GermanyFlag, focus: { x: 0.5, y: 0.5 }, seed: 4 },
  { id: "UK", name: "United Kingdom", flag: UKFlag, focus: { x: 0.5, y: 0.5 }, seed: 5 },
  { id: "India", name: "India", flag: IndiaFlag, focus: { x: 0.5, y: 0.5 }, seed: 6 },
  { id: "France", name: "France", flag: FranceFlag, focus: { x: 0.5, y: 0.5 }, seed: 7 },
  { id: "Canada", name: "Canada", flag: CanadaFlag, focus: { x: 0.5, y: 0.45 }, seed: 8 },
  { id: "SouthKorea", name: "South Korea", flag: SouthKoreaFlag, focus: { x: 0.5, y: 0.5 }, seed: 9 },
  { id: "Australia", name: "Australia", flag: AustraliaFlag, focus: { x: 0.25, y: 0.5 }, seed: 10 },
];

export const compositionId = (countryId: string, dir: string) => `FlagMarket-${countryId}-${dir}`;
