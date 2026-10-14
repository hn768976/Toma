export type BandColors = {
  band: string;
  floor: string;
  roughness: number;
  ambientSky: string;
  ambientGround: string;
  ambient: number;
  key: { color: string; intensity: number; dir: [number, number, number] };
  sweep: { color: string; intensity: number; elevation: number };
  env: number;
  aoStrength: number;
  exposure: number;
  grain: number;
};
