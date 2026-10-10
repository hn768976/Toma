import React, { useMemo } from "react";
import * as THREE from "three";
import { FibreRow, LOOP_FRAMES } from "../data";
import { PostPipeline } from "../lib/post";
import { mulberry32 } from "../lib/random";
import { buildStripGeometry, makeStripDepthMaterial, STRIP_VERT, StripLine } from "../lib/strips";
import { LookFactory, ThreeLook } from "../lib/ThreeLook";

const TAU = Math.PI * 2;
const FIBRES = 120;
const SEGMENTS = 360;
const BOARD_Y = -3.2;

// S-curve centre line (x, y, z). Far end top-left, loops back at the right,
// crosses the frame and comes toward the camera at the lower centre-right.
const PATH_POINTS: [number, number, number][] = [
  [-60, 3.4, -52],
  [-30, 3.4, -52],
  [-4, 3.2, -51],
  [15, 2.6, -48],
  [25, 1.2, -42],
  [21, 0.6, -33],
  [8, 0.0, -27],
  [-5, -0.4, -21.5],
  [-11.5, -0.7, -15.5],
  [-12.0, -0.9, -9.5],
  [-8.5, -1.0, -4],
  [-2.5, -1.1, 1.2],
  [2.2, -1.2, 4.6],
  [4.6, -1.25, 7.0],
];

const CAMERA_POS = new THREE.Vector3(1.6, 6.2, 13.5);
const CAMERA_TARGET = new THREE.Vector3(1.6, -3.4, -18);

const drawBoardTexture = (seed: number, color: string) => {
  const rng = mulberry32(seed * 977 + 13);
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, S, S);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineCap = "round";
  const step = 16;
  // traces on a 16px lattice with 45-degree jogs (tiles seamlessly: all
  // drawing is wrapped by drawing again at +-S)
  const wrapDraw = (fn: (ox: number, oy: number) => void) => {
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) fn(ox, oy);
  };
  for (let i = 0; i < 140; i++) {
    let x = Math.floor(rng() * (S / step)) * step;
    let y = Math.floor(rng() * (S / step)) * step;
    const horiz = rng() < 0.5;
    const pts: [number, number][] = [[x, y]];
    const segs = 2 + Math.floor(rng() * 4);
    for (let s = 0; s < segs; s++) {
      const L = (2 + Math.floor(rng() * 10)) * step;
      if ((s % 2 === 0) === horiz) x += L * (rng() < 0.5 ? -1 : 1);
      else y += L * (rng() < 0.5 ? -1 : 1);
      pts.push([x, y]);
      if (rng() < 0.4) {
        const d = step * 2;
        x += d * (rng() < 0.5 ? -1 : 1);
        y += d * (rng() < 0.5 ? -1 : 1);
        pts.push([x, y]);
      }
    }
    const lw = rng() < 0.2 ? 4 : 2;
    wrapDraw((ox, oy) => {
      g.lineWidth = lw;
      g.beginPath();
      pts.forEach(([px, py], k) => (k === 0 ? g.moveTo(px + ox, py + oy) : g.lineTo(px + ox, py + oy)));
      g.stroke();
      const [ex, ey] = pts[pts.length - 1];
      g.beginPath();
      g.arc(ex + ox, ey + oy, lw * 2.2, 0, TAU);
      g.fill();
    });
  }
  // chip pads
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(rng() * (S / step)) * step;
    const y = Math.floor(rng() * (S / step)) * step;
    const w = (3 + Math.floor(rng() * 6)) * step;
    const h = (3 + Math.floor(rng() * 6)) * step;
    wrapDraw((ox, oy) => {
      g.lineWidth = 2;
      g.strokeRect(x + ox, y + oy, w, h);
      for (let k = 0; k < w / 8; k++) g.fillRect(x + ox + k * 8 + 2, y + oy - 6, 3, 5);
    });
  }
  // soften: the board sits far out of focus and is only a faint glow
  const c2 = document.createElement("canvas");
  c2.width = S;
  c2.height = S;
  const g2 = c2.getContext("2d")!;
  for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
    g2.filter = "blur(3px)";
    g2.drawImage(c, ox, oy);
  }
  const tex = new THREE.CanvasTexture(c2);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
};

const makeFactory = (row: FibreRow): LookFactory => (gl, w, h) => {
  const rng = mulberry32(row.seed * 1000 + 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, w / h, 0.5, 400);

  const path = new THREE.CatmullRomCurve3(
    PATH_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    "centripetal",
  );
  const up = new THREE.Vector3(0, 1, 0);
  const centre: THREE.Vector3[] = [];
  const sideV: THREE.Vector3[] = [];
  const upV: THREE.Vector3[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const p = path.getPointAt(t);
    const tan = path.getTangentAt(t);
    // the band's broad face turns toward the camera (as in a filmed
    // ribbon), mixed with "flat on the ground" so it still lies in space
    const toCam = CAMERA_POS.clone().sub(p).normalize();
    const faceN = up.clone().multiplyScalar(0.35).addScaledVector(toCam, 0.65).normalize();
    const s = new THREE.Vector3().crossVectors(tan, faceN).normalize();
    const u = new THREE.Vector3().crossVectors(s, tan).normalize();
    // bank the band a little in the turns so it reads as a twisting ribbon
    const bank = 0.15 * Math.sin(t * Math.PI * 2.0);
    s.applyAxisAngle(tan, bank);
    u.applyAxisAngle(tan, bank);
    centre.push(p);
    sideV.push(s);
    upV.push(u);
  }

  const lines: StripLine[] = [];
  const RIBBON_HALF = 1.9;
  for (let f = 0; f < FIBRES; f++) {
    // loose bundles with small gaps so single fibres read
    const bundle = Math.floor(f / 4);
    const across = ((bundle + 0.5) / (FIBRES / 4)) * 2 - 1 + ((f % 4) - 1.5) * 0.004 + (rng() - 0.5) * 0.02;
    const depth = (rng() - 0.5) * 0.12;
    // fibres in a bundle wave together (no crossing), bundles differ
    const bRng = mulberry32(row.seed * 31 + bundle);
    const wob = bRng() * TAU;
    const wobA = 0.04 + bRng() * 0.05;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
      const a = across * RIBBON_HALF + Math.sin(t * 9 + wob) * wobA;
      const d = depth + Math.cos(t * 7 + wob) * 0.03;
      pts.push(centre[i].clone().addScaledVector(sideV[i], a).addScaledVector(upV[i], d));
    }
    const bright = rng() < 0.12 ? 1 : 0;
    // the outermost fibres on each edge are thick, bright neon tubes
    const thick = f === 1 || f === FIBRES - 2 || (f % 4 === 0 && rng() < 0.1) ? 1 : 0;
    lines.push({
      points: pts,
      rand: [rng(), rng(), thick ? 1 : bright, rng()],
      width: thick ? 3.2 : bright ? 1.3 : 0.8 + rng() * 0.4,
    });
  }
  const geo = buildStripGeometry(lines);

  const fibreFrom = new THREE.Color(row.fibreFrom);
  const fibreTo = new THREE.Color(row.fibreTo);
  const pulseCol = new THREE.Color(row.pulse);
  // >= 1 px half-width: thinner strips alias into beads under MSAA
  const minPx = Math.max(1.0, h / 720);
  const stripUniforms = {
    uRes: { value: new THREE.Vector2(w, h) },
    uHalfWidth: { value: 0.011 },
    uMinPx: { value: minPx },
  };
  const fibreUniforms = {
    ...stripUniforms,
    uFrom: { value: fibreFrom },
    uTo: { value: fibreTo },
    uPulse: { value: pulseCol },
    uPhase: { value: 0 }, // frame / LOOP_FRAMES
    uGain: { value: 1 },
  };
  const fibreFrag = /* glsl */ `
    precision highp float;
    uniform vec3 uFrom;
    uniform vec3 uTo;
    uniform vec3 uPulse;
    uniform float uPhase;
    uniform float uGain;
    in float vS;
    in float vT;
    flat in float vLen;
    flat in vec4 vRand;
    in float vThin;
    in float vDist;
    out vec4 outColor;
    float h1(float x) { return fract(sin(x * 127.1 + 311.7) * 43758.5453); }
    void main() {
      float s = abs(vS);
      float core = 1.0 - smoothstep(0.08, 0.4, s);
      float halo = exp(-s * s * 6.0) * 0.25;
      float prof = (core + halo) * vThin;
      vec3 base = mix(uFrom, uTo, clamp(vRand.y * 0.7 + vT * 0.45, 0.0, 1.0));
      float bright = 0.55 + vRand.z * 0.9 + 0.25 * vRand.w;
      // fade the very ends
      float ends = smoothstep(0.0, 0.03, vT) * smoothstep(1.0, 0.985, vT);
      // 2-4 pulses per fibre, each an integer number of trips per loop
      float pulses = 0.0;
      int count = 2 + int(floor(vRand.x * 2.999)) - (vRand.w < 0.5 ? 1 : 0);
      count = max(count, 1);
      for (int k = 0; k < 4; k++) {
        if (k >= count) break;
        float fk = float(k);
        float trips = 2.0 + floor(h1(vRand.x * 17.0 + fk * 3.1) * 4.0);
        float ph = h1(vRand.w * 29.0 + fk * 7.3);
        float head = fract(ph + fk / float(count) + trips * uPhase);
        float d = fract(head - vT + 1.0); // distance behind the head (0..1)
        float dw = d * vLen;              // in world units
        float tail = 9.0 + 18.0 * h1(vRand.y * 13.0 + fk);
        float p = exp(-dw / tail) * smoothstep(0.0, 0.6, dw);
        pulses += p * (0.35 + 0.9 * h1(vRand.z * 5.0 + fk));
      }
      vec3 col = base * bright * 0.24 + uPulse * pulses * pulses * 0.3 + base * pulses * 1.6;
      outColor = vec4(col * prof * ends * uGain, 1.0);
    }`;
  const fibreMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: STRIP_VERT,
    fragmentShader: fibreFrag,
    uniforms: fibreUniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const fibreDepth = makeStripDepthMaterial(stripUniforms, 1.01);
  const depthMesh = new THREE.Mesh(geo, fibreDepth);
  depthMesh.renderOrder = 1;
  depthMesh.frustumCulled = false;
  const fibres = new THREE.Mesh(geo, fibreMat);
  fibres.renderOrder = 3;
  fibres.frustumCulled = false;
  scene.add(depthMesh, fibres);

  // faint reflection of the ribbon in the board: mirrored copy, dimmed
  const reflUniforms = { ...fibreUniforms, uGain: { value: 0.03 } };
  const reflMat = fibreMat.clone();
  reflMat.uniforms = reflUniforms;
  const refl = new THREE.Mesh(geo, reflMat);
  refl.scale.set(1, -1, 1);
  refl.position.y = BOARD_Y * 2;
  refl.renderOrder = 2;
  refl.frustumCulled = false;
  scene.add(refl); // very faint mirror copy; the DoF blurs it into soft streaks

  // sparkles along fibres
  const SPARKS = 380;
  const sp = new Float32Array(SPARKS * 3);
  const sr = new Float32Array(SPARKS * 4);
  for (let i = 0; i < SPARKS; i++) {
    const line = lines[Math.floor(rng() * FIBRES)];
    const idx = Math.floor(rng() * SEGMENTS);
    const p = line.points[idx];
    sp.set([p.x, p.y, p.z], i * 3);
    sr.set([rng(), 1 + Math.floor(rng() * 4), rng(), rng()], i * 4);
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  sparkGeo.setAttribute("aRand", new THREE.BufferAttribute(sr, 4));
  const sparkMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: /* glsl */ `
      uniform float uPhase;
      uniform float uPx;
      in vec4 aRand;
      out float vB;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = max(0.0, sin(6.2831853 * (aRand.y * uPhase + aRand.x)));
        vB = pow(tw, 10.0) * (0.6 + aRand.z);
        gl_PointSize = uPx * (0.6 + aRand.w) * clamp(14.0 / -mv.z, 0.4, 3.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uCol;
      in float vB;
      out vec4 outColor;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float r = length(q) * 2.0;
        float a = exp(-r * r * 6.0) + max(0.0, 1.0 - abs(q.x) * 14.0) * max(0.0, 1.0 - abs(q.y) * 2.0) * 0.4
                + max(0.0, 1.0 - abs(q.y) * 14.0) * max(0.0, 1.0 - abs(q.x) * 2.0) * 0.4;
        outColor = vec4(uCol * a * vB * 2.0, 1.0);
      }`,
    uniforms: { uPhase: { value: 0 }, uPx: { value: (h / 1080) * 14 }, uCol: { value: fibreTo.clone().lerp(pulseCol, 0.35) } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.renderOrder = 4;
  sparks.frustumCulled = false;
  scene.add(sparks);

  // circuit board far below
  const boardTex = drawBoardTexture(row.seed, "#ffffff");
  boardTex.repeat.set(6, 6);
  const boardMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: /* glsl */ `
      out vec2 vUv;
      out vec3 vW;
      void main() {
        vUv = uv * 6.0;
        vW = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tBoard;
      uniform vec3 uBg;
      uniform vec3 uTrace;
      uniform vec3 uFibre;
      uniform vec3 uPath[24];
      in vec2 vUv;
      in vec3 vW;
      out vec4 outColor;
      void main() {
        float tr = texture(tBoard, vUv).g;
        // light pooled under the ribbon (big soft blob following the S)
        // diffuse light pooled under the ribbon: gaussians along its path
        float glow = 0.0;
        for (int i = 0; i < 24; i++) {
          vec3 p = uPath[i];
          float d = length(vW.xz - p.xz);
          glow += exp(-d * d / 18.0);
        }
        glow = min(glow, 2.5);
        vec3 c = uBg + uTrace * tr * (0.06 + 1.2 * glow) + uFibre * min(glow, 1.0) * 0.012;
        float fade = exp(-pow(length(vW.xz - vec2(0.0, -10.0)) / 55.0, 2.0));
        c = max(c, uBg);
        outColor = vec4(c * fade, 1.0);
      }`,
    uniforms: {
      tBoard: { value: boardTex },
      uBg: { value: new THREE.Color(row.background) },
      uTrace: { value: new THREE.Color(row.board).multiplyScalar(0.55) },
      uFibre: { value: new THREE.Color(row.fibreFrom) },
      uPath: { value: Array.from({ length: 24 }, (_, i) => path.getPointAt(0.25 + (0.75 * i) / 23)) },
    },
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), boardMat);
  board.rotation.x = -Math.PI / 2;
  board.position.y = BOARD_Y;
  board.renderOrder = 0;
  scene.add(board);

  const post = new PostPipeline(gl, w, h, {
    exposure: 0.9,
    bloomStrength: 1.15,
    bloomThreshold: 0.55,
    bloomRadius: 0.7,
    vignette: 0.55,
    grain: 0.015,
    loopFrames: LOOP_FRAMES,
    samples: 4,
    clearColor: new THREE.Color(row.background),
    fog: null,
    dof: { focus: 30, range: 9, ramp: 18, nearMax: 0.011, farMax: 0.008 },
  });

  const camPos = new THREE.Vector3();
  const camTgt = new THREE.Vector3();
  return {
    render: (frame) => {
      const ph = (((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES) / LOOP_FRAMES;
      fibreUniforms.uPhase.value = ph;
      reflUniforms.uPhase.value = ph;
      sparkMat.uniforms.uPhase.value = ph;
      // slow drift: whole cycles over the loop
      camPos.copy(CAMERA_POS);
      camPos.x += 0.45 * Math.sin(TAU * ph);
      camPos.y += 0.25 * Math.sin(TAU * ph * 2 + 0.7);
      camTgt.copy(CAMERA_TARGET);
      camTgt.x += 0.3 * Math.sin(TAU * ph + 1.3);
      camera.position.copy(camPos);
      camera.lookAt(camTgt);
      camera.updateMatrixWorld();
      post.render(scene, camera, frame);
    },
    dispose: () => {
      post.dispose();
      geo.dispose();
      fibreMat.dispose();
      reflMat.dispose();
      fibreDepth.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
      boardTex.dispose();
      boardMat.dispose();
    },
  };
};

export const FibreRibbon: React.FC<{ row: FibreRow }> = ({ row }) => {
  const factory = useMemo(() => makeFactory(row), [row]);
  return <ThreeLook factory={factory} />;
};
