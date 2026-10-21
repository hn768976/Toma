// The shared person pictogram, as on signs: a round head with a small gap above a
// body with arms and legs. Units: feet at y = 0, total height 1.26, width 0.5.
// The same outlines drive the 2D sprite atlas (Canvas 2D) and the 3D extrusion.

type Pt = [number, number];

const mirror = (half: Pt[]): Pt[] => {
  // half runs from the top centre clockwise down the right side to the bottom centre.
  const left = half
    .slice()
    .reverse()
    .map(([x, y]) => [-x, y] as Pt)
    .filter(([x]) => x !== 0);
  return [...half, ...left];
};

// Right half of the male body, clockwise from the top centre (the neck line).
const maleHalf: Pt[] = [
  [0, 1.02],
  [0.17, 1.02],
  [0.215, 1.005],
  [0.243, 0.975],
  [0.25, 0.94],
  [0.25, 0.6],
  [0.243, 0.578],
  [0.225, 0.568],
  [0.207, 0.578],
  [0.2, 0.6],
  [0.2, 0.86],
  [0.19, 0.875],
  [0.165, 0.875],
  [0.155, 0.86],
  [0.155, 0.04],
  [0.145, 0.01],
  [0.125, 0],
  [0.045, 0],
  [0.025, 0.01],
  [0.016, 0.04],
  [0.016, 0.5],
  [0, 0.5],
];

// Female: same shoulders and arms, a triangular dress, legs below the hem.
const femaleHalf: Pt[] = [
  [0, 1.02],
  [0.17, 1.02],
  [0.215, 1.005],
  [0.243, 0.975],
  [0.25, 0.94],
  [0.25, 0.6],
  [0.243, 0.578],
  [0.225, 0.568],
  [0.207, 0.578],
  [0.2, 0.6],
  [0.2, 0.84],
  [0.19, 0.86],
  [0.165, 0.86],
  [0.155, 0.84],
  [0.27, 0.36],
  [0.13, 0.36],
  [0.13, 0.03],
  [0.12, 0.005],
  [0.1, 0],
  [0.06, 0],
  [0.04, 0.005],
  [0.03, 0.03],
  [0.03, 0.36],
  [0, 0.36],
];

export const HEAD = { cx: 0, cy: 1.155, r: 0.105 };
export const PICTO_HEIGHT = 1.26;
export const PICTO_WIDTH = 0.54;

export const bodyOutline = (female: boolean): Pt[] => mirror(female ? femaleHalf : maleHalf);

// Draws the pictogram into a 2D context. (x, y) is the feet centre in canvas pixels,
// h the total height in pixels.
export const drawPictogram = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  female: boolean,
) => {
  const s = h / PICTO_HEIGHT;
  ctx.beginPath();
  const pts = bodyOutline(female);
  pts.forEach(([px, py], i) => {
    const X = x + px * s;
    const Y = y - py * s;
    if (i === 0) ctx.moveTo(X, Y);
    else ctx.lineTo(X, Y);
  });
  ctx.closePath();
  ctx.moveTo(x + HEAD.r * s, y - HEAD.cy * s);
  ctx.arc(x, y - HEAD.cy * s, HEAD.r * s, 0, Math.PI * 2);
  ctx.fill();
};
