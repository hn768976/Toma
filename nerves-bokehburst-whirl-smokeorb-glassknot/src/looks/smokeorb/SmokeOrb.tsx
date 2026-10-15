import { Buffer, BufferUsage, Geometry, Mesh, Renderer, Shader } from "pixi.js";
import React, { useCallback } from "react";
import { hexToLinear } from "../../lib/color";
import { FINISH, SHOULDER, SIMPLEX3 } from "../../lib/glsl";
import { grainFrame, loopPhase, TAU } from "../../lib/loop";
import { makeNoise3 } from "../../lib/noise";
import { PixiLook, PixiLookFactory } from "../../lib/PixiLook";
import { makeHdrTarget, makeQuad } from "../../lib/pixiUtil";
import { irange, mulberry32, range } from "../../lib/rng";

export type SmokeOrbVariant = {
  id: string;
  core: string;
  rim: string;
  halo: string;
  smoke: string;
  smokeHighlight: string;
};

// ---------- smoke layout: curl-noise streamlines around a unit sphere (computed once) ----------
const SOURCES = 60;
const LINES_PER_SOURCE = 50;
const LINES = SOURCES * LINES_PER_SOURCE;
const STEPS = 140;
const PER_LINE = 50;
const PARTICLES = LINES * PER_LINE; // 150 000

type V3 = [number, number, number];

const buildStreamlines = () => {
  const n1 = makeNoise3(11);
  const n2 = makeNoise3(23);
  const n3 = makeNoise3(37);
  const F = 0.85;
  const e = 0.01;
  // curl of a noise vector potential: divergence-free, so the flow forms sheets and curls
  const curl = (x: number, y: number, z: number): V3 => {
    x *= F;
    y *= F;
    z *= F;
    const dpz_dy = (n3(x, y + e, z) - n3(x, y - e, z)) / (2 * e);
    const dpy_dz = (n2(x, y, z + e) - n2(x, y, z - e)) / (2 * e);
    const dpx_dz = (n1(x, y, z + e) - n1(x, y, z - e)) / (2 * e);
    const dpz_dx = (n3(x + e, y, z) - n3(x - e, y, z)) / (2 * e);
    const dpy_dx = (n2(x + e, y, z) - n2(x - e, y, z)) / (2 * e);
    const dpx_dy = (n1(x, y + e, z) - n1(x, y - e, z)) / (2 * e);
    return [dpz_dy - dpy_dz, dpx_dz - dpz_dx, dpy_dx - dpx_dy];
  };
  const axis: V3 = [0.25, 1, 0.15];
  const al = Math.hypot(...axis);
  axis[0] /= al;
  axis[1] /= al;
  axis[2] /= al;
  const vel = (p: V3): V3 => {
    const r = Math.hypot(p[0], p[1], p[2]);
    const c = curl(p[0], p[1], p[2]);
    // swirl around a tilted axis, strongest near the sphere
    const sw = 1.5 / Math.max(r * r, 1);
    let v: V3 = [
      c[0] * 0.32 + (axis[1] * p[2] - axis[2] * p[1]) * sw,
      c[1] * 0.32 + (axis[2] * p[0] - axis[0] * p[2]) * sw + 0.05,
      c[2] * 0.32 + (axis[0] * p[1] - axis[1] * p[0]) * sw,
    ];
    // the sphere pushes the flow aside: remove the inward component near its surface
    const nx = p[0] / r;
    const ny = p[1] / r;
    const nz = p[2] / r;
    const vn = v[0] * nx + v[1] * ny + v[2] * nz;
    const k = Math.min(1, Math.max(0, (1.7 - r) / 0.6));
    if (vn < 0) v = [v[0] - nx * vn * k, v[1] - ny * vn * k, v[2] - nz * vn * k];
    if (r < 1.12) v = [v[0] + nx * 0.4, v[1] + ny * 0.4, v[2] + nz * 0.4];
    // radial spring toward a shell around the orb so wisps keep wrapping it
    const pull = (r - 1.55) * 0.7 * (r > 1.55 ? 1 : 0.3);
    return [v[0] - nx * pull, v[1] - ny * pull, v[2] - nz * pull];
  };

  const rng = mulberry32(0x5a0e);
  const lines = new Float32Array(LINES * STEPS * 3);
  let li = 0;
  for (let s = 0; s < SOURCES; s++) {
    // more material over the top and the left, so the swirl reads one-directional
    const u = rng() < 0.65 ? range(rng, -0.2, 1) : range(rng, -1, 1);
    const a = rng() < 0.65 ? range(rng, Math.PI * 0.5, Math.PI * 1.5) : rng() * TAU;
    const sq = Math.sqrt(1 - u * u);
    const r0 = range(rng, 1.12, 1.7);
    const c: V3 = [sq * Math.cos(a) * r0, u * r0, sq * Math.sin(a) * r0];
    // a short seed segment -> neighbouring streamlines form a thin sheet
    const d: V3 = [range(rng, -1, 1), range(rng, -1, 1), range(rng, -1, 1)];
    const dl = Math.hypot(...d);
    const spread = range(rng, 0.004, 0.009);
    const dt = range(rng, 0.024, 0.034);
    for (let k = 0; k < LINES_PER_SOURCE; k++) {
      const o = (k - LINES_PER_SOURCE / 2) * spread;
      const p: V3 = [c[0] + (d[0] / dl) * o, c[1] + (d[1] / dl) * o, c[2] + (d[2] / dl) * o];
      for (let st = 0; st < STEPS; st++) {
        const base = (li * STEPS + st) * 3;
        lines[base] = p[0];
        lines[base + 1] = p[1];
        lines[base + 2] = p[2];
        // midpoint (RK2) integration
        const v1 = vel(p);
        const pm: V3 = [p[0] + v1[0] * dt * 0.5, p[1] + v1[1] * dt * 0.5, p[2] + v1[2] * dt * 0.5];
        const v2 = vel(pm);
        p[0] += v2[0] * dt;
        p[1] += v2[1] * dt;
        p[2] += v2[2] * dt;
      }
      li++;
    }
  }

  // per particle: which line, phase offset, whole cycles per loop, jitter, brightness, size
  const pLine = new Uint32Array(PARTICLES);
  const pOff = new Float32Array(PARTICLES);
  const pCyc = new Float32Array(PARTICLES);
  const pJit = new Float32Array(PARTICLES * 3);
  const pData = new Float32Array(PARTICLES * 2);
  for (let l = 0; l < LINES; l++) {
    const cyc = irange(rng, 1, 2);
    for (let j = 0; j < PER_LINE; j++) {
      const i = l * PER_LINE + j;
      pLine[i] = l;
      pOff[i] = (j + rng() * 0.8) / PER_LINE;
      pCyc[i] = cyc;
      pJit[i * 3] = range(rng, -1, 1) * 0.003;
      pJit[i * 3 + 1] = range(rng, -1, 1) * 0.003;
      pJit[i * 3 + 2] = range(rng, -1, 1) * 0.003;
      pData[i * 2] = rng() < 0.03 ? range(rng, 1.6, 2.2) : range(rng, 0.5, 1.0); // brightness
      pData[i * 2 + 1] = range(rng, 0.9, 1.3); // size
    }
  }
  return { lines, pLine, pOff, pCyc, pJit, pData };
};

let LAYOUT: ReturnType<typeof buildStreamlines> | null = null;
const layout = () => (LAYOUT ??= buildStreamlines());

// ---------- shaders ----------
const CAM_D = 4.4;

const PARTICLE_VERT = /* glsl */ `
in vec4 aPos;
in vec2 aData;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform float uT;
uniform float uBob;
uniform float uW;
uniform float uH;
uniform float uFocal;
uniform float uD;
out float vA;
out float vHi;
out float vNear;
${SIMPLEX3}
#define TAU 6.28318530718
void main() {
  // the flow evolves on a time circle: exact loop
  vec3 T = 0.55 * vec3(cos(TAU * uT), sin(TAU * uT), 0.0);
  vec3 p = aPos.xyz;
  vec3 q = p * 1.4 + T;
  p += 0.05 * vec3(snoise(q), snoise(q + vec3(17.1, 3.2, 8.4)), snoise(q + vec3(5.7, 21.3, 11.9)));
  p.y += uBob;
  float z = uD - p.z;
  vec2 s = vec2(uW * 0.5 + uFocal * uH * p.x / z, uH * 0.5 - uFocal * uH * p.y / z);
  // analytic occlusion by the sphere (centre (0,uBob,0), radius 1)
  vec3 C = vec3(0.0, 0.0, uD);
  vec3 dvec = p - C;
  float L = length(dvec);
  vec3 dir = dvec / L;
  vec3 oc = C - vec3(0.0, uBob, 0.0);
  float b = dot(oc, dir);
  float c = dot(oc, oc) - 1.0;
  float disc = b * b - c;
  float vis = 1.0;
  if (disc > 0.0) {
    float tHit = -b - sqrt(disc);
    if (tHit < L) vis = 1.0 - smoothstep(0.0, 0.03, disc);
  }
  float sizePx = 1.35 * aData.y * (uH / 720.0) * (uD / z);
  float a = aData.x * vis * aPos.w;
  // smoke is lit by the orb: brighter close to it
  float rr = length(p - vec3(0.0, uBob, 0.0));
  a *= 0.45 + 1.4 * exp(-(rr - 1.0) * 2.2);
  vNear = exp(-(rr - 1.0) * 4.0);
  // never draw sub-1.5px points (they shimmer); conserve energy instead
  if (sizePx < 1.5) { a *= (sizePx / 1.5) * (sizePx / 1.5); sizePx = 1.5; }
  gl_PointSize = sizePx;
  vA = a;
  vHi = step(1.5, aData.x);
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(s, 1.0)).xy, 0.0, 1.0);
}
`;

const PARTICLE_FRAG = /* glsl */ `
in float vA;
in float vHi;
in float vNear;
out vec4 finalColor;
uniform vec3 uSmoke;
uniform vec3 uSmokeHi;
uniform vec3 uRimTint;
uniform float uGain;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  float f = exp(-r * r * 3.0) * step(r, 1.0);
  vec3 base = mix(uSmoke, uSmokeHi, 0.35 + 0.65 * vHi);
  base = mix(base * vec3(1.05, 0.85, 0.6), base, vNear);
  base = mix(base, mix(uRimTint, vec3(0.75, 0.72, 0.9), 0.5), vNear * 0.8);   // picks up the orb's colour close to it
  vec3 col = base * f * vA * uGain;
  finalColor = vec4(col, 0.0);
}
`;

const ORB_FRAG = /* glsl */ `
in vec2 vUV;
out vec4 finalColor;
uniform float uT;
uniform float uBob;
uniform float uW;
uniform float uH;
uniform float uFocal;
uniform float uD;
uniform vec3 uCore;
uniform vec3 uRim;
uniform vec3 uHalo;
${SIMPLEX3}
#define TAU 6.28318530718
void main() {
  vec2 px = vUV * vec2(uW, uH);
  vec3 dir = normalize(vec3((px.x - uW * 0.5) / (uFocal * uH), -(px.y - uH * 0.5) / (uFocal * uH), -1.0));
  vec3 C = vec3(0.0, 0.0, uD);
  vec3 S = vec3(0.0, uBob, 0.0);
  vec3 oc = C - S;
  float b = dot(oc, dir);
  float c = dot(oc, oc) - 1.0;
  float disc = b * b - c;
  // distance of the ray from the centre, in sphere radii
  float dr = sqrt(max(dot(oc, oc) - b * b, 0.0));
  vec3 col = vec3(0.0);
  vec3 T = 0.5 * vec3(cos(TAU * uT), sin(TAU * uT), 0.0);
  if (disc > 0.0) {
    float t = -b - sqrt(disc);
    vec3 n = normalize(C + dir * t - S);
    float mu = max(dot(n, -dir), 0.0);
    // gaseous surface: slow noise sampled on a time circle
    float g = 0.5 * snoise(n * 2.2 + T) + 0.25 * snoise(n * 4.7 - T * 1.3) + 0.125 * snoise(vec3(n.x * 9.0, n.y * 3.0, n.z * 9.0) + T);
    float fres = pow(1.0 - mu, 1.6);
    // marbled gas: white with lavender / pale-blue streaks, a cool lower-left rim, warm touches
    vec3 nd = vec3(0.7071 * (n.x + n.y), 0.7071 * (n.y - n.x), n.z);   // diagonal streaks
    float marb = snoise(vec3(nd.x * 1.8 + g * 1.2, nd.y * 9.0, nd.z * 1.8) - T);
    vec3 base = mix(uCore, mix(uRim, vec3(0.62, 0.72, 1.0), 0.75), smoothstep(0.0, 0.9, marb) * 0.42);
    col = mix(base * 0.85, uRim * 1.0, fres);
    col *= 0.82 + 0.36 * g;
    float lowerLeft = clamp(dot(n.xy, normalize(vec2(-0.7, -0.7))), 0.0, 1.0);
    col = mix(col, vec3(0.45, 0.5, 1.0) * 1.2, pow(1.0 - mu, 2.5) * lowerLeft * 0.7);
    col = mix(col, vec3(1.0, 0.62, 0.45), smoothstep(0.55, 0.9, snoise(n * 1.7 + 9.0)) * pow(1.0 - mu, 2.0) * 0.5);
    col += uRim * pow(1.0 - mu, 4.0) * 1.4;
    // soft antialiased limb
    col *= smoothstep(0.0, 0.07, disc);
  }
  // halo: bright near the limb, wide soft tail, forced to exactly zero well inside the frame
  float o = max(dr - 1.0, 0.0);
  // lopsided bloom: strongest toward the upper right
  vec2 sp = vec2(px.x - uW * 0.5, -(px.y - uH * 0.5));
  float dirK = 0.55 + 0.75 * max(dot(normalize(sp + 1e-4), normalize(vec2(0.75, 0.6))), 0.0);
  float halo = (exp(-o * 9.0) * 1.4 + exp(-o * 3.5) * 0.14 * dirK) * dirK;
  halo *= 1.0 - smoothstep(0.8, 1.4, o);
  // coloured edge light: blue-violet on the right / lower right, a cool crescent below, warm on the left
  vec2 dn = normalize(sp + 1e-4);
  vec3 hc = uHalo;
  hc = mix(hc, vec3(0.55, 0.45, 1.0), clamp(dot(dn, vec2(0.85, -0.5)), 0.0, 1.0) * 0.75);
  hc = mix(hc, vec3(0.6, 0.75, 1.0), clamp(-dn.y, 0.0, 1.0) * 0.4);
  hc = mix(hc, vec3(1.0, 0.6, 0.45), clamp(-dn.x, 0.0, 1.0) * 0.45);
  col += hc * halo * mix(1.0, 0.4, smoothstep(0.0, 0.07, disc));
  finalColor = vec4(col, 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uScene;
uniform float uFrame;
${FINISH}
${SHOULDER}
void main() {
  vec3 c = texture(uScene, vUV).rgb;
  c = shoulder(c);
  vec3 srgb = linearToSrgb(c);
  // grain fades to zero below ~3 % luminance; pure black stays exactly 0
  finalColor = vec4(finish(srgb, gl_FragCoord.xy, uFrame, 0.015, 0.03), 1.0);
}
`;

const makeFactory =
  (v: SmokeOrbVariant): PixiLookFactory =>
  (renderer: Renderer, W: number, H: number) => {
    const L = layout();
    const focal = 0.212 * Math.sqrt(CAM_D * CAM_D - 1); // orb radius ~0.21 of frame height
    const lin = (h: string) => new Float32Array(hexToLinear(h));

    const pos = new Float32Array(PARTICLES * 4);
    const posBuffer = new Buffer({ data: pos, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    const geometry = new Geometry({
      attributes: {
        aPos: { buffer: posBuffer, format: "float32x4" },
        aData: { buffer: L.pData, format: "float32x2" },
      },
      topology: "point-list",
    });
    const pUniforms = {
      uT: { value: 0, type: "f32" },
      uBob: { value: 0, type: "f32" },
      uW: { value: W, type: "f32" },
      uH: { value: H, type: "f32" },
      uFocal: { value: focal, type: "f32" },
      uD: { value: CAM_D, type: "f32" },
      uSmoke: { value: lin(v.smoke), type: "vec3<f32>" },
      uSmokeHi: { value: lin(v.smokeHighlight), type: "vec3<f32>" },
      uGain: { value: 0.13, type: "f32" },
      uRimTint: { value: lin(v.rim), type: "vec3<f32>" },
    };
    const pShader = Shader.from({ gl: { vertex: PARTICLE_VERT, fragment: PARTICLE_FRAG }, resources: { pU: pUniforms } });
    const particles = new Mesh({ geometry: geometry as never, shader: pShader as never });
    particles.blendMode = "add";

    const orb = makeQuad(W, H, ORB_FRAG, {
      oU: {
        uT: { value: 0, type: "f32" },
        uBob: { value: 0, type: "f32" },
        uW: { value: W, type: "f32" },
        uH: { value: H, type: "f32" },
        uFocal: { value: focal, type: "f32" },
        uD: { value: CAM_D, type: "f32" },
        uCore: { value: lin(v.core), type: "vec3<f32>" },
        uRim: { value: lin(v.rim), type: "vec3<f32>" },
        uHalo: { value: lin(v.halo), type: "vec3<f32>" },
      },
    });

    const rtScene = makeHdrTarget(W, H);
    const final = makeQuad(W, H, FINAL_FRAG, { uScene: rtScene.source, fU: { uFrame: { value: 0, type: "f32" } } });

    type U = { uniforms: Record<string, number> };
    const pu = (pShader.resources.pU as U).uniforms;
    const ou = (orb.shader!.resources.oU as U).uniforms;
    const fu = (final.shader!.resources.fU as U).uniforms;

    return {
      render: (frame: number) => {
        const t = loopPhase(frame);
        const bob = 0.05 * Math.sin(TAU * t);
        // each particle slides along its streamline: a periodic function of t (never accumulated);
        // it fades in and out at the ends of the line, so the wrap is invisible
        const { lines, pLine, pOff, pCyc, pJit } = L;
        for (let i = 0; i < PARTICLES; i++) {
          const s = (pOff[i] + pCyc[i] * t) % 1;
          const f = s * (STEPS - 1);
          const k = Math.min(STEPS - 2, Math.floor(f));
          const w = f - k;
          const b0 = (pLine[i] * STEPS + k) * 3;
          const j = i * 3;
          const o = i * 4;
          pos[o] = lines[b0] + (lines[b0 + 3] - lines[b0]) * w + pJit[j];
          pos[o + 1] = lines[b0 + 1] + (lines[b0 + 4] - lines[b0 + 1]) * w + pJit[j + 1];
          pos[o + 2] = lines[b0 + 2] + (lines[b0 + 5] - lines[b0 + 2]) * w + pJit[j + 2];
          pos[o + 3] = Math.pow(Math.sin(Math.PI * s), 0.8);
        }
        posBuffer.update();
        pu.uT = t;
        pu.uBob = bob;
        ou.uT = t;
        ou.uBob = bob;
        fu.uFrame = grainFrame(frame);
        renderer.render({ container: orb, target: rtScene, clear: true, clearColor: [0, 0, 0, 1] });
        renderer.render({ container: particles, target: rtScene, clear: false });
        renderer.render({ container: final, clear: true });
      },
      destroy: () => {
        rtScene.destroy(true);
        particles.destroy();
        orb.destroy();
        final.destroy();
      },
    };
  };

export const SmokeOrb: React.FC<{ variant: SmokeOrbVariant; loopCheck?: boolean }> = ({ variant }) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const create = useCallback(makeFactory(variant), [variant.id]);
  return <PixiLook create={create} background="#000" />;
};
