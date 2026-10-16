import React, { useMemo } from "react";
import * as THREE from "three";
import { blueNoiseTexture } from "../lib/blueNoise";
import { FINISH, HASH, SIMPLEX, SRGB, frag } from "../lib/glsl";
import { makeFullscreenMesh } from "../lib/post";
import { Stage, useDrive } from "../lib/Stage";

/**
 * Look 3 — Pastel Silk. One full-screen fragment shader, no camera:
 *  height = domain-warped 4D simplex swells + anisotropic fine ripples
 *           (sin of a warped scalar field, so they run along its flow lines)
 *           gated into a few fold bands;
 *  normal = finite differences of the height;
 *  colour = pastel palette by position (soft blotches) blended with a
 *           thin-film-like hue shift by normal angle in the folds, + sheen.
 * Time is a point on a circle, θ = 2π·frame/600, fed to the 4D noise as
 * (cos θ, sin θ)·r, so frame 600 ≡ frame 0 exactly.
 */
export type SilkParams = {
  /** Four pastel stops (sRGB hex): [blue-ish, pink-ish, lilac-ish, white-ish]. */
  palette: [string, string, string, string];
  /** Colour for the deepest fold valleys (sRGB hex). */
  deep: string;
};

const LOOP = 600;

const SILK_FRAG = /* glsl */ `
uniform vec2 uRes;
uniform float uTheta;
uniform vec3 uPal[4];
uniform vec3 uDeep;
${HASH}
${SRGB}
${SIMPLEX}
${FINISH}

vec2 CT;
float n4(vec2 q, float r, float seed) {
  return snoise4(vec4(q + vec2(seed * 7.31, seed * 3.17), CT * r + vec2(seed * 1.7, -seed * 2.3)));
}

// cyclic 4-stop pastel palette, uneven stops so the white stop stays a
// highlight rather than a large patch: [0]..0.36, [1]..0.64, [2]..0.86, [3]..1
vec3 pal(float t) {
  t = fract(t);
  const float S1 = 0.36, S2 = 0.64, S3 = 0.86;
  vec3 c;
  if (t < S1) c = mix(uPal[0], uPal[1], smoothstep(0.0, S1, t));
  else if (t < S2) c = mix(uPal[1], uPal[2], smoothstep(S1, S2, t));
  else if (t < S3) c = mix(uPal[2], uPal[3], smoothstep(S2, S3, t));
  else c = mix(uPal[3], uPal[0], smoothstep(S3, 1.0, t));
  return c;
}

struct Silk { float h; float base; float fold; float field; float rip; };

// warp is shared by the centre and the finite-difference taps
Silk silkAt(vec2 p, vec2 q) {
  float base = n4(q * 0.85, 0.32, 20.0);                       // big soft swells
  // anisotropic: stretched along a slowly turning flow direction, so the
  // level sets (and the ripples on them) run as long parallel streaks
  float ang = 0.9 + 0.8 * base;
  mat2 rot = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));
  vec2 qa = rot * q;
  qa *= vec2(0.38, 1.5);
  float field = n4(qa, 0.30, 30.0) + 0.25 * n4(qa * 2.0, 0.30, 31.0);
  float band = n4(q * 0.62 + 2.0, 0.26, 40.0);                 // where folds bunch up
  float fold = smoothstep(-0.5, 0.1, band) * (0.6 + 0.4 * smoothstep(-0.3, 0.6, base));
  float travel = uTheta * 2.0;                                 // ripples travel 2 cycles / loop
  float rip = sin(field * 19.0 - travel);
  rip = rip * (0.75 + 0.25 * sin(field * 13.0 - travel + 1.3));
  float h = base * 0.30 + fold * 0.03 * rip;
  return Silk(h, base, fold, field, rip);
}

void main() {
  CT = vec2(cos(uTheta), sin(uTheta));
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;             // height-normalised
  // two-level domain warp (computed once per pixel)
  vec2 w1 = vec2(n4(p * 0.9, 0.38, 0.0), n4(p * 0.9 + 5.2, 0.38, 1.0));
  vec2 q = p + 0.42 * w1;
  vec2 w2 = vec2(n4(q * 1.6, 0.30, 10.0), n4(q * 1.6 + 3.1, 0.30, 11.0));
  q += 0.22 * w2;

  float e = 1.0 / uRes.y;
  Silk s0 = silkAt(p, q);
  Silk sx = silkAt(p, q + vec2(e, 0.0));
  Silk sy = silkAt(p, q + vec2(0.0, e));
  vec2 g = vec2(sx.h - s0.h, sy.h - s0.h) / e;
  vec3 n = normalize(vec3(-g * 0.11, 1.0));

  // soft base: pastel blotches by position + large swells
  float tBase = 0.10 * p.x + 0.40 * s0.base + 0.20 * w1.x - 0.02;
  vec3 baseCol = pal(clamp(tBase, 0.0, 0.80));
  // thin-film-like stripes along the folds: hue follows the ripple phase
  // and the normal angle; the troughs go deep saturated blue.
  float tilt = clamp(length(n.xy) * 2.2, 0.0, 1.0);
  float fold = s0.fold;
  float tIri = tBase + 0.34 * s0.rip + 0.9 * dot(n.xy, vec2(0.80, 0.60));
  vec3 iri = pal(tIri);
  float trough = smoothstep(-0.05, -0.8, s0.rip);
  iri = mix(iri, uDeep, 0.95 * trough);
  iri = mix(iri, vec3(1.0), 0.25 * smoothstep(0.3, 1.0, s0.rip));
  vec3 col = mix(baseCol, iri, clamp(fold * 1.15, 0.0, 1.0) * (0.55 + 0.45 * tilt));
  // soft sheen along the crests (light from upper left)
  vec3 L = normalize(vec3(-0.45, 0.55, 0.70));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float sheen = pow(max(dot(n, L), 0.0), 3.0) * 0.03;
  col += sheen;
  // keep it high-key
  col *= 0.94;
  gl_FragColor = vec4(finishOutput(linearToSrgb(col)), 1.0);
}
`;

class SilkLook {
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); // unused by the shader
  material: THREE.ShaderMaterial;
  constructor(p: SilkParams) {
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: frag(SILK_FRAG),
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uRes: { value: new THREE.Vector2(1, 1) },
        uTheta: { value: 0 },
        uPal: { value: p.palette.map((h) => new THREE.Color(h)) },
        uDeep: { value: new THREE.Color(p.deep) },
        uFrameMod: { value: 0 },
        uGrain: { value: 0.015 },
        uGrainDarkFade: { value: 0 },
        uBlueNoise: { value: blueNoiseTexture() },
        uUseBlueNoise: { value: 1 },
      },
    });
    this.scene.add(makeFullscreenMesh(this.material));
  }
  update = (frame: number) => {
    const f = ((frame % LOOP) + LOOP) % LOOP;
    this.material.uniforms.uTheta.value = (2 * Math.PI * f) / LOOP;
    this.material.uniforms.uFrameMod.value = f;
  };
  render = (gl: THREE.WebGLRenderer) => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    (this.material.uniforms.uRes.value as THREE.Vector2).copy(size);
    gl.setRenderTarget(null);
    gl.render(this.scene, this.camera);
  };
}

const Inner: React.FC<SilkParams> = (p) => {
  const key = JSON.stringify(p);
  const look = useMemo(() => new SilkLook(p), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useDrive(look);
  return null;
};

export const PastelSilk: React.FC<SilkParams> = (p) => (
  <Stage>
    <Inner {...p} />
  </Stage>
);
