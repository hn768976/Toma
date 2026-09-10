// Shapes of the data produced by scripts/prepare-subjects.mjs.

export type ColourwayId = "blue" | "violet";

export type FlatPath = {
  d: string;
  // "fill": a solid silhouette; the template fills it translucently and
  // strokes its edge. "stroke": line art; the template redraws the line at
  // the source weight (scaled) and never fills it.
  mode: "fill" | "stroke";
  strokeWidth: number; // artwork units, already scaled by any transform
  fillRule: "nonzero" | "evenodd";
  linecap: string;
  linejoin: string;
};

export type Anchor = { x: number; y: number; score: number };

export type SubjectManifest = {
  id: string;
  name: string;
  svg: string;
  colourways: ColourwayId[];
  scaleOverride: number | null;
  viewBox: { x: number; y: number; w: number; h: number };
  bbox: { x: number; y: number; w: number; h: number };
  aspect: number;
  extremeAspect: boolean;
  paths: FlatPath[];
  anchors: Anchor[];
  warnings: string[];
};

export type Manifest = {
  generatedAt: string;
  subjects: SubjectManifest[];
};
