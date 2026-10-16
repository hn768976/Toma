import * as THREE from "three";
import { MONO } from "./assets";
import { canvasTexture, makeCanvas } from "./helpers";

// Ticking numeric readouts without per-frame canvas redraws: a glyph atlas in
// JetBrains Mono and a shader that picks glyphs from a uniform array.

export const GLYPHS = "0123456789.%$- ";
const GW = 64;
const GH = 96;
const MAX = 12;

let atlas: THREE.Texture | null = null;
export const glyphAtlas = () => {
  if (atlas) return atlas;
  const { c, ctx } = makeCanvas(GW * GLYPHS.length, GH);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "white";
  ctx.font = `700 80px "${MONO}"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < GLYPHS.length; i++) ctx.fillText(GLYPHS[i], i * GW + GW / 2, GH / 2 + 4);
  atlas = canvasTexture(c, false);
  return atlas;
};

export const readoutMaterial = (color: [number, number, number], slots: number) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uAtlas: { value: glyphAtlas() },
      uCol: { value: new THREE.Vector3(...color) },
      uGlyphs: { value: new Array(MAX).fill(GLYPHS.length - 1) },
      uSlots: { value: slots },
      uAmt: { value: 1 },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas; uniform vec3 uCol; uniform float uGlyphs[${MAX}]; uniform float uSlots, uAmt;
      varying vec2 vUv;
      void main(){
        float x = vUv.x * uSlots;
        int slot = int(floor(x));
        float g = 0.0;
        for (int i = 0; i < ${MAX}; i++) if (i == slot) g = uGlyphs[i];
        // sample only the inner 84% of the glyph cell (the glyph is ~75% wide, centred),
        // so linear/mip filtering never pulls in a sliver of the neighbouring glyph
        float fx = fract(x);
        vec2 uv = vec2((g + 0.08 + fx * 0.84) / ${GLYPHS.length.toFixed(1)}, vUv.y);
        float a = texture2D(uAtlas, uv).r * smoothstep(0.0, 0.05, fx) * smoothstep(1.0, 0.95, fx);
        gl_FragColor = vec4(uCol * a * uAmt, 1.0);
      }`,
  });

/** Write a string into a readout material's glyph uniforms (right-aligned). */
export const setReadout = (m: THREE.ShaderMaterial, text: string) => {
  const slots = m.uniforms.uSlots.value as number;
  const arr = m.uniforms.uGlyphs.value as number[];
  const s = text.slice(-slots).padStart(slots, " ");
  for (let i = 0; i < MAX; i++) {
    const ch = i < slots ? s[i] : " ";
    const gi = GLYPHS.indexOf(ch);
    arr[i] = gi < 0 ? GLYPHS.length - 1 : gi;
  }
};
