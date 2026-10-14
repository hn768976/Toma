// Shaders of the shared cell kit: thin-shell glass membrane, granular
// nucleus, backdrop quad, floating particles, and the DoF gather/composite.
import * as THREE from "three";
import { BACKDROP, SIMPLEX3 } from "../lib/glsl";
import { RINGS } from "./lathe";

/** Uniforms shared by every material of one engine (palette, backdrop). */
export type SharedUniforms = Record<string, THREE.IUniform>;

const WINDOW = /* glsl */ `
uniform vec3 uWinDir;
uniform vec3 uWin2Dir;
// A soft four-pane softbox seen in reflection: the "window" highlight.
float pane(vec3 R, vec3 W, vec2 halfSize, float soft) {
  float w = dot(R, W);
  if (w <= 0.05) return 0.0;
  vec3 wx = normalize(cross(vec3(0.0, 1.0, 0.0), W));
  vec3 wy = cross(W, wx);
  vec2 q = vec2(dot(R, wx), dot(R, wy)) / w;
  vec2 b = smoothstep(halfSize + soft, halfSize - soft, abs(q));
  float box = b.x * b.y;
  return box * box;
}
float windowLight(vec3 R) {
  return pane(R, uWinDir, vec2(0.34, 0.16), 0.16)
       + 0.3 * pane(R, uWin2Dir, vec2(0.2, 0.3), 0.16);
}
`;

const MEMBRANE_VERT = /* glsl */ `
attribute float ring;
attribute float theta;
uniform vec4 uProfile[${RINGS}];
uniform float uWobAmp;
uniform float uWobFreq;
uniform vec3 uWobSeed;
uniform vec3 uWobPhase;
uniform mat4 uMainProj;
varying vec3 vN;
varying vec3 vViewPos;
varying vec4 vMainClip;
varying vec3 vLocal;
${SIMPLEX3}
float wob(vec3 p) {
  vec3 q = p * uWobFreq + uWobSeed;
  return snoise(q + uWobPhase) * 0.65 + snoise(q * 2.2 - uWobPhase.yzx) * 0.35;
}
void main() {
  vec4 pr = uProfile[int(ring + 0.5)];
  float c = cos(theta);
  float s = sin(theta);
  vec3 p = vec3(pr.x, pr.y * c, pr.y * s);
  vec3 n = normalize(vec3(pr.z, pr.w * c, pr.w * s));
  vec3 t2 = vec3(0.0, -s, c);
  vec3 t1 = normalize(cross(t2, n) + vec3(1e-5));
  float e = 0.025;
  float h0 = wob(p);
  float h1 = wob(p + t1 * e);
  float h2 = wob(p + t2 * e);
  vec3 np = normalize(n - uWobAmp * ((h1 - h0) / e * t1 + (h2 - h0) / e * t2));
  vec3 pd = p + n * (uWobAmp * h0);
  vLocal = pd;
  vec4 mv = modelViewMatrix * vec4(pd, 1.0);
  vViewPos = mv.xyz;
  vN = normalize(normalMatrix * np);
  vMainClip = uMainProj * mv;
  gl_Position = projectionMatrix * mv;
}
`;

const MEMBRANE_FRAG = /* glsl */ `
uniform float uSide;      // +1 front faces, -1 back faces
uniform float uMembrane;  // shell optical thickness
uniform float uLineBright;
uniform vec3 uLineTint;
uniform float uRefr;      // refraction offset (uv) at the silhouette
uniform float uRefrMix;
uniform float uHaze;
uniform vec3 uHazeColor;
uniform float uRefl;
uniform float uWindow;
uniform vec3 uWobSeed;
uniform float uCloudAmt;
uniform float uBody;
uniform vec3 uBodyTint;
uniform float uDarkBand;
uniform float uBodyLift;
uniform float uCrescent;
varying vec3 vN;
varying vec3 vViewPos;
varying vec4 vMainClip;
varying vec3 vLocal;
${SIMPLEX3}
${BACKDROP}
${WINDOW}
void main() {
  vec3 V = normalize(-vViewPos);
  vec3 N = normalize(vN) * uSide;
  float NdV = clamp(dot(N, V), 0.0, 1.0);
  float front = step(0.0, uSide);
  vec2 suv = vMainClip.xy / vMainClip.w * 0.5 + 0.5;
  float g = 1.0 - NdV;
  float F = 0.02 + 0.98 * pow(g, 5.0);
  F = 2.0 * F / (1.0 + F); // two interfaces of a thin shell
  vec3 R = reflect(-V, N);
  vec3 bgHere = backdrop(suv);
  vec3 behind = backdrop(suv + R.xy * 0.10);
  vec3 studio = uBgEdge * 0.55;
  vec3 env = mix(studio, behind, smoothstep(0.35, -0.35, R.z));
  float win = windowLight(R) * smoothstep(0.0, 0.25, NdV);
  vec3 spec = F * env * uRefl + vec3(win) * uWindow * (0.2 + 0.8 * F);
  // inner surface: reflections much weaker, no softbox (it read as haze)
  spec = front > 0.5 ? spec : F * env * uRefl * 0.35;

  // The shell seen edge-on: optical path through the membrane grows as 1/NdV.
  float line = (1.0 - exp(-uMembrane / max(NdV, 0.025))) - (1.0 - exp(-uMembrane));
  line = clamp(line, 0.0, 0.92);
  vec2 toGlow = normalize((uGlowPos - suv) * vec2(uAspect, 1.0) + 1e-4);
  float glowSide = dot(normalize(N.xy + 1e-4), toGlow);
  vec3 lineCol = mix(uLineTint, bgHere, 0.55) * uLineBright * (0.95 + 0.45 * glowSide);

  // Glass body: the sphere acts as a weak ball lens, so the disc shows a
  // displaced, tinted copy of what is behind it, displaced more toward the
  // rim, with a darker band just inside the bright edge.
  float cloud = snoise(vLocal * 2.1 + uWobSeed) * 0.5 + snoise(vLocal * 4.7 - uWobSeed) * 0.3
              + smoothstep(0.55, 0.9, snoise(vLocal * 13.0 + uWobSeed.zxy)) * 0.9;
  vec2 wav = vec2(snoise(vLocal * 3.3 + 1.7), snoise(vLocal * 3.3 - 4.1)) * 0.026;
  vec2 ofs = -N.xy * uRefr * (0.35 + 1.8 * g * g) + wav;
  vec3 body = backdrop(suv + ofs) * uBodyTint + uBodyLift * uBodyTint * (0.6 + 0.4 * cloud);
  body *= 1.0 - uDarkBand * smoothstep(0.42, 0.72, g) * (1.0 - smoothstep(0.86, 0.98, g));
  float aR = clamp(uBody * (0.55 + 0.45 * g) * front, 0.0, 1.0);
  vec3 refr = body;

  // Cytoplasm: faint, slightly cloudy fill lit by the backdrop.
  float aH = clamp(uHaze * (1.0 + uCloudAmt * cloud), 0.0, 1.0) * front;
  vec3 hazeCol = uHazeColor * (0.55 + 0.45 * bgHere / max(max(uBgMid.r, uBgMid.g), 0.05));

  float a = 1.0 - (1.0 - aR) * (1.0 - line) * (1.0 - aH);
  // Crescent: the rim on the side facing the glow catches the backlight.
  float cres = pow(g, 4.0) * smoothstep(-0.2, 0.9, glowSide) * uCrescent * front;
  vec3 rgb = refr * aR
           + vec3(cres) * (0.6 + 0.4 * bgHere)
           + lineCol * line * (1.0 - aR)
           + hazeCol * aH * (1.0 - aR) * (1.0 - line)
           + spec;
  // keep MSAA samples in range so rims resolve cleanly
  gl_FragColor = vec4(min(rgb, vec3(1.0)), a);
}
`;

const NUCLEUS_VERT = /* glsl */ `
attribute float cav;
varying vec3 vN;
varying vec3 vViewPos;
varying float vCav;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  vN = normalize(normalMatrix * normal);
  vCav = cav;
  gl_Position = projectionMatrix * mv;
}
`;

const NUCLEUS_FRAG = /* glsl */ `
uniform vec3 uNucBase;
uniform vec3 uNucDeep;
uniform vec3 uNucHi;
uniform vec3 uNucSpec;
uniform float uNucGlow;
uniform float uNucShine;
uniform vec3 uWinDir;
varying vec3 vN;
varying vec3 vViewPos;
varying float vCav;
void main() {
  vec3 V = normalize(-vViewPos);
  vec3 N = normalize(vN);
  if (dot(N, V) < 0.0) N = -N;
  float NdV = clamp(dot(N, V), 0.0, 1.0);
  vec3 Lf = normalize(uWinDir);
  vec3 Lb = normalize(vec3(0.25, 0.45, -0.85));
  float diff = max((dot(N, Lf) + 0.35) / 1.35, 0.0);
  float back = max((dot(N, Lb) + 0.6) / 1.6, 0.0);
  float c = smoothstep(-0.1, 1.05, vCav);
  vec3 base = mix(uNucDeep, uNucBase, c);
  vec3 col = base * (0.22 + 0.62 * diff + 0.30 * back);
  // Subsurface-like glow: light scattered out near the silhouette and from
  // the raised granules.
  float rim = pow(1.0 - NdV, 2.2);
  col += uNucHi * uNucGlow * (rim * (0.35 + 0.65 * c) + 0.12 * c * c);
  vec3 H = normalize(Lf + V);
  float sp = pow(max(dot(N, H), 0.0), uNucShine) * (0.25 + 0.75 * c);
  col += uNucSpec * sp;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const makeMembraneMaterials = (shared: SharedUniforms) => {
  const own: Record<string, THREE.IUniform> = {
    uProfile: { value: Array.from({ length: RINGS }, () => new THREE.Vector4()) },
    uWobAmp: { value: 0.012 },
    uWobFreq: { value: 1.6 },
    uWobSeed: { value: new THREE.Vector3() },
    uWobPhase: { value: new THREE.Vector3() },
  };
  const make = (side: 1 | -1) =>
    new THREE.ShaderMaterial({
      vertexShader: MEMBRANE_VERT,
      fragmentShader: MEMBRANE_FRAG,
      uniforms: { ...shared, ...own, uSide: { value: side } },
      side: side === 1 ? THREE.FrontSide : THREE.BackSide,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
  return { back: make(-1), front: make(1), own };
};

export const makeNucleusMaterial = (shared: SharedUniforms) =>
  new THREE.ShaderMaterial({
    vertexShader: NUCLEUS_VERT,
    fragmentShader: NUCLEUS_FRAG,
    uniforms: shared,
    transparent: true, // sorted with the glass by renderOrder
    depthWrite: true,
    depthTest: true,
    blending: THREE.NoBlending,
  });

export const makeBackdropMaterial = (shared: SharedUniforms) =>
  new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      ${SIMPLEX3}
      ${BACKDROP}
      void main() { gl_FragColor = vec4(backdrop(vUv), 1.0); }
    `,
    uniforms: shared,
    depthTest: false,
    depthWrite: false,
  });

export const makeParticleMaterial = (shared: SharedUniforms) =>
  new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute vec4 seed; // xyz: drift phases, w: size factor
      uniform float uLoopPhase;
      uniform float uFocus;
      uniform float uAperturePx;
      uniform float uPxPerUnit; // projection scale: pixels per unit at depth 1
      uniform float uPartSize;
      varying float vAlpha;
      varying float vSharp;
      void main() {
        float t = uLoopPhase * 6.2831853;
        vec3 p = position + 0.35 * vec3(sin(t + seed.x), sin(t + seed.y) , sin(t + seed.z));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float z = max(-mv.z, 0.05);
        float coc = uAperturePx * abs(1.0 - uFocus / z);
        float core = max(uPartSize * seed.w * uPxPerUnit / z, 1.2);
        float size = core + coc * 2.0;
        gl_PointSize = min(size, 256.0);
        vAlpha = clamp((core * core) / (size * size), 0.02, 1.0);
        vSharp = core / size;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uPartColor;
      uniform float uPartAlpha;
      varying float vAlpha;
      varying float vSharp;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, mix(0.4, 0.0, vSharp), r);
        a *= vAlpha * uPartAlpha;
        gl_FragColor = vec4(uPartColor * a, a);
      }
    `,
    uniforms: shared,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });

// DoF gather: fixed 40-tap golden-angle disc, weights fall off gently toward
// the rim so the bokeh is soft like a real lens at this aperture.
export const makeGatherMaterial = () =>
  new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tSrc;
      uniform vec2 uInvSize;   // 1 / texture size
      uniform vec2 uMaxUv;     // valid region
      uniform float uRadius;   // texels
      void main() {
        vec2 uv = gl_FragCoord.xy * uInvSize;
        if (uRadius < 0.2) { gl_FragColor = texture2D(tSrc, uv); return; }
        vec4 acc = vec4(0.0);
        float wsum = 0.0;
        vec2 lo = 0.5 * uInvSize;
        vec2 hi = uMaxUv - 0.5 * uInvSize;
        // Small blurs need fewer taps for the same smoothness.
        int taps = uRadius < 1.5 ? 12 : (uRadius < 3.0 ? 24 : 40);
        float ft = float(taps);
        for (int i = 0; i < 40; i++) {
          if (i >= taps) break;
          float fi = float(i);
          float r = sqrt((fi + 0.5) / ft);
          float a = fi * 2.39996323;
          vec2 o = vec2(cos(a), sin(a)) * r * uRadius;
          float w = 1.0 - 0.45 * r * r;
          vec2 suv = clamp(uv + o * uInvSize, lo, hi);
          acc += texture2D(tSrc, suv) * w;
          wsum += w;
        }
        gl_FragColor = acc / wsum;
      }
    `,
    uniforms: {
      tSrc: { value: null },
      uInvSize: { value: new THREE.Vector2() },
      uMaxUv: { value: new THREE.Vector2() },
      uRadius: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });

export const makeCompositeMaterial = () =>
  new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      uniform vec4 uRect;   // NDC x0, y0, x1, y1
      uniform vec2 uMaxUv;
      varying vec2 vUv;
      void main() {
        vec2 t = position.xy * 0.5 + 0.5;
        vUv = t * uMaxUv;
        gl_Position = vec4(mix(uRect.xy, uRect.zw, t), 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tSrc;
      uniform vec2 uMaxUv;
      uniform vec2 uInvSize;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec2 uv = clamp(vUv, 0.5 * uInvSize, uMaxUv - 0.5 * uInvSize);
        gl_FragColor = texture2D(tSrc, uv) * uOpacity;
      }
    `,
    uniforms: {
      tSrc: { value: null },
      uRect: { value: new THREE.Vector4() },
      uMaxUv: { value: new THREE.Vector2() },
      uInvSize: { value: new THREE.Vector2() },
      uOpacity: { value: 1 },
    },
    depthTest: false,
    depthWrite: false,
    transparent: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });

// Soft glow around a nucleus (light scattered into the cytoplasm).
export const makeHaloMaterial = (shared: SharedUniforms) =>
  new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vViewPos;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mv.xyz;
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uNucHi;
      uniform float uHalo;
      varying vec3 vN;
      varying vec3 vViewPos;
      void main() {
        // back faces only: the nucleus occludes the centre, leaving a glow\n        // that fades outward from its silhouette\n        float ndv = abs(dot(normalize(vN), normalize(-vViewPos)));
        float k = pow(ndv, 2.5) * uHalo;
        gl_FragColor = vec4(uNucHi * k, 0.0);
      }
    `,
    uniforms: shared,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
