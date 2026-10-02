/**
 * One data row per version. `id` is the output file name (GrowthChart3D_Up.mp4);
 * the Remotion composition id is the same with '_' -> '-' (Remotion ids may not
 * contain underscores), e.g. GrowthChart3D-Up. To add a version, add a row here; Root.tsx
 * registers a composition for every row automatically.
 */

export type GrowthVersion = {
  id: string;
  /** 'up' = bars rise left->right, arrow climbs; 'down' = bars sink to a falling staircase */
  direction: 'up' | 'down';
  arrow: string;
};

export type CircuitVersion = {
  id: string;
  traceA: string; // trace colour range
  traceB: string;
  light: string; // twinkling / travelling lights
  board: string; // board base colour (display sRGB)
  haze: string;
};

export type ShardsVersion = {
  id: string;
  lineA: string; // line colour range (far/dim -> near/bright)
  lineB: string;
  glow: string; // soft light blooms behind close shards
};

export type CpuVersion = {
  id: string;
  substrate: string;
  trace: string;
  traceGlow: string;
  data: string; // main data-point colour
  dataAccent: string; // the "few pink" points
  indicator: string;
  board: string;
};

export type PanelsVersion = {
  id: string;
  laser: string;
  trim: string;
};

export const GROWTH_VERSIONS: GrowthVersion[] = [
  { id: 'GrowthChart3D_Up', direction: 'up', arrow: '#5CE84A' },
  { id: 'GrowthChart3D_Down', direction: 'down', arrow: '#E8403A' },
];

export const CIRCUIT_VERSIONS: CircuitVersion[] = [
  { id: 'CircuitFlythrough_Blue', traceA: '#3F8CFF', traceB: '#7FD0FF', light: '#6FD6FF', board: '#00051a', haze: '#020a1e' },
];

export const SHARDS_VERSIONS: ShardsVersion[] = [
  { id: 'NeonShards_Blue', lineA: '#3F8CFF', lineB: '#9FD8FF', glow: '#4F7BFF' },
  { id: 'NeonShards_Magenta', lineA: '#FF4FD8', lineB: '#FFB0F0', glow: '#8A3BFF' },
];

export const CPU_VERSIONS: CpuVersion[] = [
  {
    id: 'CPUBoard_BlueSilver',
    substrate: '#3a4aa0',
    trace: '#5a86c8',
    traceGlow: '#b4dcff',
    data: '#d8ecff',
    dataAccent: '#ff7fd0',
    indicator: '#5fa8ff',
    board: '#0b0f22',
  },
];

export const PANELS_VERSIONS: PanelsVersion[] = [
  { id: 'LaserPanels_CyanPurple', laser: '#3FF0E8', trim: '#A04FFF' },
  { id: 'LaserPanels_OrangeRed', laser: '#FF9A3F', trim: '#FF3F4F' },
];
