import * as THREE from "three";
import { phase, TAU } from "../lib/constants";
import { PostPipeline } from "../lib/post";
import type { Look } from "../lib/Stage";
import { BAR_RINGS, buildBlocks, buildPoints, R, SEG_TEX_W, segData } from "./structure";

export type RingPalette = {
  glass: string;
  edge: string;
  points: [string, string, string, string];
  background: string;
};

/** Camera preset: the only thing that differs between the four angles. */
export type RingCamera = {
  elevationDeg: number;
  azimuthDeg: number;
  distance: number; // in units of R
  target: [number, number, number]; // in units of R
  fovDeg: number;
  rollDeg: number;
  focusPoint: [number, number, number]; // in units of R
  aperture: number;
  maxCoc: number;
  pushIn: number; // fractional push-in and back over the loop
  driftDeg: number; // azimuth drift amplitude (closed)
  orbitDeg: number; // orbit out-and-back (cosine), 0 = none
  shiftX: number; // lens shift, fraction of frame width (+ = centre moves right)
  shiftY: number; // lens shift, fraction of frame height (+ = centre moves down)
  pointCoc: number; // max bokeh size for points, relative to maxCoc
};

export type RingsParams = { palette: RingPalette; camera: RingCamera };

const BLOCK_VERT = /* glsl */ `
precision highp float;
precision highp sampler2D;
in vec3 position;
in vec3 normal;
in vec4 iA; // rIn, rOut, angle0, width
in vec4 iB; // ring, seg, cell, cells
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform sampler2D segTex;
uniform float loopPhase;
uniform vec4 ringShift;  // segment periods per loop
uniform vec4 ringSegs;
uniform vec4 ringMean;
out vec3 vLocal;
out vec3 vScale;
out vec3 vN;
out vec3 vWorld;
out float vViewZ;
out float vRing;
const float TAU = 6.283185307;

float segValue(int ring, int seg, out float slope) {
  vec4 d = texelFetch(segTex, ivec2(seg, ring), 0);
  slope = d.w;
  return d.x + d.y * sin(TAU * loopPhase + d.z) + 0.35 * d.y * sin(2.0 * TAU * loopPhase + 1.7 * d.z);
}

void main() {
  int ring = int(iB.x + 0.5);
  int seg = int(iB.y + 0.5);
  float segs = ringSegs[ring];
  float shift = ringShift[ring];
  // Bars ride with the ring; over the loop each segment's values blend into
  // those of the segment 'shift' ahead, so after one loop (ring turned by
  // exactly 'shift' segments) the structure is identical to frame 0.
  int segJ = int(mod(float(seg) + shift, segs));
  float w = smoothstep(0.0, 1.0, loopPhase);
  float cw = cos(w * 1.5707963), sw = sin(w * 1.5707963);
  float sl0, sl1;
  float h0 = segValue(ring, seg, sl0);
  float h1 = segValue(ring, segJ, sl1);
  float mean = ringMean[ring];
  float h = mean + cw * (h0 - mean) + sw * (h1 - mean);
  float slope = (cw * sl0 + sw * sl1) / (cw + sw);
  float cellT = (iB.z + 0.5) / iB.w;
  h *= clamp(1.0 + slope * (cellT - 0.5), 0.15, 2.0);
  // HUD bands may drop to nothing (notches); bars keep a sliver.
  h = ring >= 2 ? (h < 0.012 ? 0.0 : h) : max(h, 0.015);

  float ang = iA.z + shift * (TAU / segs) * loopPhase;
  vec3 er = vec3(cos(ang), 0.0, sin(ang));
  vec3 et = vec3(-sin(ang), 0.0, cos(ang));
  float rMid = 0.5 * (iA.x + iA.y);
  float rLen = iA.y - iA.x;
  vec3 l = position; // box centred at 0, size 1
  vec3 wpos = er * (rMid + l.x * rLen) + et * (l.z * iA.w) + vec3(0.0, (l.y + 0.5) * h, 0.0);
  vLocal = l;
  vScale = vec3(rLen, h, iA.w);
  vN = normalize(er * normal.x + vec3(0.0, normal.y, 0.0) + et * normal.z);
  vWorld = wpos;
  vRing = float(ring);
  vec4 mv = viewMatrix * vec4(wpos, 1.0);
  vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const BLOCK_FRAG = /* glsl */ `
precision highp float;
in vec3 vLocal;
in vec3 vScale;
in vec3 vN;
in vec3 vWorld;
in float vViewZ;
in float vRing;
out vec4 outColor;
uniform vec3 cGlass;
uniform vec3 cEdge;
uniform vec3 camPos;
uniform float pxWorld; // world size of one pixel at view distance 1
void main() {
  // max(): with MSAA, edge pixels can be shaded slightly outside the face.
  vec3 d = max((0.5 - abs(vLocal)) * vScale, 0.0);
  // Per-axis edge glow. Radial edges (along the blade) and top edges read
  // as the fine lines of the reference; the cross-lines between radial cells
  // on the tops are kept faint.
  float wWorld = 0.008;
  float wPix = pxWorld * vViewZ * 1.2;
  float ww = max(wWorld, wPix);
  float k = wWorld / ww;
  vec3 g = exp(-d / ww) * k;
  vec3 an = abs(vLocal) * 2.0; // which face we are on (component ~1)
  float edge;
  if (an.y > 0.999) edge = max(g.x * 0.25, g.z);          // top / bottom
  else if (an.z > 0.999) edge = max(g.x * 0.6, g.y);      // segment sides
  else edge = max(g.z, g.y);                               // radial ends
  vec3 N = normalize(vN);
  vec3 V = normalize(camPos - vWorld);
  float fres = pow(clamp(1.0 - abs(dot(N, V)), 0.0, 1.0), 3.0);
  float top = step(0.5, N.y);
  float hgt = vLocal.y + 0.5; // 0 at the base, 1 at the top
  vec3 col = cGlass * (0.1 + 0.4 * fres) * (0.3 + 0.6 * hgt);
  // Lit tops: a soft glow toward the top face and on it.
  col += cEdge * (top * 0.02 + smoothstep(0.6, 1.0, hgt) * 0.015 * (1.0 - top));
  // Fine vertical line texture on the sides.
  col += cEdge * edge * (top > 0.5 ? 1.1 : 0.7) * (vRing < 0.5 ? 1.3 : 1.0);
  outColor = vec4(col * 0.6, vViewZ);
}
`;

const DISC_VERT = /* glsl */ `
precision highp float;
in vec3 position;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
out vec3 vWorld;
out float vViewZ;
void main() {
  vWorld = position;
  vec4 mv = viewMatrix * vec4(position, 1.0);
  vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const DISC_FRAG = /* glsl */ `
precision highp float;
in vec3 vWorld;
in float vViewZ;
out vec4 outColor;
uniform vec3 cGlass;
uniform vec3 cEdge;
uniform float R;
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
void main() {
  float r = length(vWorld.xz) / R;
  float a = atan(vWorld.z, vWorld.x) / 6.283185307 + 0.5;
  // Fine radial lines (720 around), anti-aliased with derivatives.
  float n = 720.0;
  float x = a * n;
  float fw = fwidth(x);
  float line = 1.0 - smoothstep(0.0, max(fw, 1e-4) * 1.5, abs(fract(x) - 0.5) - 0.35);
  line *= clamp(0.8 / max(fw, 0.2), 0.0, 1.0); // fade when lines get denser than pixels
  uint id = uint(floor(x));
  float lb = 0.3 + 0.7 * float(pcg(id) & 1023u) / 1023.0;
  // Brightest across the disc band 0.35..0.6R, dim elsewhere.
  float bandMask = smoothstep(0.33, 0.4, r) * smoothstep(0.62, 0.55, r);
  float plate = smoothstep(0.14, 0.16, r) * mix(0.35, 1.0, smoothstep(0.66, 0.6, r)) * smoothstep(0.95, 0.86, r);
  vec3 col = cGlass * (0.01 + 0.2 * bandMask) * plate;
  col += cEdge * line * lb * (0.012 + 0.04 * bandMask) * plate;
  // Soft radial glow outward from the well across the disc.
  col += cEdge * 0.025 * bandMask * smoothstep(0.6, 0.35, r);
  outColor = vec4(col * 0.35, vViewZ);
}
`;

const POINT_VERT = /* glsl */ `
precision highp float;
precision highp sampler2D;
in vec3 position; // unused (three requires it)
in vec4 pA; // r, angle0, y, speed
in vec4 pB; // phase offset, size, brightness, colour index
in vec4 pC; // kind, r1, twinkle cycles, -
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform float loopPhase;
uniform vec2 resolution;
uniform float projScale;   // pixels per world unit at view distance 1
uniform float focus;
uniform float aperture;
uniform float maxCoc;
uniform sampler2D sceneTex; // alpha = view depth of the blocks/disc
uniform vec3 pal[5];
uniform float gain;
out vec3 vCol;
out float vD;
out float vBokeh;
const float TAU = 6.283185307;
void main() {
  float kind = pC.x;
  float u = fract(loopPhase + pB.x);
  float env = 1.0;
  float r = pA.x;
  float ang = pA.y;
  if (kind < 0.5) {
    // Flow around the ring: whole life cycle per loop, so it closes exactly.
    ang += pA.w * (u - 0.5);
    env = smoothstep(0.0, 0.12, u) * smoothstep(1.0, 0.88, u);
  } else if (kind < 1.5) {
    r = mix(pA.x, pC.y, u);
    env = smoothstep(0.0, 0.15, u) * smoothstep(1.0, 0.8, u);
  } else {
    env = 0.8 + 0.2 * sin(TAU * pC.z * loopPhase + pB.x * TAU);
  }
  vec3 wpos = vec3(r * cos(ang), pA.z, r * sin(ang));
  vec4 mv = viewMatrix * vec4(wpos, 1.0);
  float z = -mv.z;
  vec4 clip = projectionMatrix * mv;
  gl_Position = clip;
  // Points that lie on a line: scale by how foreshortened the line is here,
  // so a ring seen edge-on does not pile up into a hot spot.
  float fore = 1.0;
  if (pC.w > 0.5) {
    vec3 dir = pC.w < 1.5 ? vec3(-sin(ang), 0.0, cos(ang)) : vec3(cos(ang), 0.0, sin(ang));
    vec4 c2 = projectionMatrix * (viewMatrix * vec4(wpos + dir * 0.01, 1.0));
    float projLen = length((c2.xy / c2.w - clip.xy / clip.w) * resolution * 0.5) / 0.01;
    fore = clamp(projLen / (projScale / max(-mv.z, 0.05)), 0.03, 1.0);
  }
  if (z < 0.05) { gl_PointSize = 0.0; vCol = vec3(0.0); vD = 1.0; vBokeh = 0.0; return; }
  float sizePx = max(pB.y * projScale / z, 1.0);
  float coc = min(aperture * abs(z - focus) / z, maxCoc) * resolution.y * 2.0; // diameter
  float D = max(sizePx, coc);
  float energy = (sizePx * sizePx) / (D * D);
  // Bokeh keeps a little more presence than pure energy conservation.
  energy = pow(energy, 0.8);
  // Soft occlusion by the blocks: compare with the scene depth at the centre.
  vec2 suv = clip.xy / clip.w * 0.5 + 0.5;
  float sz = textureLod(sceneTex, clamp(suv, 0.0, 1.0), 0.0).a;
  float occ = mix(1.0, 0.12, smoothstep(0.05, 0.4, z - sz));
  int ci = int(pB.w + 0.5);
  vCol = pal[ci] * pB.z * env * energy * occ * fore * gain;
  vD = min(D + 1.0, 400.0);
  vBokeh = smoothstep(4.0, 12.0, D);
  gl_PointSize = vD;
}
`;

const POINT_FRAG = /* glsl */ `
precision highp float;
in vec3 vCol;
in float vD;
in float vBokeh;
out vec4 outColor;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = length(q);
  float aa = 2.0 / vD;
  float disc = 1.0 - smoothstep(1.0 - aa * 1.5, 1.0, r);
  // Small points: a soft gaussian core. Bokeh: flat disc with a faint rim.
  float core = exp(-r * r * 3.0);
  float bokeh = disc * (0.85 + 0.3 * smoothstep(0.55, 0.95, r));
  float m = mix(core * disc * 1.6, bokeh, vBokeh);
  outColor = vec4(vCol * m, 0.0);
}
`;

const lin = (hex: string) => new THREE.Color(hex);

export const createRings = (params: RingsParams) => (gl: THREE.WebGLRenderer): Look => {
  void gl;
  const { palette, camera: cp } = params;
  const scene = new THREE.Scene();
  const pointsScene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(cp.fovDeg, 16 / 9, 0.1, 200);

  // Blocks
  const box = new THREE.BoxGeometry(1, 1, 1);
  const blocks = buildBlocks();
  const bgeo = new THREE.InstancedBufferGeometry();
  bgeo.index = box.index;
  bgeo.setAttribute("position", box.getAttribute("position"));
  bgeo.setAttribute("normal", box.getAttribute("normal"));
  bgeo.setAttribute("iA", new THREE.InstancedBufferAttribute(blocks.iA, 4));
  bgeo.setAttribute("iB", new THREE.InstancedBufferAttribute(blocks.iB, 4));
  bgeo.instanceCount = blocks.count;
  const segTex = new THREE.DataTexture(segData, SEG_TEX_W, BAR_RINGS.length, THREE.RGBAFormat, THREE.FloatType);
  segTex.needsUpdate = true;
  const common = {
    cGlass: { value: lin(palette.glass) },
    cEdge: { value: lin(palette.edge) },
    camPos: { value: new THREE.Vector3() },
  };
  const blockMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: BLOCK_VERT,
    fragmentShader: BLOCK_FRAG,
    uniforms: {
      ...common,
      segTex: { value: segTex },
      loopPhase: { value: 0 },
      ringShift: { value: new THREE.Vector4(...BAR_RINGS.map((r) => r.shift)) },
      ringSegs: { value: new THREE.Vector4(...BAR_RINGS.map((r) => r.segments)) },
      ringMean: { value: new THREE.Vector4(...BAR_RINGS.map((r) => r.meanHeight)) },
      pxWorld: { value: 0.001 },
    },
  });
  const blockMesh = new THREE.Mesh(bgeo, blockMat);
  blockMesh.frustumCulled = false;
  scene.add(blockMesh);

  // Disc / base plate with radial lines
  const discGeo = new THREE.RingGeometry(0.14 * R, 1.0 * R, 360, 8);
  discGeo.rotateX(-Math.PI / 2);
  const discMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: DISC_VERT,
    fragmentShader: DISC_FRAG,
    uniforms: { ...common, R: { value: R } },
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.frustumCulled = false;
  scene.add(disc);

  // Points
  const pts = buildPoints();
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts.count * 3), 3));
  pgeo.setAttribute("pA", new THREE.BufferAttribute(pts.a, 4));
  pgeo.setAttribute("pB", new THREE.BufferAttribute(pts.b, 4));
  pgeo.setAttribute("pC", new THREE.BufferAttribute(pts.c, 4));
  const pal = palette.points.map(lin);
  // Index 4: whitened first colour for the thin bright circles.
  pal.push(lin(palette.points[0]).lerp(new THREE.Color(1, 1, 1), 0.2));
  const pointMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
    uniforms: {
      loopPhase: { value: 0 },
      resolution: { value: new THREE.Vector2() },
      projScale: { value: 1 },
      focus: { value: 10 },
      aperture: { value: cp.aperture },
      maxCoc: { value: cp.maxCoc * cp.pointCoc },
      sceneTex: { value: null },
      pal: { value: pal },
      gain: { value: 1.3 },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  const points = new THREE.Points(pgeo, pointMat);
  points.frustumCulled = false;
  pointsScene.add(points);

  const post = new PostPipeline({ msaa: 4 });
  const bg = lin(palette.background);
  const v = (a: [number, number, number]) => new THREE.Vector3(a[0] * R, a[1] * R, a[2] * R);
  const target0 = v(cp.target);
  const focusPoint = v(cp.focusPoint);

  return {
    render(gl, frame, width, height) {
      const p = phase(frame);
      const t = p * TAU;
      post.setSize(width, height);

      // Camera: closed drift, push-in-and-back, optional out-and-back orbit.
      const orbit = THREE.MathUtils.degToRad(cp.orbitDeg) * (0.5 - 0.5 * Math.cos(t));
      const az = THREE.MathUtils.degToRad(cp.azimuthDeg + cp.driftDeg * Math.sin(t)) + orbit;
      const el = THREE.MathUtils.degToRad(cp.elevationDeg + 0.4 * cp.driftDeg * Math.sin(2 * t));
      const dist = cp.distance * R * (1 - cp.pushIn * (0.5 - 0.5 * Math.cos(t)));
      const target = target0.clone();
      cam.position.set(
        target.x + dist * Math.cos(el) * Math.sin(az),
        target.y + dist * Math.sin(el),
        target.z + dist * Math.cos(el) * Math.cos(az),
      );
      cam.up.set(0, 1, 0);
      cam.lookAt(target);
      cam.rotateZ(THREE.MathUtils.degToRad(cp.rollDeg));
      cam.fov = cp.fovDeg;
      cam.aspect = width / height;
      // Lens shift puts the ring centre off-centre like the references.
      cam.setViewOffset(width, height, -cp.shiftX * width, -cp.shiftY * height, width, height);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      common.camPos.value.copy(cam.position);

      const projScale = height / (2 * Math.tan(THREE.MathUtils.degToRad(cp.fovDeg) / 2));
      blockMat.uniforms.loopPhase.value = p;
      blockMat.uniforms.pxWorld.value = 1 / projScale;

      // Focus distance: along the view axis to the focus point.
      const fwd = new THREE.Vector3();
      cam.getWorldDirection(fwd);
      const focus = focusPoint.clone().sub(cam.position).dot(fwd);

      post.beginScene(gl, bg);
      gl.render(scene, cam);
      const dofRT = post.dof(gl, cam, {
        enabled: true,
        focus,
        aperture: cp.aperture,
        maxCoc: cp.maxCoc * 0.6,
        samples: 32,
      });
      // Points carry their own DoF; add them on top of the blurred blocks.
      const pu = pointMat.uniforms;
      pu.loopPhase.value = p;
      pu.resolution.value.set(width, height);
      pu.projScale.value = projScale;
      pu.focus.value = focus;
      pu.sceneTex.value = post.sceneRT.texture;
      gl.setRenderTarget(dofRT);
      gl.render(pointsScene, cam);

      post.finish(gl, dofRT, frame, {
        exposure: 0.8,
        bloomStrength: 0.55,
        bloomThreshold: 0.9,
        bloomRadius: 0.7,
        vignette: 0.6,
        fringe: 0.004,
        grain: 0.015,
        dither: true,
        saturation: 1.0,
      });
    },
    dispose() {
      box.dispose();
      bgeo.dispose();
      blockMat.dispose();
      segTex.dispose();
      discGeo.dispose();
      discMat.dispose();
      pgeo.dispose();
      pointMat.dispose();
      post.dispose();
    },
  };
};
