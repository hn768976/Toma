import React, { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MONO } from "../lib/assets";
import { SNOISE } from "../lib/glsl";
import { canvasTexture, depthOnlyMaterial, glowMaterial, makeCanvas } from "../lib/helpers";
import { loopPhase, mulberry32, Rng, smoothstep, TAU } from "../lib/random";
import { PosedCamera, Stage } from "../lib/stage";
import { BrainVersion, hexToLinear } from "../versions";

const LEN = 600;
const TILE = 20; // board texture tile, world units
const TEX = 4096;

// ---------------------------------------------------------------- brain shape
const brainGeometry = () => {
  const part = (g: THREE.BufferGeometry, id: number) => {
    const n = g.attributes.position.count;
    g.setAttribute("part", new THREE.BufferAttribute(new Float32Array(n).fill(id), 1));
    return g;
  };
  const cer = new THREE.SphereGeometry(1, 200, 140);
  const p = cer.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    let X = x * 0.62;
    let Y = y * 0.5;
    const Z = z * 1.0;
    if (Y < 0) Y *= 0.68; // flatter base
    Y += 0.05 * z * (y > 0 ? 1 : 0.4); // frontal lobe a little higher, occipital lower
    // longitudinal fissure between the hemispheres
    const fis = Math.exp(-Math.pow(x / 0.075, 2)) * smoothstep(-0.2, 0.7, y);
    Y -= 0.11 * fis;
    X *= 1 - 0.05 * fis;
    // temporal lobes hang down at the sides, Sylvian notch above them
    const tl = Math.exp(-Math.pow((y + 0.3) / 0.32, 2)) * Math.exp(-Math.pow((z - 0.08) / 0.42, 2));
    Y -= 0.16 * tl * Math.abs(x);
    // Sylvian fissure: a groove above the temporal lobe running back from the front
    const syl = Math.exp(-Math.pow((y + 0.02 - 0.25 * z) / 0.07, 2)) * smoothstep(-0.3, 0.6, z) * Math.abs(x);
    X *= 1 - 0.07 * syl;
    X *= 1 + 0.06 * tl;
    // narrower frontal pole
    X *= 1 - 0.12 * smoothstep(0.4, 1.0, z);
    p.setXYZ(i, X, Y, Z);
  }
  cer.computeVertexNormals();
  part(cer, 0);

  const cbl = new THREE.SphereGeometry(1, 120, 80);
  cbl.scale(0.42, 0.2, 0.27);
  cbl.translate(0, -0.3, -0.6);
  part(cbl, 1);

  const stem = new THREE.CylinderGeometry(0.09, 0.055, 0.62, 32, 8);
  stem.rotateX(0.5);
  stem.translate(0, -0.55, -0.36);
  part(stem, 2);

  return mergeGeometries([cer, cbl, stem])!;
};

const brainMaterial = (v: BrainVersion) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uCol: { value: new THREE.Vector3(...hexToLinear(v.holo)) },
      uRim: { value: new THREE.Vector3(...hexToLinear(v.holo_rim)) },
      uScan: { value: new THREE.Vector3(...hexToLinear(v.scan)) },
      uScanZ: { value: 0 },
      uScanAmt: { value: 0 },
      uIntensity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float part;
      varying vec3 vObj;
      varying vec3 vN;
      varying vec3 vV;
      varying float vPart;
      ${SNOISE}
      void main() {
        vec3 p = position;
        float disp = 0.0;
        if (part < 0.5) {
          float n = snoise(p * vec3(3.4, 3.6, 3.0));
          disp = (smoothstep(0.0, 0.35, abs(n)) - 0.6) * 0.06 + snoise(p * 7.0 + 3.1) * 0.006;
        } else if (part < 1.5) {
          disp = (abs(sin(p.y * 95.0 + p.z * 8.0)) - 0.5) * 0.012;
        }
        p += normal * disp;
        vObj = position;
        vPart = part;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol, uRim, uScan;
      uniform float uScanZ, uScanAmt, uIntensity;
      varying vec3 vObj;
      varying vec3 vN;
      varying vec3 vV;
      varying float vPart;
      ${SNOISE}
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(vV);
        float fres = pow(1.0 - abs(dot(n, v)), 2.6);
        float sulci, fine;
        if (vPart < 0.5) {
          float nz = snoise(vObj * vec3(3.4, 3.6, 3.0));
          sulci = 1.0 - smoothstep(0.0, 0.1 + fwidth(nz), abs(nz));
          float nz2 = snoise(vObj * 8.0 + 5.0);
          fine = 1.0 - smoothstep(0.0, 0.08 + fwidth(nz2), abs(nz2));
        } else if (vPart < 1.5) {
          float s = abs(cos(vObj.y * 47.5 + vObj.z * 4.0));
          sulci = smoothstep(0.75 - fwidth(s), 1.0, s);
          fine = 0.0;
        } else {
          sulci = 0.0;
          fine = 0.0;
          fres *= 0.4;
        }
        // fine wireframe mesh over the hologram
        vec3 g3 = abs(fract(vObj * vec3(16.0, 16.0, 13.0)) - 0.5) * 2.0;
        vec3 gw = fwidth(vObj * vec3(16.0, 16.0, 13.0)) * 2.0;
        vec3 gl3 = 1.0 - smoothstep(vec3(0.0), vec3(0.08) + gw, 1.0 - g3);
        float mesh = max(max(gl3.x, gl3.y), gl3.z) * step(vPart, 1.5);
        vec3 c = uCol * (0.16 + 0.34 * fres) + uRim * (sulci * 0.3 + fine * 0.1 + mesh * 0.3 + pow(fres, 6.0) * 0.08);
        float d = vObj.z - uScanZ;
        float band = exp(-d * d * 22.0);
        c += uScan * band * uScanAmt * (0.3 + sulci * 0.9 + fres * 0.5);
        c *= vPart < 0.5 ? 1.0 : (vPart < 1.5 ? 0.95 : 0.7);
        c *= gl_FrontFacing ? 1.0 : 0.5;
        gl_FragColor = vec4(c * uIntensity, 1.0);
      }`,
  });

// ---------------------------------------------------------------- circuit board
type Trace = { pts: [number, number][]; bright: boolean };
type Chip = { x: number; y: number; w: number; h: number };

const buildBoard = (v: BrainVersion) => {
  const rng = mulberry32(v.seed * 101 + 7);
  const { c, ctx } = makeCanvas(TEX, TEX);
  ctx.fillStyle = v.board;
  ctx.fillRect(0, 0, TEX, TEX);
  const traceCol = (a: number) => `rgba(110,140,190,${a})`;

  // faint fine grid
  ctx.strokeStyle = "rgba(80,100,140,0.08)";
  ctx.lineWidth = 2;
  for (let i = 0; i < TEX; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, TEX);
    ctx.moveTo(0, i);
    ctx.lineTo(TEX, i);
    ctx.stroke();
  }

  const traces: Trace[] = [];
  const dirs: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1], [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071]];
  const walk = (r: Rng, x: number, y: number, segs: number) => {
    const pts: [number, number][] = [[x, y]];
    let d = Math.floor(r() * 4);
    for (let s = 0; s < segs; s++) {
      const len = 60 + r() * 380;
      const dd = dirs[d];
      x += dd[0] * len;
      y += dd[1] * len;
      pts.push([x, y]);
      // turn by 45 or 90 degrees, keep PCB-like
      const turn = r();
      d = d < 4 ? (turn < 0.5 ? 4 + Math.floor(r() * 4) : (d + (r() < 0.5 ? 1 : 3)) % 4) : Math.floor(r() * 4);
    }
    return pts;
  };
  // bus groups: bundles of parallel traces
  for (let b = 0; b < 70; b++) {
    const n = 4 + Math.floor(rng() * 10);
    const x0 = rng() * TEX;
    const y0 = rng() * TEX;
    const horizontal = rng() < 0.5;
    const len = 300 + rng() * 1400;
    const gap = 14 + rng() * 10;
    const bend = rng() < 0.6;
    for (let i = 0; i < n; i++) {
      const o = i * gap;
      const pts: [number, number][] = horizontal
        ? [[x0, y0 + o], [x0 + len, y0 + o], ...(bend ? ([[x0 + len + 200 - o, y0 + 200]] as [number, number][]) : [])]
        : [[x0 + o, y0], [x0 + o, y0 + len], ...(bend ? ([[x0 + 200, y0 + len + 200 - o]] as [number, number][]) : [])];
      traces.push({ pts, bright: rng() < 0.12 });
    }
  }
  for (let i = 0; i < 520; i++) {
    traces.push({ pts: walk(rng, rng() * TEX, rng() * TEX, 2 + Math.floor(rng() * 5)), bright: rng() < 0.1 });
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const t of traces) {
    ctx.strokeStyle = traceCol(t.bright ? 0.55 : 0.16 + rng() * 0.18);
    ctx.lineWidth = t.bright ? 4 : 3;
    ctx.beginPath();
    t.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    // pads at both ends
    for (const [x, y] of [t.pts[0], t.pts[t.pts.length - 1]]) {
      ctx.fillStyle = traceCol(0.35);
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, TAU);
      ctx.fill();
    }
  }
  // chips (outlined, with pin rows) — instanced boxes sit on some of them
  const chips: Chip[] = [];
  for (let i = 0; i < 160; i++) {
    const w = 60 + rng() * 260;
    const h = 40 + rng() * 140;
    const x = rng() * TEX;
    const y = rng() * TEX;
    chips.push({ x, y, w, h });
    ctx.fillStyle = "rgba(20,26,40,1)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = traceCol(0.35);
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = traceCol(0.45);
    for (let k = 8; k < w - 6; k += 14) {
      ctx.fillRect(x + k, y - 10, 6, 10);
      ctx.fillRect(x + k, y + h, 6, 10);
    }
  }
  // small coloured LED dashes and white data dashes, as on the reference board
  const dashCols = ["rgba(255,255,255,0.95)", "rgba(255,170,90,0.95)", "rgba(255,190,110,0.95)", "rgba(140,190,255,0.95)"];
  for (let i = 0; i < 3800; i++) {
    const col = rng() < 0.55 ? dashCols[0] : dashCols[1 + Math.floor(rng() * 3)];
    ctx.fillStyle = col.replace(/[\d.]+\)$/, `${0.25 + rng() * 0.7})`);
    const x = rng() * TEX;
    const y = rng() * TEX;
    if (rng() < 0.5) ctx.fillRect(x, y, 12 + rng() * 50, 5);
    else {
      // a row of tiny dashes
      const n = 3 + Math.floor(rng() * 8);
      for (let k = 0; k < n; k++) ctx.fillRect(x + k * 16, y, 9, 4);
    }
  }
  // fine labels
  ctx.font = `600 22px "${MONO}"`;
  ctx.fillStyle = "rgba(130,150,190,0.35)";
  for (let i = 0; i < 260; i++) {
    const s = ["R", "C", "U", "Q", "D", "L"][Math.floor(rng() * 6)] + Math.floor(rng() * 99);
    ctx.fillText(s, rng() * TEX, rng() * TEX);
  }
  const tex = canvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return { tex, traces, chips };
};

const toWorld = (x: number, y: number): [number, number] => [(x / TEX - 0.5) * TILE, (y / TEX - 0.5) * TILE];

const boardMaterial = (tex: THREE.Texture) =>
  new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, uFog: { value: 0.12 }, uCamPos: { value: new THREE.Vector3() } },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float uFog;
      uniform vec3 uCamPos;
      varying vec3 vW;
      void main() {
        vec2 uv = vec2(vW.x / ${TILE.toFixed(1)} + 0.5, 0.5 - vW.z / ${TILE.toFixed(1)});
        vec3 c = texture2D(map, uv).rgb;
        float d = length(vW - uCamPos);
        c *= exp(-max(d - 6.0, 0.0) * uFog);
        gl_FragColor = vec4(c * 1.1, 1.0);
      }`,
  });

// ---------------------------------------------------------------- layout
type BrainSpec = { pos: [number, number, number]; scale: number; yaw: number; bobK: number; bobPh: number; intensity: number };
const BRAINS: BrainSpec[] = [
  { pos: [-2.1, 1.65, 0.0], scale: 1.95, yaw: -1.25, bobK: 1, bobPh: 0.0, intensity: 1.0 },
  { pos: [2.3, 0.62, -1.4], scale: 0.85, yaw: -1.1, bobK: 2, bobPh: 0.3, intensity: 0.85 },
  { pos: [1.2, 0.58, 1.9], scale: 0.85, yaw: -1.4, bobK: 2, bobPh: 0.6, intensity: 0.8 },
  { pos: [4.9, 0.7, -3.6], scale: 0.9, yaw: -1.0, bobK: 1, bobPh: 0.2, intensity: 0.75 },
  { pos: [0.6, 1.1, -6.8], scale: 1.0, yaw: -1.3, bobK: 1, bobPh: 0.8, intensity: 0.65 },
  { pos: [-3.6, 1.2, -8.6], scale: 1.1, yaw: -1.2, bobK: 2, bobPh: 0.45, intensity: 0.55 },
  { pos: [6.5, 2.2, -15.0], scale: 2.6, yaw: -1.3, bobK: 1, bobPh: 0.65, intensity: 0.4 },
];
const LINKS: [number, number][] = [[1, 2], [1, 3], [0, 1], [3, 4], [4, 5], [2, 0]];
const bob = (b: BrainSpec, t: number) => 0.07 * Math.sin(TAU * (t * b.bobK + b.bobPh)) * b.scale;

const linkCurve = (a: THREE.Vector3, b: THREE.Vector3) => {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.y += 0.25 + a.distanceTo(b) * 0.08;
  return new THREE.QuadraticBezierCurve3(a, mid, b);
};

// link endpoints sit just under each brain
const anchor = (b: BrainSpec) => new THREE.Vector3(b.pos[0], b.pos[1] - 0.25 * b.scale, b.pos[2]);

const linkStrandGeometry = (curve: THREE.QuadraticBezierCurve3, phase: number, radius: number) => {
  const N = 220;
  const pts: THREE.Vector3[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const p = curve.getPoint(s);
    const tng = curve.getTangent(s);
    const nrm = new THREE.Vector3().crossVectors(tng, up).normalize();
    const bin = new THREE.Vector3().crossVectors(nrm, tng).normalize();
    const th = s * TAU * 5 + phase;
    const r = 0.07 * Math.sin(Math.PI * s);
    pts.push(p.clone().addScaledVector(nrm, Math.cos(th) * r).addScaledVector(bin, Math.sin(th) * r));
  }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, radius, 5, false);
  // per-vertex position along the link, for following the brains' bob in the shader
  const count = geo.attributes.position.count;
  const sArr = new Float32Array(count);
  for (let i = 0; i < count; i++) sArr[i] = Math.floor(i / 6) / 400;
  geo.setAttribute("s", new THREE.BufferAttribute(sArr, 1));
  return geo;
};

const linkMaterial = (col: [number, number, number]) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uCol: { value: new THREE.Vector3(...col) },
      uBobA: { value: 0 },
      uBobB: { value: 0 },
      uPulse: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float s;
      uniform float uBobA, uBobB;
      varying float vS;
      void main() {
        vS = s;
        vec3 p = position + vec3(0.0, mix(uBobA, uBobB, s), 0.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol;
      uniform float uPulse;
      varying float vS;
      void main() {
        float d = vS - uPulse;
        float pulse = exp(-d * d * 400.0);
        float fade = smoothstep(0.0, 0.08, vS) * smoothstep(1.0, 0.92, vS);
        gl_FragColor = vec4(uCol * (0.35 + 2.5 * pulse) * fade, 1.0);
      }`,
  });

const beamMaterial = (col: [number, number, number]) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uCol: { value: new THREE.Vector3(...col) }, uAmt: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol;
      uniform float uAmt;
      varying vec2 vUv;
      void main() {
        float x = (vUv.x - 0.5) * 2.0;
        float a = exp(-x * x * 9.0) * pow(1.0 - vUv.y, 2.2);
        // a few thin vertical filaments inside the beam
        float f = 0.6 + 0.4 * sin(vUv.x * 70.0) * sin(vUv.x * 23.0 + 1.0);
        gl_FragColor = vec4(uCol * a * f * uAmt, 1.0);
      }`,
  });

// camera: low (~15 degrees above the board), drifting sideways on a closed path
const camera = (t: number) => {
  const a = TAU * t;
  const position: [number, number, number] = [-0.6 + 1.5 * Math.sin(a), 5.4 + 0.15 * Math.sin(2 * a), 8.4 + 0.6 * Math.cos(a)];
  const target: [number, number, number] = [0.6 + 0.5 * Math.sin(a + 0.6), 0.2, -3.0];
  return { position, target };
};

// ---------------------------------------------------------------- scene
const BrainScene: React.FC<{ v: BrainVersion; frame: number }> = ({ v, frame }) => {
  const t = loopPhase(frame, LEN);

  const res = useMemo(() => {
    const board = buildBoard(v);
    const boardMat = boardMaterial(board.tex);
    const brainGeo = brainGeometry();
    const brainMats = BRAINS.map(() => brainMaterial(v));
    const depthMat = depthOnlyMaterial();
    const linkCol = hexToLinear(v.link);
    const links = LINKS.map(([a, b], i) => {
      const curve = linkCurve(anchor(BRAINS[a]), anchor(BRAINS[b]));
      return {
        a, b, curve,
        geos: [linkStrandGeometry(curve, 0, 0.0065), linkStrandGeometry(curve, Math.PI, 0.0065)],
        mat: linkMaterial(linkCol.map((x) => x * (i < 3 ? 1.0 : 0.7)) as [number, number, number]),
      };
    });

    // pulses along board traces: pick long traces, whole cycles per loop
    const prng = mulberry32(v.seed * 13 + 1);
    const pulsePaths = board.traces
      .filter((tr) => {
        const [x, z] = toWorld(tr.pts[0][0], tr.pts[0][1]);
        return Math.abs(x) < 8 && z > -12 && z < 6;
      })
      .slice(0, 400)
      .filter(() => prng() < 0.35)
      .slice(0, 110)
      .map((tr) => {
        const pts = tr.pts.map(([x, y]) => toWorld(x, y));
        const segLen = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
        const total = segLen.reduce((a, b) => a + b, 0);
        return { pts, segLen, total, k: 1 + Math.floor(prng() * 3), ph: prng(), col: prng() };
      });
    const pulseGeo = new THREE.PlaneGeometry(1, 1);
    const pulseMesh = new THREE.InstancedMesh(pulseGeo, glowMaterial({ core: 5, soft: 0.25 }), pulsePaths.length);
    const tc = hexToLinear(v.trace);
    pulsePaths.forEach((pp, i) => {
      const c = pp.col < 0.5 ? new THREE.Color(tc[0] * 1.2, tc[1] * 1.2, tc[2] * 1.4) : new THREE.Color(1.3, 1.25, 1.2);
      pulseMesh.setColorAt(i, c);
    });
    pulseMesh.frustumCulled = false;

    // chip boxes on part of the drawn chips
    const crng = mulberry32(v.seed * 17 + 3);
    const chipBoxes = board.chips.filter(() => crng() < 0.6);
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const boxMat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vW;
        void main() {
          vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vN; varying vec3 vW;
        void main() {
          float top = max(vN.y, 0.0);
          vec3 c = vec3(0.012, 0.016, 0.026) + vec3(0.02, 0.028, 0.05) * top;
          c *= exp(-max(length(vW - cameraPosition) - 6.0, 0.0) * 0.075);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const boxes = new THREE.InstancedMesh(boxGeo, boxMat, chipBoxes.length);
    const m = new THREE.Matrix4();
    chipBoxes.forEach((ch, i) => {
      const [x0, z0] = toWorld(ch.x, ch.y);
      const [x1, z1] = toWorld(ch.x + ch.w, ch.y + ch.h);
      const h = 0.03 + crng() * 0.08;
      m.makeScale(Math.abs(x1 - x0), h, Math.abs(z1 - z0));
      m.setPosition((x0 + x1) / 2, h / 2, -(z0 + z1) / 2);
      boxes.setMatrixAt(i, m);
    });
    boxes.frustumCulled = false;

    // light beams rising from the board under some brains
    const beamCol = hexToLinear(v.holo_rim);
    const beams = [0, 1, 2, 3, 4].map((i) => ({
      brain: i,
      mat: beamMaterial(beamCol.map((x) => x * (i === 0 ? 1.0 : 0.5)) as [number, number, number]),
    }));
    const beamGeo = new THREE.PlaneGeometry(1, 1);
    beamGeo.translate(0, 0.5, 0);

    // dust motes in the air (instanced glow sprites), fixed layout
    const drng = mulberry32(v.seed * 19 + 5);
    const dust = Array.from({ length: 140 }, () => ({
      p: [drng() * 16 - 8, 0.1 + drng() * 3, drng() * 18 - 14] as [number, number, number],
      k: 1 + Math.floor(drng() * 2),
      ph: drng(),
      s: 0.015 + drng() * 0.03,
    }));
    const dustMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), glowMaterial({ core: 4, soft: 0.1 }), dust.length);
    dust.forEach((_, i) => dustMesh.setColorAt(i, new THREE.Color(0.25, 0.32, 0.55)));
    dustMesh.frustumCulled = false;

    return { board, boardMat, brainGeo, brainMats, depthMat, links, pulsePaths, pulseMesh, boxes, beams, beamGeo, dust, dustMesh };
  }, [v]);

  const cam = useMemo(() => camera(t), [t]);

  useLayoutEffect(() => {
    const camPos = new THREE.Vector3(...cam.position);
    res.boardMat.uniforms.uCamPos.value.copy(camPos);
    // scan band sweeps front to back twice per loop on every brain
    res.brainMats.forEach((m, i) => {
      const ph = (t * 2 + i * 0.17) % 1;
      m.uniforms.uScanZ.value = 1.25 - ph * 2.5;
      m.uniforms.uScanAmt.value = Math.sin(Math.PI * ph) * (i === 0 ? 0.9 : 0.5);
      m.uniforms.uIntensity.value = BRAINS[i].intensity * 0.5;
    });
    // link pulses + bob following
    res.links.forEach((l, i) => {
      l.mat.uniforms.uBobA.value = bob(BRAINS[l.a], t);
      l.mat.uniforms.uBobB.value = bob(BRAINS[l.b], t);
      l.mat.uniforms.uPulse.value = ((t * (i % 2 === 0 ? 3 : 2) + i * 0.29) % 1) * 1.2 - 0.1;
    });
    // board pulses
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    res.pulsePaths.forEach((pp, i) => {
      let d = ((t * pp.k + pp.ph) % 1) * pp.total;
      let s = 0;
      while (s < pp.segLen.length - 1 && d > pp.segLen[s]) {
        d -= pp.segLen[s];
        s++;
      }
      const a = pp.pts[s];
      const b = pp.pts[s + 1];
      const f = pp.segLen[s] > 0 ? Math.min(1, d / pp.segLen[s]) : 0;
      const x = a[0] + (b[0] - a[0]) * f;
      const z = -(a[1] + (b[1] - a[1]) * f);
      const ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
      e.set(-Math.PI / 2, 0, ang);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, 0.01, z), q, new THREE.Vector3(0.16, 0.025, 1));
      res.pulseMesh.setMatrixAt(i, m);
    });
    res.pulseMesh.instanceMatrix.needsUpdate = true;
    // dust drifts on closed loops
    res.dust.forEach((d, i) => {
      const a = TAU * (t * d.k + d.ph);
      const p = new THREE.Vector3(d.p[0] + 0.15 * Math.sin(a), d.p[1] + 0.12 * Math.sin(a * 2), d.p[2] + 0.15 * Math.cos(a));
      q.setFromRotationMatrix(new THREE.Matrix4().lookAt(camPos, p, new THREE.Vector3(0, 1, 0)));
      m.compose(p, q, new THREE.Vector3(d.s, d.s, d.s));
      res.dustMesh.setMatrixAt(i, m);
    });
    res.dustMesh.instanceMatrix.needsUpdate = true;
    // beams flicker gently (whole cycles)
    res.beams.forEach((b, i) => {
      b.mat.uniforms.uAmt.value = 0.7 + 0.3 * Math.sin(TAU * (t * (2 + (i % 3)) + i * 0.4));
    });
  }, [t, res, cam]);

  const camYaw = Math.atan2(cam.position[0], cam.position[2]);

  return (
    <>
      <PosedCamera position={cam.position} target={cam.target} fov={34} near={0.1} far={80} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={res.boardMat}>
        <planeGeometry args={[80, 80]} />
      </mesh>
      <primitive object={res.boxes} />
      <primitive object={res.pulseMesh} />
      <primitive object={res.dustMesh} />
      {res.beams.map((b) => {
        const br = BRAINS[b.brain];
        return (
          <mesh
            key={b.brain}
            geometry={res.beamGeo}
            material={b.mat}
            position={[br.pos[0], 0, br.pos[2]]}
            rotation={[0, camYaw, 0]}
            scale={[br.scale * 0.9, br.pos[1] + bob(br, t) - 0.1 * br.scale, 1]}
            renderOrder={5}
          />
        );
      })}
      {res.links.map((l, i) =>
        l.geos.map((g, k) => <mesh key={`${i}-${k}`} geometry={g} material={l.mat} renderOrder={6} frustumCulled={false} />),
      )}
      {BRAINS.map((b, i) => {
        const pos: [number, number, number] = [b.pos[0], b.pos[1] + bob(b, t), b.pos[2]];
        const rot: [number, number, number] = [0.05, b.yaw + 0.08 * Math.sin(TAU * (t + b.bobPh)), 0];
        return (
          <group key={i} position={pos} rotation={rot} scale={b.scale}>
            {/* rolled about its long axis so the lateral side (lobes, cerebellum) faces the camera */}
            <group rotation={[0, 0, 0.6]}>
              <mesh geometry={res.brainGeo} material={res.brainMats[i]} renderOrder={10} />
              <mesh geometry={res.brainGeo} material={res.depthMat} renderOrder={20} />
            </group>
          </group>
        );
      })}
    </>
  );
};

export const BrainBoard: React.FC<{ v: BrainVersion }> = ({ v }) => {
  const raw = useCurrentFrame();
  const frame = ((raw % LEN) + LEN) % LEN;
  const t = loopPhase(frame, LEN);
  const camPos = new THREE.Vector3(...camera(t).position);
  const big = BRAINS[0];
  const focus = camPos.distanceTo(new THREE.Vector3(big.pos[0], big.pos[1] + bob(big, t), big.pos[2]));
  return (
    <Stage
      post={{
        frame,
        exposure: 1.15,
        bloomStrength: 0.32,
        bloomThreshold: 0.6,
        bloomRadius: 1.0,
        focusDistance: focus,
        focusBand: 0.4,
        focusRange: 7,
        maxBlur: 0.014,
        nearBlurScale: 3.2,
        vignette: 0.45,
        clearColor: [0, 0, 0],
      }}
    >
      <BrainScene v={v} frame={frame} />
    </Stage>
  );
};
