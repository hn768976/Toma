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
export const BODY_PATH =
  'M 548 165 C 552 95 490 50 420 50 C 330 50 230 95 140 135 C 115 145 95 140 75 120 ' +
  'C 60 104 40 88 16 90 C 22 120 40 146 58 160 C 40 174 22 200 16 230 C 40 232 60 216 75 200 ' +
  'C 95 180 115 175 140 185 C 230 230 320 275 410 272 C 500 268 545 225 548 165 Z';

export const BELLY_PATH =
  'M 196 204 C 280 250 380 268 452 258 C 500 250 532 222 543 192 C 470 232 330 240 196 204 Z';

// No outlines: parts are separated by tone. Shading is baked into the texture so it
// bends with the rope; the head overlay (eyes, horn, fins) sits on the rigid head area.
export const novaBodySvg = () => `
<svg xmlns="http://www.w3.org/2000/svg" width="${TEX_W}" height="${TEX_H}" viewBox="0 0 ${TEX_W} ${TEX_H}">
  <defs>
    <clipPath id="b"><path d="${BODY_PATH}"/></clipPath>
    <clipPath id="bl"><path d="${BELLY_PATH}"/></clipPath>
  </defs>
  <path d="${BODY_PATH}" fill="${C.coral}"/>
  <g clip-path="url(#b)">
    <!-- darker tone along the underside and the lower tail fluke -->
    <ellipse cx="330" cy="300" rx="330" ry="66" fill="${C.coralDark}"/>
    <ellipse cx="30" cy="222" rx="60" ry="30" fill="${C.coralDark}"/>
    <ellipse cx="96" cy="176" rx="40" ry="10" fill="${C.coralDark}"/>
    <!-- light tone: top of the head and a sheen along the back -->
    <ellipse cx="452" cy="66" rx="82" ry="13" transform="rotate(-6 452 66)" fill="${C.coralLight}"/>
    <ellipse cx="300" cy="78" rx="70" ry="7" transform="rotate(-14 300 78)" fill="${C.coralLight}"/>
    <ellipse cx="38" cy="98" rx="20" ry="5" transform="rotate(10 38 98)" fill="${C.coralLight}"/>
    <!-- belly: cream with its own darker underside -->
    <path d="${BELLY_PATH}" fill="${C.cream}"/>
    <g clip-path="url(#bl)">
      <ellipse cx="380" cy="282" rx="240" ry="34" fill="${C.creamDark}"/>
    </g>
    <!-- narwhal mottling -->
    <ellipse cx="300" cy="100" rx="13" ry="9" fill="${C.coralDark}"/>
    <ellipse cx="340" cy="84" rx="9" ry="6" fill="${C.coralDark}"/>
    <ellipse cx="250" cy="116" rx="8" ry="6" fill="${C.coralDark}"/>
    <ellipse cx="385" cy="80" rx="7" ry="5" fill="${C.coralDark}"/>
    <ellipse cx="205" cy="130" rx="6" ry="4" fill="${C.coralDark}"/>
  </g>
</svg>`;

/** Convert texture coords to face-anchor coords. */
export const fa = (x: number, y: number) => ({ x: x - FACE_ANCHOR.x, y: y - FACE_ANCHOR.y });
