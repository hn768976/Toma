import React, { useMemo } from "react";
import * as THREE from "three";
import { CubeRow, LOOP_FRAMES } from "../data";
import { PostPipeline } from "../lib/post";
import { mulberry32, Rng } from "../lib/random";
import { buildStripGeometry, makeStripDepthMaterial, STRIP_VERT, StripLine } from "../lib/strips";
import { LookFactory, ThreeLook } from "../lib/ThreeLook";

const TAU = Math.PI * 2;
const CUBES = 180;
const PERIOD = 128;
// Flight vector for one loop: forward (-z) and slightly upward. The cube
// field repeats along exactly this vector, so frame 600 == frame 0.
const FLIGHT = new THREE.Vector3(0, 0.1 * PERIOD, -PERIOD);
const REPLICAS = [-1, 0, 1, 2, 3];
const HALF_W = 40;
const HALF_H = 19;

// Binary digits drawn as shapes (no font): a "0" is a rounded ring, a "1"
// a bar with a small flag. Columns tile vertically for the scroll.
const drawDigitTexture = (seed: number) => {
  const rng = mulberry32(seed * 131 + 7);
  const S = 512;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, S, S);
  const cols = 16;
  const rows = 22;
  const cw = S / cols;
  const rh = S / rows;
  for (let ci = 0; ci < cols; ci++) {
    const colOn = rng() < 0.82;
    const colB = 0.45 + rng() * 0.55;
    for (let ri = 0; ri < rows; ri++) {
      const x = ci * cw + cw * 0.5;
      const y = ri * rh + rh * 0.5;
      const r = rng();
      if (!colOn || r < 0.12) {
        // small dot
        g.fillStyle = `rgba(255,255,255,${0.25 * colB})`;
        g.fillRect(x - 1.5, y - 1.5, 3, 3);
        continue;
      }
      const b = colB * (0.55 + 0.45 * rng());
      g.fillStyle = `rgba(255,255,255,${b})`;
      g.strokeStyle = `rgba(255,255,255,${b})`;
      const gw = cw * 0.42;
      const gh = rh * 0.7;
      if (r < 0.56) {
        g.lineWidth = 2.6;
        g.beginPath();
        g.roundRect(x - gw / 2, y - gh / 2, gw, gh, gw * 0.45);
        g.stroke();
      } else {
        g.fillRect(x - 1.3, y - gh / 2, 2.6, gh);
        g.fillRect(x - gw * 0.38, y - gh / 2 + 1, gw * 0.38, 2.4);
        g.fillRect(x - gw * 0.38, y + gh / 2 - 2.4, gw * 0.76, 2.4);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  return tex;
};

type Cube = {
  base: THREE.Vector3; // position in replica 0
  size: number;
  q0: THREE.Quaternion;
  axis: THREE.Vector3;
  wobble: number;
  wobblePhase: number;
  scrollTrips: number; // whole texture scrolls per loop
  rand: [number, number, number, number];
};

const sizeOf = (rng: Rng) => {
  const r = rng();
  if (r < 0.55) return 0.45 + rng() * 0.6;
  if (r < 0.85) return 1.0 + rng() * 1.0;
  if (r < 0.95) return 2.0 + rng() * 1.6;
  return 4.5 + rng() * 2.5;
};

// Camera path offset inside a replica (centre line of the flight).
const camLine = (u: number) => new THREE.Vector3(0, 0, 0).addScaledVector(FLIGHT, u);

const makeFactory = (row: CubeRow): LookFactory => (gl, w, h) => {
  const rng = mulberry32(row.seed * 1000 + 3);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, w / h, 0.3, 300);

  // ------------------------------------------------------------ cube field
  const cubes: Cube[] = [];
  // two hero cubes that pass close to the lens (one low, one to the left)
  const hero = (u: number, x: number, y: number, size: number) =>
    cubes.push({
      base: new THREE.Vector3(x, y, 0).addScaledVector(FLIGHT, u),
      size,
      q0: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, 0.25, 0.02)),
      axis: new THREE.Vector3(0, 1, 0),
      wobble: 0.04,
      wobblePhase: u,
      scrollTrips: 1,
      rand: [u, 0.3, 0.6, 0.1],
    });
  hero(0.3, 2.5, -7.0, 6.5);
  hero(0.72, -8.5, -1.0, 5.0);
  let guard = 0;
  while (cubes.length < CUBES && guard++ < 20000) {
    const u = rng();
    const x = (rng() * 2 - 1) * HALF_W;
    const y = (rng() * 2 - 1) * HALF_H;
    const size = sizeOf(rng);
    const p = new THREE.Vector3(x, y, 0).addScaledVector(FLIGHT, u);
    // keep the camera path clear (big cubes pass close, never through)
    const onPath = camLine(u);
    const d = Math.hypot(p.x - onPath.x, p.y - onPath.y);
    if (d < size * 0.9 + 2.2) continue;
    // keep spread out: reject if too close to an existing cube (periodic)
    let ok = true;
    for (const c of cubes) {
      for (const m of [-1, 0, 1]) {
        const q = c.base.clone().addScaledVector(FLIGHT, m);
        if (q.distanceTo(p) < (c.size + size) * 0.8 + 2.0) {
          ok = false;
          break;
        }
      }
      if (!ok) break;
    }
    if (!ok) continue;
    const q0 = new THREE.Quaternion().setFromEuler(
      // nearly axis-aligned, slightly turned
      new THREE.Euler((rng() - 0.5) * 0.22, (rng() - 0.5) * 0.7, (rng() - 0.5) * 0.14),
    );
    cubes.push({
      base: p,
      size,
      q0,
      axis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
      wobble: 0.04 + rng() * 0.07,
      wobblePhase: rng(),
      scrollTrips: 1 + Math.floor(rng() * 2),
      rand: [rng(), rng(), rng(), rng()],
    });
  }

  const digitTex = drawDigitTexture(row.seed);
  const instCount = cubes.length * REPLICAS.length;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cubeGeo = new THREE.InstancedBufferGeometry();
  cubeGeo.index = boxGeo.index;
  cubeGeo.setAttribute("position", boxGeo.getAttribute("position"));
  cubeGeo.setAttribute("uv", boxGeo.getAttribute("uv"));
  cubeGeo.setAttribute("normal", boxGeo.getAttribute("normal"));
  const iRand = new Float32Array(instCount * 4);
  const iScroll = new Float32Array(instCount);
  cubes.forEach((c, i) => {
    REPLICAS.forEach((_, r) => {
      const k = r * cubes.length + i;
      iRand.set(c.rand, k * 4);
    });
  });
  const iRandSorted = new Float32Array(instCount * 4);
  const randAttr = new THREE.InstancedBufferAttribute(iRandSorted, 4);
  cubeGeo.setAttribute("aRand", randAttr);
  const iMat = new Float32Array(instCount * 16);
  const iScrollRaw = new Float32Array(instCount);
  const order = Array.from({ length: instCount }, (_, k) => k);
  const depthOf = new Float32Array(instCount);
  const scrollAttr = new THREE.InstancedBufferAttribute(iScroll, 1);
  cubeGeo.setAttribute("aScroll", scrollAttr);
  cubeGeo.instanceCount = instCount;

  const cubeUniforms = {
    tDigits: { value: digitTex },
    uBody: { value: new THREE.Color(row.body) },
    uEdge: { value: new THREE.Color(row.edge) },
  };
  const cubeVert = /* glsl */ `
    in vec4 aRand;
    in float aScroll;
    in mat4 instanceMatrix;
    out vec2 vUv;
    out vec3 vN;
    out vec3 vV;
    out float vScale;
    flat out vec4 vRand;
    out float vScroll;
    void main() {
      vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vec4 mv = viewMatrix * wp;
      gl_Position = projectionMatrix * mv;
      vUv = uv;
      vN = normalize(mat3(viewMatrix) * mat3(instanceMatrix) * normal);
      vV = -mv.xyz;
      vScale = length(instanceMatrix[0].xyz);
      vRand = aRand;
      vScroll = aScroll;
    }`;
  const cubeFrag = /* glsl */ `
    precision highp float;
    uniform sampler2D tDigits;
    uniform vec3 uBody;
    uniform vec3 uEdge;
    in vec2 vUv;
    in vec3 vN;
    in vec3 vV;
    in float vScale;
    flat in vec4 vRand;
    in float vScroll;
    out vec4 outColor;
    void main() {
      // MSAA can evaluate slightly outside the face (and far outside on
      // edge-on faces): clamp so the edge terms stay bounded
      vec2 uv = clamp(vUv, 0.0, 1.0);
      float d = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
      vec2 fw = fwidth(uv);
      float px = max(max(fw.x, fw.y), 1e-4);
      // bright frame: thin line + soft inner glow, brighter corner brackets
      float lineW = 0.012 + px * 0.9;
      float edge = 1.0 - smoothstep(lineW, lineW + px * 1.5, d);
      float inner = exp(-d * 22.0) * 0.35;
      float cx = min(uv.x, 1.0 - uv.x);
      float cy = min(uv.y, 1.0 - uv.y);
      float corner = (1.0 - smoothstep(0.0, 0.16, max(cx, cy))) * edge;
      // digits: margin inside the frame, columns scroll
      vec2 duv = (uv - 0.08) / 0.84;
      float inside = step(0.0, duv.x) * step(duv.x, 1.0) * step(0.0, duv.y) * step(duv.y, 1.0);
      float tiles = vScale > 2.5 ? 0.8 : 0.55;
      vec2 tuv = duv * tiles + vec2(vRand.x, vRand.y + vScroll);
      float dig = texture(tDigits, tuv).r * inside;
      // distant tiny cubes: digits become a soft texture, keep it dim
      float detail = clamp(1.6 - px * 40.0, 0.25, 1.0);
      float facing = abs(dot(normalize(vN), normalize(vV)));
      float fres = pow(clamp(1.0 - facing, 0.0, 1.0), 2.0);
      vec3 body = uBody * (0.45 + 0.55 * fres);
      vec3 col = body * 0.42
        + uEdge * (edge * 1.1 + corner * 0.8 + inner * 0.3)
        + mix(uEdge, vec3(1.0), 0.15) * dig * 1.15 * detail;
    #ifdef FRONT
      // fake glass: emits, and hides ~45% of what is behind it
      outColor = vec4(col, 0.8);
    #else
      outColor = vec4(col * 0.18, 1.0);
    #endif
    }`;
  // back faces first (additive, dim), then front faces as glass over them
  const cubeMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: cubeVert,
    fragmentShader: cubeFrag,
    uniforms: cubeUniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.BackSide,
  });
  const cubeFrontMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: cubeVert,
    fragmentShader: cubeFrag,
    uniforms: cubeUniforms,
    defines: { FRONT: 1 },
    transparent: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
  });
  const instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(instCount * 16), 16);
  cubeGeo.setAttribute("instanceMatrix", instanceMatrix);
  const cubeMesh = new THREE.Mesh(cubeGeo, cubeMat);
  cubeMesh.frustumCulled = false;
  cubeMesh.renderOrder = 3;
  const cubeFront = new THREE.Mesh(cubeGeo, cubeFrontMat);
  cubeFront.frustumCulled = false;
  cubeFront.renderOrder = 4;
  // depth-only pass of the front faces (for the DoF)
  const cubeDepthMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: /* glsl */ `
      in mat4 instanceMatrix;
      void main() { gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `out vec4 o; void main() { o = vec4(0.0); }`,
    colorWrite: false,
    depthWrite: true,
  });
  const cubeDepth = new THREE.Mesh(cubeGeo, cubeDepthMat);
  cubeDepth.frustumCulled = false;
  cubeDepth.renderOrder = 1;
  scene.add(cubeDepth, cubeMesh, cubeFront);

  // ------------------------------------------------------------ network
  const lines: StripLine[] = [];
  const SEG = 24;
  // distance from a segment to the camera's flight line (x=y=0 along FLIGHT)
  const flightDirN = FLIGHT.clone().normalize();
  const clearance = (a: THREE.Vector3, b: THREE.Vector3) => {
    let best = Infinity;
    const p = new THREE.Vector3();
    for (let i = 0; i <= 64; i++) {
      p.copy(a).lerp(b, i / 64);
      const along = p.dot(flightDirN);
      best = Math.min(best, p.clone().addScaledVector(flightDirN, -along).length());
    }
    return best;
  };
  const addLine = (a: THREE.Vector3, b: THREE.Vector3, beam: number, width: number) => {
    if (clearance(a, b) < 3.2) return false;
    for (const m of REPLICAS) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= SEG; i++) {
        pts.push(a.clone().lerp(b, i / SEG).addScaledVector(FLIGHT, m));
      }
      lines.push({ points: pts, rand: [rng(), rng(), beam, rng()], width });
    }
    return true;
  };
  const linkRng = mulberry32(row.seed * 1000 + 99);
  const seen = new Set<string>();
  cubes.forEach((c, i) => {
    const cands: { j: number; m: number; d: number }[] = [];
    cubes.forEach((o, j) => {
      if (j === i) return;
      for (const m of [-1, 0, 1]) {
        const d = o.base.clone().addScaledVector(FLIGHT, m).distanceTo(c.base);
        cands.push({ j, m, d });
      }
    });
    cands.sort((a, b) => a.d - b.d || a.j - b.j || a.m - b.m);
    const n = 2 + (linkRng() < 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const { j, m } = cands[k];
      const key = i < j ? `${i}-${j}-${m}` : `${j}-${i}-${-m}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const b = cubes[j].base.clone().addScaledVector(FLIGHT, m);
      addLine(c.base, b, linkRng() < 0.08 ? 1 : 0, 1);
    }
  });
  // long lines crossing the whole space
  let longLines = 0;
  for (let i = 0; i < 400 && longLines < 30; i++) {
    const u = linkRng();
    const a = new THREE.Vector3((linkRng() * 2 - 1) * HALF_W * 1.6, (linkRng() * 2 - 1) * HALF_H * 1.4, 0).addScaledVector(FLIGHT, u);
    const dir = new THREE.Vector3(linkRng() - 0.5, (linkRng() - 0.5) * 0.6, (linkRng() - 0.5) * 1.2).normalize();
    const len = 60 + linkRng() * 70;
    const p0 = a.clone().addScaledVector(dir, -len / 2);
    const p1 = a.clone().addScaledVector(dir, len / 2);
    if (addLine(p0, p1, 1, 1.8)) longLines++;
  }
  const lineGeo = buildStripGeometry(lines);
  const minPx = Math.max(0.6, h / 1440);
  const lineStrip = {
    uRes: { value: new THREE.Vector2(w, h) },
    uHalfWidth: { value: 0.06 },
    uMinPx: { value: minPx * 2.2 },
  };
  const lineUniforms = {
    ...lineStrip,
    uLine: { value: new THREE.Color(row.line) },
    uPhase: { value: 0 },
  };
  const lineMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: STRIP_VERT,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uLine;
      uniform float uPhase;
      in float vS;
      in float vT;
      flat in float vLen;
      flat in vec4 vRand;
      in float vThin;
      in float vDist;
      out vec4 outColor;
      void main() {
        float s = abs(vS);
        float along = vT * vLen;
        // thin line core (about a quarter of the strip width)
        float core = (1.0 - smoothstep(0.12, 0.3, s)) * vThin;
        float alpha = vRand.z > 0.5 ? 0.9 : 0.25 + 0.2 * vRand.x;
        // travelling dots: pattern moves an integer number of spacings per loop
        float spacing = 1.6 + vRand.y * 1.8;
        float trips = 2.0 + floor(vRand.w * 4.0);
        float dir = vRand.y < 0.5 ? 1.0 : -1.0;
        float k = fract(along / spacing - dir * trips * uPhase * floor(vLen / spacing));
        float dotLen = 0.16 / spacing;
        float dotA = 1.0 - smoothstep(dotLen * 0.5, dotLen, abs(k - 0.5));
        float dotShape = 1.0 - smoothstep(0.45, 0.9, s);
        float dots = dotA * dotShape * (vRand.z > 0.5 ? 1.0 : 0.35);
        // beams: a bright long dash running along some lines
        float beam = 0.0;
        if (vRand.z > 0.5) {
          float head = fract(vRand.x + (2.0 + floor(vRand.y * 3.0)) * uPhase);
          float dd = fract(head - vT + 1.0) * vLen;
          beam = exp(-dd / 6.0) * smoothstep(0.0, 0.3, dd) * (1.0 - smoothstep(0.1, 0.5, s));
        }
        float ends = smoothstep(0.0, 0.02, vT) * smoothstep(1.0, 0.98, vT);
        vec3 col = uLine * (core * alpha * 0.8 + dots * 1.6 + beam * 2.0);
        outColor = vec4(col * ends, 1.0);
      }`,
    uniforms: lineUniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const lineMesh = new THREE.Mesh(lineGeo, lineMat);
  lineMesh.frustumCulled = false;
  lineMesh.renderOrder = 2;
  const lineDepth = new THREE.Mesh(lineGeo, makeStripDepthMaterial(lineStrip, 0.5));
  lineDepth.frustumCulled = false;
  lineDepth.renderOrder = 1;
  scene.add(lineDepth, lineMesh);

  // ------------------------------------------------------------ background
  const bgMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: /* glsl */ `
      out vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uEdge;
      uniform vec3 uMid;
      in vec2 vUv;
      out vec4 outColor;
      void main() {
        vec2 q = vUv - vec2(0.5, 0.55);
        q.x *= 1.4;
        float r = length(q);
        outColor = vec4(mix(uMid, uEdge, smoothstep(0.0, 0.75, r)), 1.0);
      }`,
    uniforms: { uEdge: { value: new THREE.Color(row.bgEdge) }, uMid: { value: new THREE.Color(row.bgMid) } },
    depthTest: false,
    depthWrite: false,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -1;
  scene.add(bg);

  const fogCol = new THREE.Color(row.bgMid).lerp(new THREE.Color(row.bgEdge), 0.4);
  const post = new PostPipeline(gl, w, h, {
    exposure: 1.0,
    bloomStrength: 0.85,
    bloomThreshold: 0.7,
    bloomRadius: 0.6,
    vignette: 0.6,
    grain: 0.015,
    loopFrames: LOOP_FRAMES,
    samples: 4,
    clearColor: new THREE.Color(row.bgEdge),
    fog: { near: 12, far: 80, density: 1.5, colorTop: fogCol, colorBottom: fogCol, horizon: 0.5 },
    dof: { focus: 20, range: 7, ramp: 16, nearMax: 0.02, farMax: 0.007 },
  });

  const mat = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const qw = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const look = new THREE.Vector3();
  const flightDir = FLIGHT.clone().normalize();

  return {
    render: (frame) => {
      const f = ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
      const ph = f / LOOP_FRAMES;
      cubes.forEach((c, i) => {
        const ang = c.wobble * Math.sin(TAU * (ph + c.wobblePhase));
        qw.setFromAxisAngle(c.axis, ang);
        q.copy(c.q0).premultiply(qw);
        scl.setScalar(c.size);
        const scroll = (c.rand[3] + c.scrollTrips * ph) % 1;
        REPLICAS.forEach((m, r) => {
          const k = r * cubes.length + i;
          pos.copy(c.base).addScaledVector(FLIGHT, m);
          mat.compose(pos, q, scl);
          mat.toArray(iMat, k * 16);
          iScrollRaw[k] = scroll;
        });
      });
      lineUniforms.uPhase.value = ph;

      // camera: one flight period per loop plus a gentle (whole-cycle) sway
      camera.position.copy(FLIGHT).multiplyScalar(ph);
      camera.position.x += 1.4 * Math.sin(TAU * ph);
      camera.position.y += 0.8 * Math.sin(TAU * 2 * ph + 0.6);
      look.copy(camera.position).addScaledVector(flightDir, 20);
      look.x += 2.2 * Math.sin(TAU * ph + 1.1);
      look.y += 1.0 * Math.sin(TAU * ph + 2.3) + 1.5;
      camera.up.set(Math.sin(TAU * ph) * 0.05, 1, 0).normalize();
      camera.lookAt(look);
      camera.updateMatrixWorld();

      // back-to-front instance order for the glass faces (ties by index,
      // so the order is a pure function of the frame)
      const cp = camera.position;
      for (let k = 0; k < instCount; k++) {
        const dx = iMat[k * 16 + 12] - cp.x;
        const dy = iMat[k * 16 + 13] - cp.y;
        const dz = iMat[k * 16 + 14] - cp.z;
        depthOf[k] = dx * dx + dy * dy + dz * dz;
        order[k] = k;
      }
      order.sort((a, b) => depthOf[b] - depthOf[a] || a - b);
      const im = instanceMatrix.array as Float32Array;
      for (let slot = 0; slot < instCount; slot++) {
        const k = order[slot];
        im.set(iMat.subarray(k * 16, k * 16 + 16), slot * 16);
        iScroll[slot] = iScrollRaw[k];
        iRandSorted.set(iRand.subarray(k * 4, k * 4 + 4), slot * 4);
      }
      instanceMatrix.needsUpdate = true;
      scrollAttr.needsUpdate = true;
      randAttr.needsUpdate = true;
      post.render(scene, camera, frame);
    },
    dispose: () => {
      post.dispose();
      digitTex.dispose();
      cubeGeo.dispose();
      boxGeo.dispose();
      cubeMat.dispose();
      cubeFrontMat.dispose();
      cubeDepthMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      bgMat.dispose();
    },
  };
};

export const CubeNetwork: React.FC<{ row: CubeRow }> = ({ row }) => {
  const factory = useMemo(() => makeFactory(row), [row]);
  return <ThreeLook factory={factory} />;
};
