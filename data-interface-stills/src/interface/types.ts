export type Tilt = 'left' | 'right';

export type DensityName = 'sparse' | 'medium' | 'dense';

export type LayoutName =
  | 'leftBinary'
  | 'centreStack'
  | 'scattered'
  | 'grid'
  | 'diagonalFlow'
  | 'dense';

export type ContentKind =
  | 'binary'
  | 'labelled'
  | 'chart'
  | 'table'
  | 'waveform';

/** A rectangle in plane space. */
export type Rect = {x: number; y: number; w: number; h: number};

/** One addressable block on the plane. */
export type Region = Rect & {
  kind: ContentKind;
  /** Multiplies the content scale inside the block. */
  scale: number;
};

/** A mesh drawn between two clustered groups of nodes. */
export type WebSpec = {
  /** Centre of node group A, plane space. */
  ax: number;
  ay: number;
  /** Centre of node group B, plane space. */
  bx: number;
  by: number;
  /** How far the groups spread perpendicular to the A->B axis. */
  spread: number;
  nodes: number;
};

export type Scene = {
  regions: Region[];
  webs: WebSpec[];
};

export type DensitySpec = {
  /** Multiplies each layout's panel count. */
  countMul: number;
  /** Gutter between blocks, plane px. */
  gutter: number;
  /** Multiplies type size / content scale inside blocks. */
  contentScale: number;
  /** Multiplies rows-and-columns of content inside blocks. */
  fill: number;
};

export const DENSITIES: Record<DensityName, DensitySpec> = {
  sparse: {countMul: 0.62, gutter: 104, contentScale: 1.3, fill: 0.8},
  medium: {countMul: 1, gutter: 56, contentScale: 1, fill: 1},
  dense: {countMul: 1.55, gutter: 24, contentScale: 0.76, fill: 1.25},
};

export const DENSITY_NAMES = Object.keys(DENSITIES) as DensityName[];
export const TILTS: Tilt[] = ['left', 'right'];
