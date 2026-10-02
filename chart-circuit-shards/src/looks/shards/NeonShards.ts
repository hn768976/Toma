import * as THREE from 'three';
import { LookFactory } from '../../lib/ThreeStage';
import { ShardsVersion } from '../../versions';
import { Rng } from '../../lib/rng';
import { hexToLinear, mod, TAU } from '../../lib/math';
import { SpriteField } from '../../lib/sprites';

export const SHARDS_FRAMES = 600;

// Shards live in a depth block of length L that repeats along -z; the camera
// drifts exactly N_BLOCKS * L over the 600 frames. Every shard turns a whole
// number of times, so frame 600 == frame 0.
const L = 36;
const N_BLOCKS = 1;
const N_SHARDS = 80;
const COPIES = [-1, 0, 1, 2];
const SPREAD_X = 24;
const SPREAD_Y = 14;

type Shard = {
  center: THREE.Vector3;
  local: THREE.Vector3[]; // polyline vertices
  vBright: number[]; // per-vertex brightness (hot corners)
  closed: boolean;
  ext: number; // edges overshoot their vertices by this fraction
  axis: THREE.Vector3;
  phase: number;
  turns: number;
  bright: number;
  tone: number;
  hot: number; // index of the hottest vertex
  glow: number; // 0 = no glow sprite
};

const makeShards = (seed: number): Shard[] => {
  const rng = new Rng(seed);
  const out: Shard[] = [];
  for (let i = 0; i < N_SHARDS; i++) {
    const size = Math.exp(rng.range(Math.log(6), Math.log(22)));
    const r = rng.f();
    const kind = r < 0.4 ? 'tri' : r < 0.88 ? 'quad' : 'open';
    // thin, mostly planar shapes spread along a dominant direction
    const u = new THREE.Vector3(...rng.unitVec3());
    const w = new THREE.Vector3(...rng.unitVec3()).cross(u).normalize();
    const jitter = () => new THREE.Vector3(...rng.unitVec3()).multiplyScalar(size * 0.05);
    const P = (a: number, b: number) => u.clone().multiplyScalar(a * size).addScaledVector(w, b * size).add(jitter());
    let local: THREE.Vector3[];
    if (kind === 'quad') {
      // kite / slender parallelogram
      const lenA = rng.range(0.6, 1.0);
      const wid = rng.range(0.3, 0.7);
      const skew = rng.range(-0.3, 0.3);
      local = [P(-lenA / 2, 0), P(skew, -wid / 2), P(lenA / 2, 0), P(skew * rng.range(0.5, 1.5), wid / 2)];
    } else if (kind === 'tri') {
      local = [P(rng.range(-0.5, -0.2), rng.range(-0.1, 0.1)), P(rng.range(0.2, 0.5), rng.range(-0.2, 0.2)), P(rng.range(-0.3, 0.3), rng.range(0.1, 0.4) * rng.sign())];
    } else {
      const n = rng.int(3, 5); // 2-4 segments
      local = Array.from({ length: n }, () => P(rng.range(-0.5, 0.5), rng.range(-0.25, 0.25)));
    }
    const hot = rng.int(0, local.length - 1);
    const vBright = local.map((_, k) => (k === hot ? rng.range(1.4, 2.0) : rng.range(0.12, 0.6)));
    out.push({
      vBright,
      center: new THREE.Vector3(rng.range(-SPREAD_X, SPREAD_X), rng.range(-SPREAD_Y, SPREAD_Y), -rng.range(0, L)),
      local,
      closed: kind !== 'open',
      ext: rng.chance(0.5) ? rng.range(0.05, 0.3) : 0,
      axis: new THREE.Vector3(...rng.unitVec3()),
      phase: rng.range(0, TAU),
      turns: rng.sign() * (rng.chance(0.8) ? 1 : 2),
      bright: rng.range(0.3, 1.0),
      tone: rng.f(),
      hot,
      glow: rng.chance(0.4) ? rng.range(0.5, 1.0) : 0,
    });
  }
  return out;
};
const SHARDS = makeShards(33969592);
const segCount = (sh: Shard) => (sh.closed ? sh.local.length : sh.local.length - 1);
const SEGS_PER_COPY = SHARDS.reduce((s, sh) => s + segCount(sh), 0);
const GLOWS = SHARDS.filter((s) => s.glow > 0);

const LINE_VERT = /* glsl */ `
in vec3 aA;
in vec3 aB;
in vec2 aCorner;   // x: 0 = A end, 1 = B end; y: side -1/+1
in vec3 aParam;    // intensity at A, intensity at B, tone
uniform vec2 uViewport;
uniform float uBaseHalfPx, uFocus, uBlurK, uBlurNearK, uNear, uFarFade, uNearFade;
out float vAcrossW;
out float vAlongW;
out float vW;
out float vI;
out float vTone;
out float vHalf;
out float vLen;

void main() {
  vec4 a = viewMatrix * vec4(aA, 1.0);
  vec4 b = viewMatrix * vec4(aB, 1.0);
  float zn = -uNear;
  if (a.z > zn && b.z > zn) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (a.z > zn) a = mix(a, b, (zn - a.z) / (b.z - a.z));
  if (b.z > zn) b = mix(b, a, (zn - b.z) / (a.z - b.z));
  vec4 ca = projectionMatrix * a;
  vec4 cb = projectionMatrix * b;
  vec2 sa = ca.xy / ca.w * uViewport * 0.5;
  vec2 sb = cb.xy / cb.w * uViewport * 0.5;
  vec2 d = sb - sa;
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  bool atB = aCorner.x > 0.5;
  vec4 P = atB ? b : a;
  vec4 C = atB ? cb : ca;
  float z = -P.z;
  // defocus: CoC in pixels grows with |1 - focus/z|; width grows, energy is conserved
  // near shapes stay crisp, far ones go soft (as in the reference)
  float coc = (z > uFocus ? uBlurK * (1.0 - uFocus / z) : uBlurNearK * (uFocus / z - 1.0)) * uViewport.y;
  float half_ = uBaseHalfPx + coc;
  float energy = uBaseHalfPx / half_;
  float fade = (1.0 - smoothstep(uFarFade * 0.35, uFarFade, z)) * smoothstep(0.4, uNearFade, z);
  vec2 off = nrm * half_ * aCorner.y + dir * half_ * (atB ? 1.0 : -1.0);
  gl_Position = C + vec4(off / (uViewport * 0.5) * C.w, 0.0, 0.0);
  // screen-linear varyings via the w-trick (GLSL ES 3.0 has no noperspective)
  vW = C.w;
  vAcrossW = aCorner.y * C.w;
  vAlongW = (atB ? len + half_ : -half_) * C.w;
  vHalf = half_;
  vLen = len;
  vI = (atB ? aParam.y : aParam.x) * energy * fade;
  vTone = aParam.z;
}`;

const LINE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColA, uColB;
in float vAcrossW;
in float vAlongW;
in float vW;
in float vI;
in float vTone;
in float vHalf;
in float vLen;
out vec4 outColor;
void main() {
  float x = vAcrossW / vW;
  float s = vAlongW / vW;
  float across = exp(-x * x * 3.2);
  float ends = smoothstep(-vHalf, 0.0, s) * (1.0 - smoothstep(vLen, vLen + vHalf, s));
  vec3 col = mix(uColA, uColB, vTone);
  outColor = vec4(col * vI * across * ends, 1.0);
}`;

export const makeShardsFactory =
  (v: ShardsVersion): LookFactory =>
  () => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0, 0, 0);
    const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 300);

    const nSeg = SEGS_PER_COPY * COPIES.length;
    const aA = new Float32Array(nSeg * 4 * 3);
    const aB = new Float32Array(nSeg * 4 * 3);
    const aCorner = new Float32Array(nSeg * 4 * 2);
    const aParam = new Float32Array(nSeg * 4 * 3);
    const index: number[] = [];
    for (let s = 0; s < nSeg; s++) {
      const c = [0, -1, 0, 1, 1, 1, 1, -1];
      aCorner.set(c, s * 8);
      const b = s * 4;
      index.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const geo = new THREE.BufferGeometry();
    const attA = new THREE.BufferAttribute(aA, 3).setUsage(THREE.DynamicDrawUsage);
    const attB = new THREE.BufferAttribute(aB, 3).setUsage(THREE.DynamicDrawUsage);
    const attP = new THREE.BufferAttribute(aParam, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nSeg * 4 * 3), 3));
    geo.setAttribute('aA', attA);
    geo.setAttribute('aB', attB);
    geo.setAttribute('aCorner', new THREE.BufferAttribute(aCorner, 2));
    geo.setAttribute('aParam', attP);
    geo.setIndex(index);
    const lineMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      uniforms: {
        uViewport: { value: new THREE.Vector2(1280, 720) },
        uBaseHalfPx: { value: 1.2 },
        uFocus: { value: 7 },
        uBlurK: { value: 0.004 },
        uBlurNearK: { value: 0.0012 },
        uNear: { value: 0.1 },
        uFarFade: { value: 25 },
        uNearFade: { value: 2.5 },
        uColA: { value: new THREE.Vector3(...hexToLinear(v.lineA)) },
        uColB: { value: new THREE.Vector3(...hexToLinear(v.lineB)) },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const lines = new THREE.Mesh(geo, lineMat);
    lines.frustumCulled = false;
    lines.renderOrder = 2;
    scene.add(lines);

    const glowCol = new THREE.Vector3(...hexToLinear(v.glow));
    const glows = new SpriteField(GLOWS.length * COPIES.length, glowCol, glowCol, {
      fogNear: 20,
      fogFar: 60,
      minPx: 2,
      sharp: 2.2,
    });
    const glowMesh = glows.mesh();
    glowMesh.renderOrder = 1;
    glowMesh.material.depthTest = false;
    scene.add(glowMesh);

    const q = new THREE.Quaternion();
    const pa = new THREE.Vector3();
    const pb = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    const tmpV = new THREE.Vector3();
    const hotP = new THREE.Vector3();

    return {
      scene,
      camera,
      update: (frame, aspect, viewH) => {
        const t = frame / SHARDS_FRAMES;
        const travel = mod(N_BLOCKS * L * t, L);
        camPos.set(0.6 * Math.sin(TAU * t), 0.35 * Math.sin(TAU * t * 2 + 0.7), -travel);
        camera.position.copy(camPos);
        camera.rotation.set(0.04 * Math.sin(TAU * t + 0.3), 0.06 * Math.sin(TAU * t), 0.03 * Math.sin(TAU * t + 1.9));
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        let s = 0;
        let gi = 0;
        const put = (arr: Float32Array, i: number, p: THREE.Vector3) => {
          for (let k = 0; k < 4; k++) {
            arr[(i * 4 + k) * 3] = p.x;
            arr[(i * 4 + k) * 3 + 1] = p.y;
            arr[(i * 4 + k) * 3 + 2] = p.z;
          }
        };
        for (const k of COPIES) {
          for (const sh of SHARDS) {
            q.setFromAxisAngle(sh.axis, sh.phase + TAU * sh.turns * t);
            const cz = sh.center.z - k * L;
            const n = sh.local.length;
            const segs = segCount(sh);
            // closeness drives the colour toward the lighter end and the glow flare
            const dz = camPos.z - cz;
            const near = Math.exp(-Math.pow(Math.max(0, dz - 4) / 10, 2));
            for (let j = 0; j < segs; j++) {
              pa.copy(sh.local[j]).applyQuaternion(q);
              pb.copy(sh.local[(j + 1) % n]).applyQuaternion(q);
              pa.x += sh.center.x;
              pa.y += sh.center.y;
              pa.z += cz;
              pb.x += sh.center.x;
              pb.y += sh.center.y;
              pb.z += cz;
              if (sh.ext > 0) {
                tmpV.subVectors(pb, pa).multiplyScalar(sh.ext);
                pa.sub(tmpV);
                pb.add(tmpV);
              }
              put(aA, s, pa);
              put(aB, s, pb);
              const base = 1.7 * sh.bright * (0.55 + 0.9 * near);
              const ia = base * sh.vBright[j];
              const ib = base * sh.vBright[(j + 1) % n];
              for (let c = 0; c < 4; c++) {
                aParam[(s * 4 + c) * 3] = ia;
                aParam[(s * 4 + c) * 3 + 1] = ib;
                aParam[(s * 4 + c) * 3 + 2] = Math.min(0.85, sh.tone * 0.4 + near * 0.6);
              }
              s++;
            }
            if (sh.glow > 0) {
              // soft light bloom behind the hot corner; flares as the shard comes close
              hotP.copy(sh.local[sh.hot]).applyQuaternion(q);
              const gz = dz - hotP.z;
              const flare = Math.exp(-Math.pow((gz - 9) / 4.5, 2));
              glows.set(gi++, sh.center.x + hotP.x, sh.center.y + hotP.y, cz + hotP.z, 0.8 + 0.7 * sh.glow, 0.004 + 0.5 * sh.glow * flare, 0);
            }
          }
        }
        attA.needsUpdate = true;
        attB.needsUpdate = true;
        attP.needsUpdate = true;
        glows.commit(viewH);
        lineMat.uniforms.uViewport.value.set(viewH * aspect, viewH);
        lineMat.uniforms.uBaseHalfPx.value = 1.25 * (viewH / 720);
      },
      post: () => ({
        loopFrames: SHARDS_FRAMES,
        exposure: 1.0,
        bloomStrength: 0.75,
        bloomRadius: 0.75,
        bloomThreshold: 0.0,
        bloomKnee: 0.1,
        dof: { enabled: false, focusDistance: 1, farBlur: 0, nearBlur: 0 },
        grain: 0,
        vignette: 0,
        blackFloor: 0.0006,
      }),
    };
  };
