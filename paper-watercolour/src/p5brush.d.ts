// p5.brush ships no type declarations; the functions used here are typed loosely.
declare module "p5.brush" {
  import type p5 from "p5";
  type Pt = [number, number];
  export function instance(p: p5): void;
  export function seed(s: number): void;
  export function noiseSeed(s: number): void;
  export function fill(color: string, opacity?: number): void;
  export function noFill(): void;
  export function wash(color: string, opacity?: number): void;
  export function noWash(): void;
  export function fillBleed(strength: number, direction?: "in" | "out", angle?: number): void;
  export function fillTexture(texture: number, border: number, scatter?: boolean): void;
  export function noStroke(): void;
  export function noHatch(): void;
  export function set(name: string, color: string, weight: number): void;
  export function polygon(pts: Pt[]): unknown;
  export function circle(x: number, y: number, r: number, irregular?: number | boolean): unknown;
  export function line(x1: number, y1: number, x2: number, y2: number): void;
  export function scaleBrushes(s: number): void;
}
