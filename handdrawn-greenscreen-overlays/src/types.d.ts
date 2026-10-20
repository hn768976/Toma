declare module 'p5.brush/standalone' {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  export const load: (canvas: HTMLCanvasElement | OffscreenCanvas) => void;
  export const render: () => void;
  export const clear: (...color: any[]) => void;
  export const seed: (s: number | string) => void;
  export const noiseSeed: (s: number | string) => void;
  export const push: () => void;
  export const pop: () => void;
  export const translate: (x: number, y: number) => void;
  export const scale: (x: number, y?: number) => void;
  export const scaleBrushes: (s: number) => void;
  export const set: (name: string, color: string, weight: number) => void;
  export const add: (name: string, params: Record<string, any>) => void;
  export const noStroke: () => void;
  export const noFill: () => void;
  export const wash: (color: string, opacity: number) => void;
  export const noWash: () => void;
  export const noHatch: () => void;
  export const polygon: (pts: number[][]) => void;
  export const spline: (pts: number[][], curvature?: number) => void;
  export const line: (x1: number, y1: number, x2: number, y2: number) => void;
  export const box: () => string[];
}
