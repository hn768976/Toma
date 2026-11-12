// Minimal typings for the parts of p5.brush (standalone build) used here.
declare module "p5.brush/standalone" {
  type Color = string;
  export function load(target: HTMLCanvasElement | OffscreenCanvas): void;
  export function seed(s: number | string): void;
  export function noiseSeed(s: number | string): void;
  export function clear(color?: Color): void;
  export function render(): void;
  export function push(): void;
  export function pop(): void;
  export function translate(x: number, y: number): void;
  export function scaleBrushes(s: number): void;
  export function set(name: string, color: Color, weight?: number): void;
  export function line(x1: number, y1: number, x2: number, y2: number): void;
  export function spline(points: [number, number, number?][], curvature?: number): void;
  export function polygon(points: [number, number][]): void;
  export function fill(color: Color, opacity?: number): void;
  export function noFill(): void;
  export function noStroke(): void;
  export function fillBleed(strength: number, direction?: string): void;
  export function fillTexture(textureStrength?: number, borderIntensity?: number): void;
  export function add(name: string, params: Record<string, unknown>): void;
  export function wiggle(w: number): void;
  export function field(name: string): void;
  export function noField(): void;
}
