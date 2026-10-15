// One data row per version. Add a colourway by adding a row.
export interface Row {
  id: string;
  look: 'inkbloom' | 'neural' | 'lightning' | 'flare' | 'galaxy';
  frames: number; // composition length; loops use it as their period
  params: Record<string, unknown>;
}

export const ROWS: Row[] = [
  { id: 'NeuralPaths_Green', look: 'neural', frames: 600, params: { highlight: '#E8FFE0', mid: '#3AC83A' } },
  { id: 'NeuralPaths_Magenta', look: 'neural', frames: 600, params: { highlight: '#FFE8F8', mid: '#E83AC8' } },
  { id: 'InkBloom_Multicolour', look: 'inkbloom', frames: 420, params: { scenes: ['#C8E87A', '#6A8A7A', '#E8203A'] } },
  { id: 'InkBloom_Violet', look: 'inkbloom', frames: 420, params: { scenes: ['#B8A0F0', '#7A3AE8', '#FF4AC8'] } },
  { id: 'Lightning_BlueViolet', look: 'lightning', frames: 600, params: { core: '#E8FFE8', branch: '#A87AFF', skyTop: '#1A2A8A', skyBottom: '#04040C', skyFlash: true } },
  { id: 'Lightning_BlackOverlay', look: 'lightning', frames: 600, params: { core: '#E8FFE8', branch: '#A87AFF', skyTop: null, skyBottom: null, skyFlash: false } },
  { id: 'SpiralGalaxy_Violet', look: 'galaxy', frames: 600, params: { arm: '#8A5AFF', armAlt: '#B8C8FF', core: '#FFD890', haze: '#4A28F0' } },
  { id: 'SpiralGalaxy_Teal', look: 'galaxy', frames: 600, params: { arm: '#3AD8C8', armAlt: '#F4FFFC', core: '#F0FFF8', haze: '#1AB8D8' } },
  { id: 'FlarePass_Orange', look: 'flare', frames: 240, params: { glow: '#E8901A', core: '#FFF4D8' } },
  { id: 'FlarePass_Blue', look: 'flare', frames: 240, params: { glow: '#3A8AFF', core: '#E8FCFF' } },
];
