import { C } from '../theme';

/**
 * Nova side view. Body+tail+belly are rasterised into a texture and bent along
 * a PixiJS MeshRope. Texture space: 560 x 320, tail at x=0, head at x=560,
 * centreline y=160. Face/horn/fins live in a separate vector layer anchored at
 * the head (FACE_ANCHOR) so they never distort.
 */
export const TEX_W = 560;
export const TEX_H = 320;
export const FACE_ANCHOR = { x: 548, y: 160 }; // texture coords of the head front
export const STROKE = 2; // texture units; Nova is drawn at 1.52x -> ~3px on screen

export const BODY_PATH =
  'M 548 165 C 552 95 490 50 420 50 C 330 50 230 95 140 135 C 115 145 95 140 75 120 ' +
  'C 60 104 40 88 16 90 C 22 120 40 146 58 160 C 40 174 22 200 16 230 C 40 232 60 216 75 200 ' +
  'C 95 180 115 175 140 185 C 230 230 320 275 410 272 C 500 268 545 225 548 165 Z';

export const BELLY_PATH =
  'M 196 204 C 280 250 380 268 452 258 C 500 250 532 222 543 192 C 470 232 330 240 196 204 Z';

export const novaBodySvg = () => `
<svg xmlns="http://www.w3.org/2000/svg" width="${TEX_W}" height="${TEX_H}" viewBox="0 0 ${TEX_W} ${TEX_H}">
  <defs><clipPath id="b"><path d="${BODY_PATH}"/></clipPath></defs>
  <path d="${BODY_PATH}" fill="${C.coral}"/>
  <g clip-path="url(#b)">
    <path d="${BELLY_PATH}" fill="${C.cream}"/>
    <ellipse cx="300" cy="96" rx="13" ry="9" fill="${C.coralDark}"/>
    <ellipse cx="340" cy="78" rx="9" ry="6" fill="${C.coralDark}"/>
    <ellipse cx="250" cy="112" rx="8" ry="6" fill="${C.coralDark}"/>
    <ellipse cx="380" cy="70" rx="7" ry="5" fill="${C.coralDark}"/>
    <ellipse cx="205" cy="128" rx="6" ry="4" fill="${C.coralDark}"/>
    <path d="M 60 150 C 70 140 80 132 96 132" stroke="${C.coralDark}" stroke-width="5" fill="none" stroke-linecap="round"/>
  </g>
  <path d="${BODY_PATH}" fill="none" stroke="${C.navy}" stroke-width="${STROKE}" stroke-linejoin="round"/>
</svg>`;

/** Convert texture coords to face-anchor coords. */
export const fa = (x: number, y: number) => ({ x: x - FACE_ANCHOR.x, y: y - FACE_ANCHOR.y });
