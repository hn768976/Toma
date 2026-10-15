import React, { useCallback } from "react";
import * as THREE from "three";
import { HASH, SIMPLEX3 } from "../../lib/glsl";
import { hexToLinear } from "../../lib/color";
import { grainFrame, loopPhase } from "../../lib/loop";
import { PostPipeline } from "../../lib/post";
import { ThreeLook, ThreeLookFactory } from "../../lib/ThreeLook";

export type WhirlVariant = {
  id: string;
  /** core centre, white-blue */
  core: string;
  /** glow around the core */
  coreGlow: string;
  /** body of the spiral arms */
  matter: string;
  /** ridge highlights */
  highlight: string;
  /** gaps between arms / vignette */
  deep: string;
  sparkleA: string;
  sparkleB: string;
  /** warm amber tint in the near cloud bodies */
  warm: string;
};

const ARMS = 3;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uT;
uniform float uAspect;
uniform float uPxH;
uniform vec2 uCore;
uniform vec3 cCore, cGlow, cMatter, cHi, cDeep, cSpA, cSpB, cWarm;
varying vec2 vUv;
${SIMPLEX3}
${HASH}
#define TAU 6.28318530718
#define ARMS ${ARMS.toFixed(1)}

// smooth fbm -> soft, clumpy, cloud-like matter (0..1)
float fbm(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += a * snoise(p);
    p = p * 2.07 + vec3(1.7, 9.2, 4.1);
    a *= 0.5;
  }
  return 0.5 + 0.55 * s;
}
// billowy fbm -> clumps (cauliflower-like), 0..1
float billow(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * (1.0 - abs(snoise(p)));
    p = p * 2.11 + vec3(1.7, 9.2, 4.1);
    a *= 0.58;
  }
  return s;
}

// one layer of hashed sparkles on a conformal (log-polar) grid in the co-rotating frame.
// M cells around the full circle (multiple of ARMS so the grid is periodic under the loop rotation).
vec3 sparkles(float th, float s, float r, float M, float seed, float mask) {
  float cell = TAU / M;
  vec2 g = vec2(th / cell, s / cell);
  vec2 id = floor(g);
  id.x = mod(id.x, M);
  vec2 f = fract(g);
  vec3 h = hash32(id + seed);
  if (h.z > 0.15) return vec3(0.0);
  vec2 c = 0.25 + 0.5 * h.xy;
  float cellPx = r * cell * uPxH;              // cell size on screen in pixels
  float dPx = length(f - c) * cellPx;
  float radPx = mix(0.6, 2.2, h.x * h.x) * (uPxH / 720.0) * mix(1.0, 2.0, smoothstep(-1.5, -0.3, s));
  float tw = 0.55 + 0.45 * sin(TAU * (floor(1.0 + h.y * 3.0) * uT + h.z * 7.0));
  float core = exp(-dPx * dPx / (radPx * radPx));
  // fade layers whose cells get too small on screen (prevents aliasing near the core)
  float vis = smoothstep(4.0, 9.0, cellPx / (uPxH / 720.0));
  vec3 col = mix(cSpA, cSpB, step(0.55, h.y));
  return col * core * tw * vis * mask * mix(1.5, 6.0, h.x);
}

void main() {
  vec2 p = (vUv - uCore) * vec2(uAspect, 1.0);
  float r = max(length(p), 1e-4);
  float a = atan(p.y, p.x);
  float s = log(r);

  // co-rotating angle: the pattern turns exactly one arm spacing (TAU/ARMS) per loop
  float th = a + TAU / ARMS * uT;
  float phi = ARMS * th + 6.0 * s;   // logarithmic spiral phase (6 = 2*ARMS keeps it loop-periodic)

  // Noise lives in (spiral phase, log r) space. In that space the screen metric is
  // anisotropic: across the arms d(phi) ~ 6.7/r per unit length, along them d(s) ~ 0.45/r.
  // Scaling s by ~6x the phase radius gives clumps ~2.5x longer along the arms than across.
  // The phase is embedded on a circle (no seam at the atan wrap) and a time circle T is added
  // to every lookup, so the texture evolves and still loops exactly.
  vec3 T = 0.3 * vec3(cos(TAU * uT), sin(TAU * uT), 0.0);
  vec3 Pw = vec3(0.55 * cos(phi), 0.55 * sin(phi), 3.3 * s) + T;
  float w1 = snoise(Pw);
  float w2 = snoise(Pw + vec3(5.2, 1.3, 2.8));
  float phiW = phi + 0.9 * w1;
  float sW = s + 0.05 * w2;

  // near-isotropic clumps (~1.6:1 along the arms): lumpy cloud matter, not hair
  vec3 P = vec3(1.25 * cos(phiW), 1.25 * sin(phiW), 11.5 * sW) + T * 2.0;
  float h = billow(P) * 0.85;
  // fake lighting: directional derivative of the height field toward the core
  // (the core is the light source, so the sides of the lumps facing it catch the light)
  float hL = billow(P - vec3(0.0, 0.0, 0.09)) * 0.85;
  float diff = clamp(0.35 + (h - hL) * 5.0, 0.0, 1.0);
  float ridge = diff * diff * diff;

  // arm density: broad bands, narrow dark crescent channels between them
  float arm = cos(phiW) * 0.5 + 0.5;
  float dens = smoothstep(0.3, 0.68, arm * 0.95 + (h - 0.5) * 0.6);

  // depth: the funnel recedes toward the core; outer matter is nearest and largest
  float depth = smoothstep(-4.6, -0.6, s);
  float inner = 1.0 - smoothstep(-3.0, -1.7, s);   // bright inner rim of the tunnel

  vec3 matter = cMatter * (0.12 + 1.05 * diff) * (0.3 + 0.9 * h) + cHi * ridge * 1.1;
  matter *= mix(0.45, 0.85, depth);
  // warm amber in the near (outer) cloud bodies
  float warmMask = smoothstep(-1.4, -0.3, s) * smoothstep(0.1, 0.7, snoise(P * 0.35 + 3.0) * 0.5 + 0.5);
  matter = mix(matter, matter * cWarm * 2.2, warmMask * 0.6);
  // the inner rim glows pale blue, streaking along the swirl
  float streak = 0.5 + 0.5 * cos(phiW * 2.0 + h * 4.0);
  matter += cGlow * inner * (0.3 + 0.8 * streak) * 0.9;

  vec3 col = cDeep * (0.35 + 0.4 * h);
  col = mix(col, matter, dens);

  // core: a small darker hole with a glowing rim and one bright point
  float hole = smoothstep(0.012, 0.05, r);
  col *= mix(0.25, 1.0, hole);
  float ring = (r - 0.05) / 0.025;
  col += cGlow * exp(-ring * ring) * 0.9;
  col += cCore * exp(-ring * ring * 2.0) * 0.5;
  col += cGlow * exp(-r / 0.09) * 0.35 * hole;
  float pt = r / 0.006;
  col += cCore * exp(-pt * pt) * 2.5;

  // sparkles embedded in the matter (gold & white), a few in the gaps
  float smask = mix(0.12, 1.0, dens);
  vec3 sp = vec3(0.0);
  sp += sparkles(th, s, r, 96.0, 3.0, smask);
  sp += sparkles(th, s, r, 192.0, 11.0, smask);
  sp += sparkles(th, s, r, 384.0, 29.0, smask);
  sp += sparkles(th, s, r, 768.0, 47.0, smask);
  col += sp;

  gl_FragColor = vec4(col, 1.0);
}
`;

const makeFactory =
  (v: WhirlVariant): ThreeLookFactory =>
  (gl, pxW, pxH) => {
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const lin = (h: string) => new THREE.Vector3(...hexToLinear(h));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uT: { value: 0 },
        uAspect: { value: pxW / pxH },
        uPxH: { value: pxH },
        uCore: { value: new THREE.Vector2(0.555, 0.5) },
        cCore: { value: lin(v.core) },
        cGlow: { value: lin(v.coreGlow) },
        cMatter: { value: lin(v.matter) },
        cHi: { value: lin(v.highlight) },
        cDeep: { value: lin(v.deep) },
        cSpA: { value: lin(v.sparkleA) },
        cSpB: { value: lin(v.sparkleB) },
        cWarm: { value: lin(v.warm) },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    scene.add(quad);

    const post = new PostPipeline(pxW, pxH, {
      msaa: 0,
      dof: { mode: "radial", maxCoc: 0.024, radialCenter: [0.555, 0.5], radialRange: [0.36, 1.0] },
      bloom: { strength: 0.35, threshold: 0.9, knee: 0.6 },
      vignette: { strength: 0.9, color: hexToLinear(v.deep).map((c) => c * 0.4) as [number, number, number] },
      exposure: 0.85,
      grain: 0.015,
    });

    return {
      render: (g, frame) => {
        mat.uniforms.uT.value = loopPhase(frame);
        post.render(g, scene, cam, grainFrame(frame));
      },
      dispose: () => {
        post.dispose();
        mat.dispose();
      },
    };
  };

export const CosmicWhirl: React.FC<{ variant: WhirlVariant; loopCheck?: boolean }> = ({ variant }) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const create = useCallback(makeFactory(variant), [variant.id]);
  return <ThreeLook create={create} background={variant.deep} />;
};
