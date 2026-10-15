// One data row per version. To add a colourway, copy a row, give it a new
// `id` and change its colours; Root.tsx registers every row automatically.

export type CapsuleRow = {
  id: string;
  durationInFrames: number;
  cap: string; // cap half colour (the slightly wider half)
  body: string; // body half colour
  background: string;
  powder: string;
};

export const CAPSULE_ROWS: CapsuleRow[] = [
  { id: 'CapsuleRelease_White', durationInFrames: 360, cap: '#F4F4F2', body: '#F4F4F2', background: '#D8DCDE', powder: '#F2F2F0' },
  { id: 'CapsuleRelease_TwoTone', durationInFrames: 360, cap: '#3A7AE8', body: '#F4F4F2', background: '#D8DCDE', powder: '#F2F2F0' },
];

export type DNARow = {
  id: string;
  durationInFrames: number;
  mode: 'loop' | 'form';
  background: string; // main background
  backgroundRight: string; // tint toward the right edge
  glow: string; // soft glow behind the helix
  strandA: string; // backbone gradient start
  strandB: string; // backbone gradient end
  rung: string;
  loose: string;
};

export const DNA_ROWS: DNARow[] = [
  {
    id: 'DNAParticles_Violet', durationInFrames: 600, mode: 'loop',
    background: '#0A0420', backgroundRight: '#1C0418', glow: '#10064E',
    strandA: '#E83AE8', strandB: '#8A3AFF', rung: '#5A6AFF', loose: '#C048F0',
  },
  {
    id: 'DNAForm_Teal', durationInFrames: 360, mode: 'form',
    background: '#04102A', backgroundRight: '#041430', glow: '#082E58',
    strandA: '#3AE8D8', strandB: '#5AC8FF', rung: '#4AA8E8', loose: '#4AB8F0',
  },
  {
    id: 'DNAParticles_Teal', durationInFrames: 600, mode: 'loop',
    background: '#04102A', backgroundRight: '#041430', glow: '#082E58',
    strandA: '#3AE8D8', strandB: '#5AC8FF', rung: '#4AA8E8', loose: '#4AB8F0',
  },
];

export type DropRow = {
  id: string;
  durationInFrames: number;
  background: string;
  backgroundTop: string;
};

export const DROP_ROWS: DropRow[] = [
  { id: 'WaterDrop_Blue', durationInFrames: 600, background: '#7AB8E0', backgroundTop: '#7CBAE1' },
];

export type BurstRow = {
  id: string;
  durationInFrames: number;
  side: 'left' | 'right';
  background: string;
  haze: string; // soft glow through the middle of the fan
  tips: string[];
  dots: string[]; // colours of the dots along the rays
};

export const BURST_ROWS: BurstRow[] = [
  {
    id: 'RadialBurst_Navy', durationInFrames: 600, side: 'left', background: '#020A24', haze: '#000000',
    tips: ['#FFFFFF', '#FF8A2A', '#FF8A2A', '#2AD8FF', '#E83A5A', '#3A8AFF'],
    dots: ['#E8302A', '#FF7A2A', '#3A6AFF', '#FFA040', '#E83A4A'],
  },
  {
    id: 'RadialBurst_TealGold', durationInFrames: 600, side: 'right', background: '#021A1E', haze: '#14180A',
    tips: ['#FFC860', '#3AE8C8', '#FFFFFF', '#FFE0A0', '#3AE8C8'],
    dots: ['#FFC860', '#3AE8C8', '#2AA8A0', '#E8A040', '#3AE8C8'],
  },
];
