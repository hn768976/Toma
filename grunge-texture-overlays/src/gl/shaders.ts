import { NOISE_GLSL } from "./noise.glsl";

export const FULLSCREEN_VERT = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Card pass: renders one texture card into a render target (card = frame + bleed on every side).
 * Output: R = ink (0 = nothing, exactly).
 */
export const cardFrag = (lookShader: string, clearCentre: boolean, brushLayers: number) => /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uLines;
uniform sampler2D uBrush0;
uniform sampler2D uBrush1;
uniform sampler2D uBrush2;
uniform sampler2D uBrush3;
uniform float uAspect;
uniform float uBleed;
uniform float uPx;
uniform int uSeed;
uniform vec4 uP[4];
${NOISE_GLSL}
${lookShader}
void main() {
  vec2 f = vUv * (1.0 + 2.0 * uBleed) - uBleed;   // frame fraction, y up
  vec2 F = vec2(f.x, 1.0 - f.y);                   // frame fraction, y down
  vec2 P = vec2(F.x * uAspect, F.y);               // height units, y down
  float base = clamp(lookInk(P, F), 0.0, 1.0);
  float lines = texture(uLines, vUv).r;
  float bInk = 0.0;
  ${
    brushLayers > 0
      ? `const vec3 LUMA = vec3(0.299, 0.587, 0.114);
  // small cross blur softens the hard p5.brush edges a little (ink-wash bleed)
  vec2 bo = vec2(3.5 * uPx / uAspect, 3.5 * uPx) / (1.0 + 2.0 * uBleed);
  vec4 cov = vec4(0.0);
  for (int k = 0; k < 5; k++) {
    vec2 o = k == 0 ? vec2(0.0) : k == 1 ? vec2(bo.x, 0.0) : k == 2 ? vec2(-bo.x, 0.0) : k == 3 ? vec2(0.0, bo.y) : vec2(0.0, -bo.y);
    float wgt = k == 0 ? 0.4 : 0.15;
    cov += wgt * (vec4(1.0) - vec4(dot(texture(uBrush0, vUv + o).rgb, LUMA), dot(texture(uBrush1, vUv + o).rgb, LUMA),
                                   dot(texture(uBrush2, vUv + o).rgb, LUMA), dot(texture(uBrush3, vUv + o).rgb, LUMA)));
  }
  cov = clamp(cov, 0.0, 1.0);
  cov = max(cov - 0.004, 0.0);
  bInk = clamp(brushInk(cov, P), 0.0, 1.0);`
      : ""
  }
  float ink = 1.0 - (1.0 - base) * (1.0 - lines) * (1.0 - bInk);
  ${
    clearCentre
      ? `// keep the centre clean (a little larger than 75% x 65% so gate weave never brings marks in)
  vec2 cd = abs(F - 0.5) - vec2(0.39, 0.34);
  ink *= smoothstep(0.0, 0.035, max(cd.x, cd.y * 1.2));`
      : ""
  }
  // hard floor: anything below ~1.5/255 is "no texture", so empty areas are exact
  ink = max(ink - 0.006, 0.0) / 0.994;
  outColor = vec4(ink, ink, ink, 1.0);
}
`;

/**
 * Display pass (every frame): samples the held card with gate weave, adds the persistent marks and
 * stains, applies the exposure jump and maps ink to the clip's colours.
 */
export const displayFrag = (stainStyle: "scuff" | "toner" | "smudge", clearCentre: boolean) => /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uCard;
uniform sampler2D uPersist;
uniform float uAspect;
uniform float uBleed;
uniform float uPx;
uniform vec2 uOffset;
uniform float uScale;
uniform float uRot;
uniform float uGain;
uniform vec4 uStain[2];      // x, y (frame fraction, y down), radius (height units), strength (0 = off)
uniform vec4 uStainStyle[2]; // grain, roughness, seed, angle
uniform int uMode;           // 0 = black bg, 1 = white bg, 2 = coloured bg (multiply)
uniform float uInkScale;
uniform vec3 uBg;
uniform vec3 uMark;
${NOISE_GLSL}

float stain(vec2 P, vec4 st, vec4 sty) {
  if (st.w <= 0.0) return 0.0;
  vec2 c = vec2(st.x * uAspect, st.y);
  vec2 d = (P - c) / st.z;
  if (dot(d, d) > 4.0) return 0.0;
  int s = int(sty.z);
  float ca = cos(sty.w), sa = sin(sty.w);
  vec2 dr = mat2(ca, sa, -sa, ca) * d;
  dr.x *= 0.75;
  float n = fbm(dr * 1.3, s, 5);
  float rr = length(dr) + sty.y * n;
  float m = smoothstep(1.0, 0.45, rr);
  float body;
  ${
    stainStyle === "scuff"
      ? `body = 0.55 + 0.45 * fbm(vec2(dr.x * 3.0, dr.y * 0.6) * 3.0, s + 3, 4);`
      : stainStyle === "toner"
        ? `body = 0.5 + 0.5 * fbm(dr * 4.0, s + 3, 4);`
        : `body = 0.5 + 0.5 * fbm(vec2(dr.x * 9.0, dr.y * 0.8), s + 3, 4);`
  }
  float g = mix(1.0, 0.35 + 0.65 * vnoise(P * 520.0, s + 5), sty.x);
  return clamp(m * body * g * st.w, 0.0, 1.0);
}

void main() {
  // gate weave: inverse-transform output position into the held card
  vec2 c = vUv - 0.5;
  c.x *= uAspect;
  float ca = cos(-uRot), sa = sin(-uRot);
  c = mat2(ca, sa, -sa, ca) * c;
  c /= uScale;
  c.x /= uAspect;
  vec2 f = c + 0.5 - vec2(uOffset.x, -uOffset.y);  // frame fraction, y up
  vec2 cuv = (f + uBleed) / (1.0 + 2.0 * uBleed);
  float card = texture(uCard, cuv).r;
  float pers = texture(uPersist, cuv).r;
  vec2 P = vec2(f.x * uAspect, 1.0 - f.y);
  float st = max(stain(P, uStain[0], uStainStyle[0]), stain(P, uStain[1], uStainStyle[1]));
  float ink = 1.0 - (1.0 - card) * (1.0 - pers) * (1.0 - st);
  ink = clamp(ink * uGain, 0.0, 1.0);
  ${
    clearCentre
      ? `vec2 cd = abs(vUv - 0.5) - vec2(0.375, 0.325);
  ink *= smoothstep(0.0, 0.03, max(cd.x, cd.y));`
      : ""
  }
  ink = ink < 0.002 ? 0.0 : ink;
  vec3 col;
  if (uMode == 0) col = vec3(ink * uInkScale);
  else if (uMode == 1) col = vec3(1.0 - ink * uInkScale);
  else col = uBg * (vec3(1.0) - ink * uInkScale * (vec3(1.0) - uMark));
  outColor = vec4(col, 1.0);
}
`;
