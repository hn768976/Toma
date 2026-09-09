export const GLYPH_VERT = /* glsl */ `
precision highp float;

attribute vec3 aOffset;   // base x within the tile, y, z
attribute vec2 aSize;     // half width/height in "px at the focus plane"
attribute float aType;    // glyph shape id
attribute vec3 aColour;
attribute vec4 aAnim;     // scrollCycles, pulseCycles, pulsePhase, pulseDepth

uniform float uT;           // 0..1 over the loop
uniform float uTile;        // tile width in world units
uniform float uTileOffset;  // which tile copy this mesh is
uniform float uPxToWorld;   // world units per master pixel at the focus plane
uniform float uRenderH;
uniform float uMinPx;

varying vec2 vUv;
varying vec3 vColour;
varying float vType;
varying float vGain;

void main() {
  vUv = uv - 0.5;
  vType = aType;

  // Slow brightness pulse, integer cycles so it closes the loop exactly.
  float pulse = 1.0;
  if (aAnim.y > 0.5) {
    float s = 0.5 + 0.5 * sin(6.283185307 * (aAnim.y * uT + aAnim.z));
    pulse = mix(1.0 - aAnim.w, 1.0, s);
  }
  vColour = aColour * pulse;

  // Rows scroll along X by an integer number of tiles over the loop, and wrap
  // on the tile period, so frame 600 lands exactly on frame 0.
  float x = aOffset.x + uT * aAnim.x * uTile;
  x = mod(x + uTile * 0.5, uTile) - uTile * 0.5 + uTileOffset;

  vec3 centre = vec3(x, aOffset.y, aOffset.z);
  vec4 viewCentre = modelViewMatrix * vec4(centre, 1.0);

  vec2 halfWorld = aSize * uPxToWorld;
  float pxPerWorld = uRenderH * 0.5 * projectionMatrix[1][1] / max(0.001, -viewCentre.z);
  vec2 halfPx = halfWorld * pxPerWorld;
  // Never let a glyph fall below one pixel: grow the quad and dim it by the
  // same factor so total energy — and therefore the look — is preserved.
  vec2 grow = max(vec2(1.0), uMinPx / max(halfPx, vec2(1e-4)));
  halfWorld *= grow;
  vGain = 1.0 / (grow.x * grow.y);

  vec4 view = viewCentre + vec4(position.x * halfWorld.x * 2.0, position.y * halfWorld.y * 2.0, 0.0, 0.0);
  gl_Position = projectionMatrix * view;
}
`;

export const GLYPH_FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying vec3 vColour;
varying float vType;
varying float vGain;

void main() {
  vec2 q = vUv;
  vec2 w = fwidth(q) * 1.4 + 1e-5;
  float m;

  if (vType < 0.5) {
    // filled dot
    float d = length(q);
    m = 1.0 - smoothstep(0.5 - w.x, 0.5, d);
  } else if (vType < 2.5) {
    // short dash / small square
    vec2 b = 1.0 - smoothstep(vec2(0.5) - w, vec2(0.5), abs(q));
    m = b.x * b.y;
  } else if (vType < 3.5) {
    // hollow square
    vec2 bo = 1.0 - smoothstep(vec2(0.5) - w, vec2(0.5), abs(q));
    vec2 bi = 1.0 - smoothstep(vec2(0.30) - w, vec2(0.30), abs(q));
    m = clamp(bo.x * bo.y - bi.x * bi.y, 0.0, 1.0);
  } else if (vType < 4.5) {
    // ring
    float d = length(q);
    m = (1.0 - smoothstep(0.5 - w.x, 0.5, d)) * smoothstep(0.36 - w.x, 0.36, d);
  } else {
    // thin bar
    vec2 b = 1.0 - smoothstep(vec2(0.5) - w, vec2(0.5), abs(q));
    m = b.x * b.y;
  }

  gl_FragColor = vec4(vColour * m * vGain, 1.0);
}
`;

export const COMPOSITE_FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform sampler2D uScene;
uniform sampler2D uBloom0;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;

uniform vec2 uResolution;
uniform float uAspect;
uniform vec3 uBgBase;
uniform vec3 uBgGlow;
uniform vec2 uGlowOffset;
uniform float uGlowRadius;
uniform float uVignette;
uniform float uExposure;
uniform float uBloomStrength;
uniform float uCA;
uniform float uGrain;
uniform float uFrame;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);

  // --- background: near-black navy + soft radial glow left of centre -------
  vec2 gc = uGlowOffset * vec2(uAspect, 1.0);
  float gd = length(p - gc) / uGlowRadius;
  vec3 bg = uBgBase + uBgGlow * exp(-gd * gd * 2.1);

  // --- chromatic aberration: channels split radially toward the edges -----
  vec2 dir = (uv - 0.5);
  vec2 off = dir * dot(dir, dir) * 4.0 * (uCA / uResolution.x);
  vec3 scene;
  scene.r = texture2D(uScene, uv + off).r;
  scene.g = texture2D(uScene, uv).g;
  scene.b = texture2D(uScene, uv - off).b;

  vec3 bloom =
      texture2D(uBloom0, uv).rgb * 0.55 +
      texture2D(uBloom1, uv).rgb * 0.30 +
      texture2D(uBloom2, uv).rgb * 0.15;

  vec3 col = bg + scene * uExposure + bloom * uBloomStrength;

  // --- heavy vignette -----------------------------------------------------
  float r = length(p) / 0.78;
  col *= clamp(1.0 - uVignette * r * r * 0.72, 0.0, 1.0);

  // --- highlight rolloff: bundle cores glow instead of clipping to white,
  //     and blacks are left exactly where they are ---------------------------
  col = vec3(1.0) - exp(-col * 1.25);

  // --- fine film grain, period-locked to the loop -------------------------
  float n = hash13(vec3(floor(uv * uResolution), uFrame));
  col += (n - 0.5) * uGrain;

  // --- ordered dither so the gradient never bands at 4K -------------------
  float d = hash13(vec3(floor(uv * uResolution), 7.0)) - 0.5;
  col += d / 255.0;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;
