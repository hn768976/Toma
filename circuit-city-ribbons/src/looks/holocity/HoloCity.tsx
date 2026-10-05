import React from "react";
import * as THREE from "three";
import { GLStage, World } from "../../lib/GLStage";
import { Post } from "../../lib/post";
import { lin } from "../../lib/random";
import type { HoloVersion } from "../../versions";
import { CITY, TILE } from "./city";

/*
 * Holo City. The camera stays at z = 0 and the city tile scrolls toward it by
 * u * TILE, u = (frame % 600) / 600; elements wrap by their tower anchor into
 * [Z_MIN, Z_MIN + TILE). Fog hides the far wrap point, the near one is behind
 * the camera. Every animated term has a whole number of cycles per loop.
 */

export const HOLO_LOOP = 600;
const Z_MIN = -70;

const COMMON = /* glsl */ `
uniform float uU;
uniform float uFrame;
uniform float uTile;
uniform float uZMin;
uniform vec2 uRes;
uniform float uFocal;   // focal length in px
uniform float uFocus;   // focus distance
uniform float uAper;    // blur per unit (|d-F|/d), as a fraction of height
uniform float uMaxCoc;  // fraction of height
uniform float uFog;     // fog density
uniform float uMirror;  // 1 for the floor reflection pass
uniform vec3 uCol;
uniform vec3 uAccent;
const float TAU = 6.28318530718;
float wrapZ(float z) { return mod(z + uU * uTile - uZMin, uTile) + uZMin; }
float fogF(float d) { float k = d * uFog; return exp(-k * k); }
float cocPx(float d) {
  return min(uAper * uRes.y * abs(d - uFocus) / max(d, 0.1), uMaxCoc * uRes.y);
}
float h11(float x) { return fract(sin(x * 127.1 + 31.7) * 43758.5453); }
`;

// ---------------------------------------------------------------- points
const POINT_VERT = /* glsl */ `
${COMMON}
in float aAnchor;
in vec4 aInfo;
out vec3 vCol;
out vec2 vCenter;
out float vHs;
out float vBlur;
out float vHx;
void main() {
  vec3 p = position;
  p.z += wrapZ(aAnchor) - aAnchor;
  if (uMirror > 0.5) p.y = -p.y;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float d = -mv.z;
  vec4 clip = projectionMatrix * mv;
  gl_Position = clip;
  if (d < 0.2) { gl_PointSize = 0.0; vCol = vec3(0.0); return; }
  float sharp = 0.07 * uFocal / d;
  float coc = cocPx(d) + uMirror * 3.0 * uRes.y / 720.0;
  float sz = sqrt(sharp * sharp + coc * coc);
  float hs = max(sz * 0.5, 0.5);
  // horizontal smear: speed-streaked, wider than tall
  float smear = 1.0 + 0.4 * coc / max(sz, 1e-3);
  float hx = hs * smear;
  float energy = min(sharp * sharp, 4.0 * hs * hs) / (4.0 * hs * hx);
  vHs = hs;
  vHx = hx;
  vBlur = clamp(coc / max(sz, 1e-3) * 1.4, 0.0, 1.0);
  gl_PointSize = 2.0 * hx + 2.0;
  vCenter = (clip.xy / clip.w * 0.5 + 0.5) * uRes;

  float seed = aInfo.x;
  float hf = aInfo.y;
  float kind = aInfo.w;
  // colour: teal accents low on the towers and on accent rows
  vec3 lime = uCol * vec3(1.3, 1.0, 0.45);
  vec3 col = mix(uAccent, mix(uCol, lime, smoothstep(0.35, 0.85, hf)), smoothstep(0.02, 0.45, hf));
  col = mix(col, uAccent, 0.5 * step(0.8, fract(seed * 13.0)) * (1.0 - smoothstep(0.1, 0.5, hf)));
  float b = aInfo.z * (0.9 + 0.5 * (1.0 - hf));
  // stacked ring bands: every few rows brighter, with darker rows between
  float row = floor(position.y / 0.35 + 0.5);
  b *= 0.55 + 0.9 * step(0.5, fract(row / 3.0 + seed * 3.0));
  if (kind > 1.5) { col = mix(col, uAccent, 0.7); b *= 1.6; }
  if (kind > 0.5 && kind < 1.5) {
    // windows flicker on a fixed schedule: 20-frame slots (30 per loop)
    float slot = floor(uFrame / 20.0);
    float on = step(0.55, h11(seed * 91.0 + float(gl_VertexID % 977) * 0.137 + slot * 3.71));
    b *= 1.0 + 3.0 * on;
    col = mix(col, vec3(1.0), 0.25 * on);
  }
  float fog = fogF(d);
  vCol = col * b * 1.3 * energy * fog * (uMirror > 0.5 ? 0.22 : 1.0);
}`;

const POINT_FRAG = /* glsl */ `
precision highp float;
in vec3 vCol;
in vec2 vCenter;
in float vHs;
in float vBlur;
in float vHx;
out vec4 outColor;
void main() {
  vec2 dp = gl_FragCoord.xy - vCenter;
  vec2 e = dp / vec2(vHx + 0.5, vHs + 0.5);
  // small dots round, large near dots blocky squares
  float rnd = clamp((1.0 - length(e)) * (vHs + 0.5), 0.0, 1.0) * 1.27;
  float box = clamp(vHx + 0.5 - abs(dp.x), 0.0, 1.0) * clamp(vHs + 0.5 - abs(dp.y), 0.0, 1.0);
  float sq = mix(rnd, box, smoothstep(1.5, 3.5, vHs));
  float soft = clamp(1.0 - dot(e, e), 0.0, 1.0);
  float cov = mix(sq, soft * soft * 2.2, vBlur);
  if (cov <= 0.0) discard;
  outColor = vec4(vCol * cov, 1.0);
}`;

// ---------------------------------------------------------------- lines
const LINE_VERT = /* glsl */ `
${COMMON}
in vec2 corner;      // x: 0..1 along, y: -1..1 across
in vec3 iA;
in vec3 iB;
in vec4 iP;          // anchor, kind, phase, intensity
in vec4 iE;          // kind specific
out vec3 vCol;
out float vAcross;   // px from centre line
out float vHalf;     // half width px
out float vAlong;
out float vBlur;
void main() {
  float kind = iP.y;
  vec3 a = iA;
  vec3 b = iB;
  float shift = wrapZ(iP.x) - iP.x;
  a.z += shift; b.z += shift;
  float inten = iP.w;
  vec3 col = uCol;
  float t = uU;
  float vis = 1.0;
  float along0 = 0.0, along1 = 1.0;
  if (kind > 0.5 && kind < 1.5) {        // base squares
    col = uAccent;
    inten *= 0.45;
  } else if (kind > 1.5 && kind < 2.5) { // scanning ring
    float f = fract(iP.z + iE.x * t);
    float y = f * iE.y;
    a.y = y; b.y = y;
    vis = smoothstep(0.0, 0.06, f) * pow(1.0 - f, 1.6);
    col = mix(uAccent, uCol * vec3(1.3, 1.0, 0.45), step(0.6, fract(iP.x * 0.37)));
    inten *= 3.5;
  } else if (kind < 0.5) {
    col = mix(uCol, uCol * vec3(1.3, 1.0, 0.45), 0.5);
  } else if (kind > 2.5) {               // crossing light line, draws on then fades
    float f = fract(iP.z + iE.x * t);
    float head = smoothstep(0.0, 0.5, f) * 1.25;
    along1 = min(head, 1.0);
    along0 = max(head - 1.0 / max(iE.y, 0.1) * 0.5, 0.0);
    vis = smoothstep(0.0, 0.05, f) * (1.0 - smoothstep(0.55, 0.95, f));
    col = mix(uCol, vec3(1.0), 0.5);
  }
  if (uMirror > 0.5) { a.y = -a.y; b.y = -b.y; }
  vec3 pa = mix(a, b, along0);
  vec3 pb = mix(a, b, along1);
  vec4 va = modelViewMatrix * vec4(pa, 1.0);
  vec4 vb = modelViewMatrix * vec4(pb, 1.0);
  // clip to the near plane in view space
  float nearZ = -0.15;
  if (va.z > nearZ && vb.z > nearZ) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vCol = vec3(0.0); return; }
  if (va.z > nearZ) va = mix(va, vb, (va.z - nearZ) / (va.z - vb.z));
  if (vb.z > nearZ) vb = mix(vb, va, (vb.z - nearZ) / (vb.z - va.z));
  vec4 ca = projectionMatrix * va;
  vec4 cb = projectionMatrix * vb;
  vec2 sa = ca.xy / ca.w * 0.5 * uRes;
  vec2 sb = cb.xy / cb.w * 0.5 * uRes;
  vec2 dir = sb - sa;
  float L = length(dir);
  dir = L > 1e-4 ? dir / L : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  vec4 cp = mix(ca, cb, corner.x);
  vec4 vp = mix(va, vb, corner.x);
  float d = max(-vp.z, 0.2);
  float sharp = max((kind > 1.5 && kind < 2.5 ? 0.05 : (kind < 0.5 ? 0.03 : 0.02)) * uFocal / d, 0.0);
  float coc = cocPx(d) + uMirror * 3.0 * uRes.y / 720.0;
  float w = sqrt(sharp * sharp + coc * coc);
  float hw = max(w * 0.5, 0.5);
  float energy = min(sharp, 2.0 * hw) / (2.0 * hw);
  float ext = hw + 1.5;
  vec2 off = nrm * corner.y * ext;
  // extend along to round off ends
  off += dir * (corner.x * 2.0 - 1.0) * 1.0;
  cp.xy += off / (0.5 * uRes) * cp.w;
  gl_Position = cp;
  vAcross = corner.y * ext;
  vHalf = hw;
  vAlong = mix(along0, along1, corner.x);
  vBlur = clamp(coc / max(w, 1e-3), 0.0, 1.0);
  float fog = fogF(d);
  vCol = col * inten * vis * energy * fog * (uMirror > 0.5 ? 0.25 : 1.0) * smoothstep(1.5, 4.5, d);
}`;

const LINE_FRAG = /* glsl */ `
precision highp float;
in vec3 vCol;
in float vAcross;
in float vHalf;
in float vAlong;
in float vBlur;
out vec4 outColor;
void main() {
  float x = abs(vAcross);
  float hard = clamp(vHalf + 0.5 - x, 0.0, 1.0);
  float soft = clamp(1.0 - x / (vHalf + 0.5), 0.0, 1.0);
  float cov = mix(hard, soft * 2.0 * soft, vBlur);
  if (cov <= 0.0) discard;
  outColor = vec4(vCol * cov, 1.0);
}`;

// ---------------------------------------------------------------- glass
const GLASS_VERT = /* glsl */ `
${COMMON}
in float aAnchor;
out vec3 vN;
out vec3 vV;
out float vFog;
out float vY;
void main() {
  vec3 p = position;
  p.z += wrapZ(aAnchor) - aAnchor;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vFog = fogF(-mv.z);
  vY = position.y;
  gl_Position = projectionMatrix * mv;
}`;
const GLASS_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uGlass;
in vec3 vN;
in vec3 vV;
in float vFog;
in float vY;
out vec4 outColor;
void main() {
  float fr = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  vec3 c = uGlass * (0.35 + 1.4 * fr * fr) * (0.7 + 0.5 * exp(-vY * 0.15));
  outColor = vec4(c * vFog, 1.0);
}`;

// ---------------------------------------------------------------- floor
const FLOOR_VERT = /* glsl */ `
out vec3 vW;
out float vD;
void main() {
  vW = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vD = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FLOOR_FRAG = /* glsl */ `
precision highp float;
uniform float uU;
uniform float uTile;
uniform float uFog;
uniform vec3 uFloor;
uniform vec3 uFogCol;
uniform vec3 uCol;
in vec3 vW;
in float vD;
out vec4 outColor;
float gridLine(vec2 p, float period, float width) {
  vec2 g = abs(fract(p / period - 0.5) - 0.5) * period;
  vec2 fw = fwidth(p);
  vec2 l = 1.0 - smoothstep(width - fw, width + fw, g);
  // fade when the grid gets finer than a few pixels (no aliasing)
  float fade = 1.0 - smoothstep(period * 0.15, period * 0.45, max(fw.x, fw.y));
  return max(l.x, l.y) * fade;
}
void main() {
  vec2 p = vec2(vW.x, vW.z - uU * uTile);
  float k = vD * uFog;
  float fog = exp(-k * k);
  float g1 = gridLine(p, 2.0, 0.012);
  float g2 = gridLine(p, 10.0, 0.03);
  vec3 c = uFloor + uCol * (g1 * 0.05 + g2 * 0.11) * fog;
  c = mix(uFogCol * 1.8, c, fog);
  // glossy: reflection shows through, more at grazing angles
  float alpha = mix(0.55, 0.85, smoothstep(5.0, 40.0, vD));
  outColor = vec4(c, alpha);
}`;

const BG_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uFogCol;
in vec2 vUv;
out vec4 outColor;
void main() {
  float h = vUv.y;
  vec3 c = uFogCol * mix(3.0, 1.1, smoothstep(0.3, 1.0, h));
  outColor = vec4(c, 1.0);
}`;
const BG_VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.9999, 1.0); }`;

// ---------------------------------------------------------------- world

const buildGlass = () => {
  const pos: number[] = [];
  const nrm: number[] = [];
  const anc: number[] = [];
  const geoms: THREE.BufferGeometry[] = [];
  for (const t of CITY.towers) {
    if (!t.glass) continue;
    const g = t.round
      ? new THREE.CylinderGeometry(t.w / 2 - 0.03, t.w / 2 - 0.03, t.h, 32, 1, true)
      : new THREE.BoxGeometry(t.w - 0.06, t.h, t.d - 0.06);
    g.translate(t.x, t.h / 2, t.z);
    const gi = g.index ? g.toNonIndexed() : g;
    const p = gi.getAttribute("position");
    const n = gi.getAttribute("normal");
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nrm.push(n.getX(i), n.getY(i), n.getZ(i));
      anc.push(t.z);
    }
    geoms.push(g, gi);
  }
  geoms.forEach((g) => g.dispose());
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  out.setAttribute("aAnchor", new THREE.Float32BufferAttribute(anc, 1));
  return out;
};

class HoloWorld implements World {
  post: Post;
  cam = new THREE.PerspectiveCamera(72, 16 / 9, 0.1, 200);
  sBg = new THREE.Scene();
  sRefl = new THREE.Scene();
  sFloor = new THREE.Scene();
  sMain = new THREE.Scene();
  shared: Record<string, THREE.IUniform>;
  mats: THREE.ShaderMaterial[] = [];
  geos: THREE.BufferGeometry[] = [];

  constructor(v: HoloVersion) {
    const v3 = (h: string) => new THREE.Vector3(...lin(h));
    this.shared = {
      uU: { value: 0 },
      uFrame: { value: 0 },
      uTile: { value: TILE },
      uZMin: { value: Z_MIN },
      uRes: { value: new THREE.Vector2(1280, 720) },
      uFocal: { value: 600 },
      uFocus: { value: 11 },
      uAper: { value: 0.003 },
      uMaxCoc: { value: 0.022 },
      uFog: { value: 0.03 },
      uCol: { value: v3(v.point) },
      uAccent: { value: v3(v.accent) },
      uGlass: { value: v3(v.glass).multiplyScalar(0.8) },
      uFloor: { value: v3(v.floor) },
      uFogCol: { value: v3(v.fog) },
    };
    const mk = (vs: string, fs: string, mirror: number, extra: Partial<THREE.ShaderMaterialParameters> = {}) => {
      const m = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: vs,
        fragmentShader: fs,
        uniforms: { ...this.shared, uMirror: { value: mirror } },
        depthTest: false,
        depthWrite: false,
        transparent: true,
        blending: THREE.AdditiveBlending,
        ...extra,
      });
      this.mats.push(m);
      return m;
    };

    // points
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(CITY.pPos, 3));
    pg.setAttribute("aAnchor", new THREE.BufferAttribute(CITY.pAnchor, 1));
    pg.setAttribute("aInfo", new THREE.BufferAttribute(CITY.pInfo, 4));
    this.geos.push(pg);
    const mkPoints = (mirror: number) => {
      const p = new THREE.Points(pg, mk(POINT_VERT, POINT_FRAG, mirror));
      p.frustumCulled = false;
      return p;
    };

    // lines (instanced quads)
    const lg = new THREE.InstancedBufferGeometry();
    lg.setAttribute(
      "corner",
      new THREE.BufferAttribute(new Float32Array([0, -1, 1, -1, 1, 1, 0, 1]), 2),
    );
    lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
    lg.setIndex([0, 1, 2, 0, 2, 3]);
    lg.setAttribute("iA", new THREE.InstancedBufferAttribute(CITY.lA, 3));
    lg.setAttribute("iB", new THREE.InstancedBufferAttribute(CITY.lB, 3));
    lg.setAttribute("iP", new THREE.InstancedBufferAttribute(CITY.lP, 4));
    lg.setAttribute("iE", new THREE.InstancedBufferAttribute(CITY.lE, 4));
    lg.instanceCount = CITY.nLines;
    this.geos.push(lg);
    const mkLines = (mirror: number) => {
      const l = new THREE.Mesh(lg, mk(LINE_VERT, LINE_FRAG, mirror));
      l.frustumCulled = false;
      return l;
    };

    // glass
    const gg = buildGlass();
    this.geos.push(gg);
    const glass = new THREE.Mesh(gg, mk(GLASS_VERT, GLASS_FRAG, 0, { side: THREE.DoubleSide }));
    glass.frustumCulled = false;

    // floor
    const fg = new THREE.PlaneGeometry(240, 240);
    fg.rotateX(-Math.PI / 2);
    fg.translate(0, 0, -100);
    this.geos.push(fg);
    const floor = new THREE.Mesh(
      fg,
      mk(FLOOR_VERT, FLOOR_FRAG, 0, { blending: THREE.NormalBlending }),
    );
    floor.frustumCulled = false;

    // background
    const bgG = new THREE.BufferGeometry();
    bgG.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.geos.push(bgG);
    const bg = new THREE.Mesh(bgG, mk(BG_VERT, BG_FRAG, 0, { blending: THREE.NoBlending, transparent: false }));
    bg.frustumCulled = false;

    this.sBg.add(bg);
    this.sRefl.add(mkLines(1), mkPoints(1));
    this.sFloor.add(floor);
    this.sMain.add(glass, mkLines(0), mkPoints(0));

    this.post = new Post({
      dof: false,
      maxCoc: 0,
      bloomStrength: 1.0,
      bloomSpread: 0.8,
      threshold: 0.2,
      knee: 0.25,
      exposure: 0.55,
      vignette: 0.35,
      grain: 0.02,
    });
  }

  render(gl: THREE.WebGLRenderer, frame: number) {
    const fm = ((frame % HOLO_LOOP) + HOLO_LOOP) % HOLO_LOOP;
    const u = fm / HOLO_LOOP;
    const TAU = Math.PI * 2;
    this.post.render(
      gl,
      (target) => {
        const W = target.width;
        const H = target.height;
        const s = this.shared;
        s.uU.value = u;
        s.uFrame.value = fm;
        s.uRes.value.set(W, H);
        const cam = this.cam;
        cam.aspect = W / H;
        cam.updateProjectionMatrix();
        s.uFocal.value = H / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
        // gentle sway, bank and tilt: whole cycles per loop
        const x = 0.3 * Math.sin(TAU * u) + 0.1 * Math.sin(TAU * 3 * u + 1.0);
        const y = 2.0 + 0.2 * Math.sin(TAU * 2 * u + 0.5);
        cam.position.set(x, y, 0);
        cam.rotation.set(0, 0, 0, "YXZ");
        cam.rotation.y = -0.05 * Math.sin(TAU * u + 0.6);
        cam.rotation.x = 0.22 + 0.03 * Math.sin(TAU * 2 * u + 2.0);
        cam.rotation.z = 0.035 * Math.sin(TAU * u + 0.3);
        cam.updateMatrixWorld(true);

        gl.setRenderTarget(target);
        gl.setClearColor(0x000000, 1);
        gl.clear(true, true, false);
        gl.render(this.sBg, cam);
        gl.render(this.sRefl, cam);
        gl.render(this.sFloor, cam);
        gl.render(this.sMain, cam);
      },
      fm,
    );
  }

  dispose() {
    this.post.dispose();
    this.mats.forEach((m) => m.dispose());
    this.geos.forEach((g) => g.dispose());
  }
}

export const HoloCity: React.FC<{ version: HoloVersion }> = ({ version }) => (
  <GLStage create={() => new HoloWorld(version)} deps={[version]} />
);

export const HOLO_STATS = { points: CITY.nPoints, lines: CITY.nLines, towers: CITY.towers.length };
