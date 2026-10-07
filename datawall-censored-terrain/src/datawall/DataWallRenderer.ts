import * as THREE from "three";
import { hexLinear, type RGB } from "../lib/color";
import { PostPipeline, planeDepthAtNdc, viewPlane } from "../lib/post";
import { HASH, HEADER } from "../lib/shaders";
import type { LookRenderer } from "../lib/Stage";
import type { DataWallVersion } from "../versions";
import { ATLAS_COLS, ATLAS_ROWS, GLYPH_CONTENT, GLYPH_TABLE, makeGlyphAtlas } from "./glyphs";
import { BLOCK_L, CAM, LOOP_FRAMES, STACK_H, TOP_STACK, buildTemplate, cameraPose, visibleBounds } from "./layout";

// ---------------------------------------------------------------- instance data (module level)
const MAX_DIST = 140;
const bounds = visibleBounds(16 / 9, MAX_DIST);
// Stacks from the lowest visible one up to the top of the wall (stack 0), each with its own
// template, copied every BLOCK_L along x across the region the camera sees during the loop.
const J0 = Math.floor(bounds.y0 / STACK_H) - 1;
const J1 = Math.min(TOP_STACK, Math.ceil(bounds.y1 / STACK_H));
const TEMPLATES = Array.from({ length: J1 - J0 + 1 }, (_, i) => ({ j: J0 + i, tpl: buildTemplate(J0 + i) }));
const K0 = Math.floor((bounds.x0 - 25) / BLOCK_L) - 1;
const K1 = Math.ceil((bounds.x1 + 25) / BLOCK_L) + 1;

const buildInstances = () => {
  const rect: number[] = [];
  const a: number[] = [];
  const b: number[] = [];
  const nb: number[] = [];
  for (const { j, tpl } of TEMPLATES) {
    const dy = j * STACK_H;
    for (let k = K0; k <= K1; k++) {
      const dx = k * BLOCK_L;
      for (const e of tpl.elements) {
        const x = e.x + dx;
        const y = e.y + dy;
        if (x + e.w < bounds.x0 || x > bounds.x1 || y + e.h < bounds.y0 || y > bounds.y1) continue;
        rect.push(x, y, e.w, e.h);
        a.push(e.kind, e.seed, e.base, e.rateA);
        b.push(e.rateB, e.phase, 0, 0);
        nb.push(...e.nb);
      }
    }
  }
  return {
    count: rect.length / 4,
    rect: new Float32Array(rect),
    a: new Float32Array(a),
    b: new Float32Array(b),
    nb: new Float32Array(nb),
  };
};
const INST = buildInstances();

const buildLines = () => {
  const pa: number[] = [];
  const pb: number[] = [];
  const t: number[] = [];
  for (const { j, tpl } of TEMPLATES) {
    const dy = j * STACK_H;
    for (let k = K0; k <= K1; k++) {
      const dx = k * BLOCK_L;
      for (const l of tpl.lines) {
        pa.push(l.a[0] + dx, l.a[1] + dy, l.a[2]);
        pb.push(l.b[0] + dx, l.b[1] + dy, l.b[2]);
        t.push(l.rate, l.phase, l.delay, l.seed % 97);
      }
    }
  }
  return { count: pa.length / 3, a: new Float32Array(pa), b: new Float32Array(pb), t: new Float32Array(t) };
};
const LINES = buildLines();

// ---------------------------------------------------------------- shaders
const COMMON = /* glsl */ `
uniform float uFrame;      // frame % 600
uniform vec3 uCamPos;
uniform float uPixelAngle; // world size of one pixel at distance 1
uniform float uFogStart;
uniform float uFogLen;
uniform float uGlyphTable[${GLYPH_TABLE.length}];
${HASH}

// Glow block state with a 4-frame fade between slots. k slots per loop, pOn in %.
float glowState(float seed, float k, float phase, float pOn) {
  float s = fract(uFrame / ${LOOP_FRAMES}.0 + phase) * k;
  float slot = floor(s);
  float into = (s - slot) * ${LOOP_FRAMES}.0 / k;
  float prevSlot = mod(slot - 1.0 + k, k);
  float cur = step(hash2u(uint(seed), uint(slot)) * 100.0, pOn);
  float prev = step(hash2u(uint(seed), uint(prevSlot)) * 100.0, pOn);
  return mix(prev, cur, clamp(into / 4.0, 0.0, 1.0));
}
`;

const EL_VERT = /* glsl */ `${HEADER}
in vec3 position;
in vec4 iRect;
in vec4 iA;   // kind, seed, base, rateA
in vec4 iB;   // rateB, phase, -, -
in vec4 iNb;  // neighbour glow: seed, rate, phase, pOn
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
${COMMON}
out vec2 vLocal;
flat out vec2 vSize;
flat out float vKind;
flat out float vGlyph;
flat out float vBright;
flat out float vFog;

void main() {
  float kind = iA.x;
  uint seed = uint(iA.y);
  float base = iA.z;
  float rateA = iA.w;
  float rateB = iB.x;
  float phase = iB.y;
  float u = fract(uFrame / ${LOOP_FRAMES}.0 + phase);

  float bright = base;
  float glyph = 0.0;
  if (kind < 0.5) {
    // glyph: changes character rateA times per loop, flickers on rateB slots
    float cs = floor(u * rateA);
    glyph = uGlyphTable[int(float(${GLYPH_TABLE.length}) * hash2u(seed, uint(cs) + 17u))];
    float fs = floor(u * rateB);
    float fl = hash2u(seed, uint(fs) + 911u);
    bright *= fl < 0.14 ? 0.12 : (fl < 0.3 ? 0.6 : 1.0);
  } else if (kind < 1.5) {
    // bar: slow brightness drift + occasional steps
    bright *= 0.78 + 0.22 * sin(6.2831853 * (u * rateA));
    float st = hash2u(seed, uint(floor(u * rateB)) + 301u);
    bright *= st < 0.18 ? 0.45 : (st > 0.9 ? 1.35 : 1.0);
  } else if (kind < 2.5) {
    float st = hash2u(seed, uint(floor(u * rateB)) + 77u);
    bright *= st < 0.2 ? 0.35 : 1.0;
  } else if (kind < 3.5) {
    bright = base > 0.5 ? glowState(iA.y, rateA, phase, rateB) : 0.0;
    bright = max(bright, 0.001);
  }
  // Rows around a lit glow block dim a little.
  if (iNb.w > 0.5) bright *= 1.0 - 0.35 * glowState(iNb.x, iNb.y, iNb.z, iNb.w);

  // Conservative expansion (about one pixel) so sub-pixel elements are still rasterised;
  // the fragment shader integrates the true rectangle over the pixel footprint.
  vec3 center = vec3(iRect.xy + iRect.zw * 0.5, 0.0);
  vec3 toC = center - uCamPos;
  float dist = length(toC);
  float graze = max(abs(toC.z) / dist, 0.2);
  float m = dist * uPixelAngle * 1.25 / graze;
  vec2 size = iRect.zw;
  vec2 local = position.xy * (size + 2.0 * m) - m;
  vec3 world = vec3(iRect.xy + local, 0.002);
  vLocal = local;
  vSize = size;
  vKind = kind;
  vGlyph = glyph;
  vBright = bright;
  vFog = exp(-max(dist - uFogStart, 0.0) / uFogLen);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const EL_FRAG = /* glsl */ `${HEADER}
in vec2 vLocal;
flat in vec2 vSize;
flat in float vKind;
flat in float vGlyph;
flat in float vBright;
flat in float vFog;
uniform sampler2D tAtlas;
uniform vec3 cDim;
uniform vec3 cBright;
uniform vec3 cGlow;
uniform float glowGain;
uniform float elemGain;
out vec4 outColor;

float cover1(float x, float w, float fw) {
  fw = max(fw, 1e-6);
  float a = clamp(x - 0.5 * fw, 0.0, w);
  float b = clamp(x + 0.5 * fw, 0.0, w);
  return (b - a) / fw;
}

void main() {
  vec2 fw = fwidth(vLocal);
  float cov = cover1(vLocal.x, vSize.x, fw.x) * cover1(vLocal.y, vSize.y, fw.y);
  if (cov <= 0.0 || vBright <= 0.0) discard;
  vec3 col;
  if (vKind < 0.5) {
    vec2 g = clamp(vLocal / vSize, 0.0, 1.0);
    float gi = floor(vGlyph);
    float cx = mod(gi, ${ATLAS_COLS}.0);
    float cy = floor(gi / ${ATLAS_COLS}.0);
    vec2 uv = vec2(
      (cx + ${GLYPH_CONTENT.u0} + g.x * ${GLYPH_CONTENT.du}) / ${ATLAS_COLS}.0,
      1.0 - (cy + ${GLYPH_CONTENT.v0} + (1.0 - g.y) * ${GLYPH_CONTENT.dv}) / ${ATLAS_ROWS}.0
    );
    float t = texture(tAtlas, uv).r;
    col = mix(cDim, cBright, vBright) * vBright * t * elemGain * 1.4;
  } else if (vKind > 2.5 && vKind < 3.5) {
    col = mix(cDim * 0.006, cGlow * glowGain, vBright);
  } else {
    col = mix(cDim, cBright, clamp(vBright, 0.0, 1.0)) * vBright * elemGain;
  }
  outColor = vec4(col * cov * vFog, 1.0);
}
`;

const LINE_VERT = /* glsl */ `${HEADER}
in vec3 position;   // x: 0..1 along, y: -1..1 across
in vec3 iA;
in vec3 iB;
in vec4 iT;         // rate, phase, delay, -
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform vec2 uRes;
uniform float uWidthPx;
${COMMON}
out float vAlpha;
out float vAcross;
flat out float vWidth;
void main() {
  float rate = iT.x;
  float cycle = ${LOOP_FRAMES}.0 / rate;
  float c = fract(uFrame / ${LOOP_FRAMES}.0 + iT.y) * cycle - iT.z;
  float grow = smoothstep(0.0, 1.0, clamp(c / 15.0, 0.0, 1.0));
  float fade = 1.0 - clamp((c - 62.0) / 16.0, 0.0, 1.0);
  float alive = (c >= 0.0 && c < 78.0) ? 1.0 : 0.0;
  vec3 end = mix(iA, iB, grow);
  vec4 ca = projectionMatrix * viewMatrix * vec4(iA, 1.0);
  vec4 cb = projectionMatrix * viewMatrix * vec4(end, 1.0);
  vec2 sa = ca.xy / ca.w * uRes * 0.5;
  vec2 sb = cb.xy / cb.w * uRes * 0.5;
  vec2 dir = sb - sa;
  float len = max(length(dir), 1e-4);
  vec2 n = vec2(-dir.y, dir.x) / len;
  float w = max(uWidthPx, 1.0);
  vWidth = w;
  vec4 cp = mix(ca, cb, position.x);
  cp.xy += n * position.y * (w * 0.5 + 1.0) / (uRes * 0.5) * cp.w;
  vAcross = position.y * (w * 0.5 + 1.0);
  float dist = length(mix(iA, end, position.x) - uCamPos);
  vAlpha = alive * fade * (uWidthPx / w) * exp(-max(dist - uFogStart, 0.0) / uFogLen) * step(0.001, grow);
  gl_Position = cp;
}
`;

const LINE_FRAG = /* glsl */ `${HEADER}
in float vAlpha;
in float vAcross;
flat in float vWidth;
uniform vec3 cLine;
out vec4 outColor;
void main() {
  float a = clamp(vWidth * 0.5 + 0.5 - abs(vAcross), 0.0, 1.0);
  outColor = vec4(cLine * a * vAlpha, 1.0);
}
`;

const WALL_VERT = /* glsl */ `${HEADER}
in vec3 position;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 modelMatrix;
out vec3 vWorld;
void main() {
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const WALL_FRAG = /* glsl */ `${HEADER}
in vec3 vWorld;
uniform vec3 cWall;
uniform vec3 uCamPos;
uniform float uFogStart;
uniform float uFogLen;
out vec4 outColor;
void main() {
  float dist = length(vWorld - uCamPos);
  float fog = exp(-max(dist - uFogStart, 0.0) / uFogLen);
  outColor = vec4(cWall * (0.55 + 0.45 * fog), 1.0);
}
`;

// ---------------------------------------------------------------- renderer
export class DataWallRenderer implements LookRenderer {
  private post: PostPipeline;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(CAM.fov, 16 / 9, 0.2, 400);
  private atlas = makeGlyphAtlas();
  private common: Record<string, THREE.IUniform>;
  private lineUniforms: Record<string, THREE.IUniform>;
  private w = 1;
  private h = 1;
  private bg: RGB;

  constructor(
    gl: THREE.WebGLRenderer,
    private v: DataWallVersion,
  ) {
    this.post = new PostPipeline(gl);
    this.bg = hexLinear(v.background);
    this.common = {
      uFrame: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uPixelAngle: { value: 0.001 },
      uFogStart: { value: 36 },
      uFogLen: { value: 45 },
      uGlyphTable: { value: GLYPH_TABLE.slice() },
    };

    // Wall background plane.
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(bounds.x1 - bounds.x0 + 400, bounds.y1 - bounds.y0 + 400),
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: WALL_VERT,
        fragmentShader: WALL_FRAG,
        uniforms: { ...this.common, cWall: { value: new THREE.Vector3(...hexLinear(v.wall)) } },
      }),
    );
    wall.position.set((bounds.x0 + bounds.x1) / 2, (bounds.y0 + bounds.y1) / 2, 0);
    wall.frustumCulled = false;
    wall.renderOrder = 0;
    this.scene.add(wall);

    // Instanced wall elements.
    const quad = new THREE.InstancedBufferGeometry();
    quad.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3),
    );
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    quad.setAttribute("iRect", new THREE.InstancedBufferAttribute(INST.rect, 4));
    quad.setAttribute("iA", new THREE.InstancedBufferAttribute(INST.a, 4));
    quad.setAttribute("iB", new THREE.InstancedBufferAttribute(INST.b, 4));
    quad.setAttribute("iNb", new THREE.InstancedBufferAttribute(INST.nb, 4));
    quad.instanceCount = INST.count;
    const elems = new THREE.Mesh(
      quad,
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: EL_VERT,
        fragmentShader: EL_FRAG,
        uniforms: {
          ...this.common,
          tAtlas: { value: this.atlas },
          cDim: { value: new THREE.Vector3(...hexLinear(v.glyphDim)) },
          cBright: { value: new THREE.Vector3(...hexLinear(v.glyphBright)) },
          cGlow: { value: new THREE.Vector3(...hexLinear(v.glow)) },
          glowGain: { value: v.glowGain },
          elemGain: { value: v.elementGain },
        },
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    elems.frustumCulled = false;
    elems.renderOrder = 1;
    this.scene.add(elems);

    // Network lines.
    const lq = new THREE.InstancedBufferGeometry();
    lq.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3),
    );
    lq.setIndex([0, 1, 2, 0, 2, 3]);
    lq.setAttribute("iA", new THREE.InstancedBufferAttribute(LINES.a, 3));
    lq.setAttribute("iB", new THREE.InstancedBufferAttribute(LINES.b, 3));
    lq.setAttribute("iT", new THREE.InstancedBufferAttribute(LINES.t, 4));
    lq.instanceCount = LINES.count;
    this.lineUniforms = {
      ...this.common,
      uRes: { value: new THREE.Vector2(1, 1) },
      uWidthPx: { value: 2 },
      cLine: { value: new THREE.Vector3(...hexLinear(v.line)).multiplyScalar(v.lineOpacity) },
    };
    const lines = new THREE.Mesh(
      lq,
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: LINE_VERT,
        fragmentShader: LINE_FRAG,
        uniforms: this.lineUniforms,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    lines.frustumCulled = false;
    lines.renderOrder = 2;
    this.scene.add(lines);
  }

  setSize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.post.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(frame: number) {
    const f = frame % LOOP_FRAMES;
    const cam = this.camera;
    cameraPose(f / LOOP_FRAMES, cam);
    const res = this.h / 2160; // 1.0 at 4K
    this.common.uFrame.value = f;
    this.common.uCamPos.value.copy(cam.position);
    this.common.uPixelAngle.value = (2 * Math.tan(THREE.MathUtils.degToRad(CAM.fov / 2))) / this.h;
    this.lineUniforms.uRes.value.set(this.w, this.h);
    this.lineUniforms.uWidthPx.value = 20 * res;

    this.post.renderScene(this.scene, cam, this.bg);

    // DoF: focus on the band through the middle of the frame (depth of the wall at frame centre).
    const plane = viewPlane(cam, new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0));
    const zf = planeDepthAtNdc(cam, plane, 0, 0.05);
    const dofTex = this.post.dof({
      camera: cam,
      planeView: plane,
      focusDepth: zf,
      cocK: this.v.dofStrength * this.h * zf,
      maxCoc: this.v.dofMax * this.h,
    });

    this.post.finish(dofTex, {
      bloomStrength: 0.2,
      bloomThreshold: 0.8,
      bloomKnee: 0.4,
      bloomRadius: 0.85,
      caEdge: 0.0015,
      rgbSplit: 0,
      gradeGain: this.v.gradeGain,
      gradeLift: this.v.gradeLift,
      exposure: 1,
      vignette: 0.65,
      grain: 0.015,
      grainFrame: f,
    });
  }

  dispose() {
    this.post.dispose();
    this.atlas.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}

export const DATAWALL_STATS = { instances: INST.count, lines: LINES.count };
