export type Theme = {
  id: string;
  /** Radial background: centre → edge. */
  bgCentre: string;
  bgEdge: string;
  grid: string;
  gridMajor: string;
  frame: string;
  frameDim: string;
  text: string;
  textDim: string;
  accent: string;
  wire: string;
  wireBack: string;
  bloom: string;
};

export const VIOLET: Theme = {
  id: 'violet',
  bgCentre: '#2a1050',
  bgEdge: '#140830',
  grid: '#4a2a80',
  gridMajor: '#6a3ca8',
  frame: '#7a4ad0',
  frameDim: '#553095',
  text: '#c8a0ff',
  textDim: '#9a72d8',
  accent: '#22d3ee',
  wire: '#bdf0ff',
  wireBack: '#6fa8c8',
  bloom: '#8ee6ff',
};

export const CYAN: Theme = {
  id: 'cyan',
  bgCentre: '#0a2444',
  bgEdge: '#04142a',
  grid: '#1e4a7a',
  gridMajor: '#2c669e',
  frame: '#2f7ac0',
  frameDim: '#215a90',
  text: '#a0d0ff',
  textDim: '#6e9ed0',
  accent: '#22d3ee',
  wire: '#e2fbff',
  wireBack: '#7fb6cc',
  bloom: '#9ceaff',
};
