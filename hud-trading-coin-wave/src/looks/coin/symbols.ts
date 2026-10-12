import * as THREE from "three";

// Coin symbols as plain vector paths (no font glyphs, no logo artwork).
// Each builder returns shapes in a ~2 × 2 box centred on the origin.
// To add a symbol: write one builder here and reference its key in a data row.

const rect = (x0: number, y0: number, x1: number, y1: number) => {
  const s = new THREE.Shape();
  s.moveTo(x0, y0);
  s.lineTo(x1, y0);
  s.lineTo(x1, y1);
  s.lineTo(x0, y1);
  s.closePath();
  return s;
};

/** Greek capital Xi: three horizontal bars, the middle one shorter. */
const xi = (): THREE.Shape[] => [
  rect(-0.62, 0.5, 0.62, 0.72),
  rect(-0.4, -0.11, 0.4, 0.11),
  rect(-0.62, -0.72, 0.62, -0.5),
];

/** ₿: a capital B with two short vertical strokes through the top and bottom. */
const btc = (): THREE.Shape[] => {
  const B = new THREE.Shape();
  const L = -0.5; // stem left
  const T = 0.68;
  const Bt = -0.68;
  // outer contour, counter-clockwise
  B.moveTo(L, Bt);
  B.lineTo(0.14, Bt);
  B.absarc(0.14, -0.33, 0.35, -Math.PI / 2, Math.PI / 2, false); // lower bowl
  B.lineTo(0.08, 0.02);
  B.absarc(0.08, 0.35, 0.33, -Math.PI / 2, Math.PI / 2, false); // upper bowl
  B.lineTo(L, T);
  B.closePath();
  const hole = (cx: number, cy: number, r: number, x0: number) => {
    const h = new THREE.Path();
    h.moveTo(x0, cy - r);
    h.lineTo(cx, cy - r);
    h.absarc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false);
    h.lineTo(x0, cy + r);
    h.closePath();
    return h;
  };
  B.holes.push(hole(0.095, -0.285, 0.215, -0.32));
  B.holes.push(hole(0.035, 0.305, 0.195, -0.32));
  const bars = [
    rect(-0.32, 0.66, -0.17, 0.9),
    rect(0.0, 0.66, 0.15, 0.9),
    rect(-0.32, -0.9, -0.17, -0.66),
    rect(0.0, -0.9, 0.15, -0.66),
  ];
  return [B, ...bars];
};

export const SYMBOLS = { xi, btc } as const;
export type SymbolKey = keyof typeof SYMBOLS;
