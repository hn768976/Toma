import React, { useCallback } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { ThreeLook, WorldFactory } from "../../lib/three/ThreeLook";
import { DOF_GLSL, PostPipeline } from "../../lib/three/post";
import { LineBuilder, bezier, makeLineMaterial, makeLineMesh } from "../../lib/three/lines";
import { mulberry32, TAU } from "../../lib/random";
import { hexToRgb } from "../../lib/color";
import { NeuralVersion } from "./versions";

export const NEURAL_LOOP = 600;

// ---------------------------------------------------------------------------
// Network layout — built once at module level from a fixed seed.
// ---------------------------------------------------------------------------
const COL_COUNTS = [7, 9, 11, 12, 12, 11, 10, 9, 8];
const COL_DX = 2.3;
const NODE_DY = 0.7;
const NODE = 0.27;

type Node = { x: number; y: number; z: number; col: number };
type Curve = { pts: number[]; from: number; to: number; pulse: [number, number, number, number] };

const buildNetwork = () => {
  const rnd = mulberry32(4063681907);
  const nodes: Node[] = [];
  const cols: number[][] = [];
  COL_COUNTS.forEach((n, c) => {
    const ids: number[] = [];
    const yOff = Math.sin(c * 0.9) * 0.45;
    for (let i = 0; i < n; i++) {
      ids.push(nodes.length);
      nodes.push({ x: c * COL_DX, y: (i - (n - 1) / 2) * NODE_DY + yOff, z: 0, col: c });
    }
    cols.push(ids);
  });
  const curves: Curve[] = [];
  for (let c = 0; c < cols.length - 1; c++) {
    for (const a of cols[c]) {
      const next = cols[c + 1];
      const links = 4 + Math.floor(rnd() * 5); // 4..8
      const pool = [...next];
      for (let l = 0; l < links && pool.length; l++) {
        const b = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
        const A = nodes[a];
        const B = nodes[b];
        const strands = 3 + Math.floor(rnd() * 3); // 3..5 strands per link
        const bulgeY = (rnd() - 0.5) * 1.4;
        const bulgeZ = (rnd() - 0.5) * 1.6;
        for (let s = 0; s < strands; s++) {
          const jy = (rnd() - 0.5) * 0.35;
          const jz = (rnd() - 0.5) * 0.5;
          const p0 = [A.x + NODE * 0.5, A.y + (rnd() - 0.5) * NODE * 0.5, A.z + (rnd() - 0.5) * 0.08];
          const p3 = [B.x - NODE * 0.5, B.y + (rnd() - 0.5) * NODE * 0.5, B.z + (rnd() - 0.5) * 0.08];
          const p1 = [A.x + COL_DX * 0.5, A.y + bulgeY * 0.5 + jy, bulgeZ + jz];
          const p2 = [B.x - COL_DX * 0.5, B.y + bulgeY * 0.5 - jy, bulgeZ - jz];
          const pulsed = rnd() < 0.13;
          curves.push({
            pts: bezier(p0, p1, p2, p3, 22),
            from: a,
            to: b,
            pulse: pulsed ? [rnd(), 1 + Math.floor(rnd() * 3), 2.2, 0.07] : [0, 0, 0, 1],
          });
        }
      }
    }
  }
  return { nodes, curves };
};

const NET = buildNetwork();

// ---------------------------------------------------------------------------
const nodeMaterial = (dof: PostPipeline["dof"], v: NeuralVersion) =>
  new THREE.ShaderMaterial({
    uniforms: {
      ...dof,
      uNode: { value: new THREE.Color(...hexToRgb(v.node)) },
      uEdge: { value: new THREE.Color(...hexToRgb(v.edge)) },
      uPulse: { value: new THREE.Color(...hexToRgb(v.pulse)) },
      uHalf: { value: new THREE.Vector3(NODE / 2, NODE / 2, 0.07) },
    },
    vertexShader: /* glsl */ `
      attribute float iFlash;
      varying vec3 vLocal; varying vec3 vN; varying vec3 vView; varying float vDepth; varying float vFlash;
      void main() {
        vLocal = position;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vec4 vp = viewMatrix * wp;
        vN = normalize(mat3(viewMatrix) * mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vView = normalize(-vp.xyz);
        vDepth = -vp.z;
        vFlash = iFlash;
        gl_Position = projectionMatrix * vp;
      }`,
    fragmentShader: /* glsl */ `
      ${DOF_GLSL}
      uniform vec3 uNode, uEdge, uPulse, uHalf;
      varying vec3 vLocal; varying vec3 vN; varying vec3 vView; varying float vDepth; varying float vFlash;
      void main() {
        float w = sliceWeight(vDepth);
        if (w <= 0.0) discard;
        vec3 q = abs(vLocal) / uHalf;
        // second-largest normalised coordinate: ~1 along the box edges
        float mx = max(q.x, max(q.y, q.z));
        float mn = min(q.x, min(q.y, q.z));
        float mid = q.x + q.y + q.z - mx - mn;
        float edge = smoothstep(0.72, 0.98, mid);
        float fres = pow(1.0 - abs(dot(vN, vView)), 2.0);
        vec3 c = uNode * (0.42 + 0.5 * fres) + uEdge * edge * 0.95;
        c += mix(uEdge, uPulse, 0.5) * vFlash * 1.6;
        gl_FragColor = vec4(c * w, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });

const bgMaterial = (dof: PostPipeline["dof"], v: NeuralVersion) =>
  new THREE.ShaderMaterial({
    uniforms: {
      ...dof,
      uBg: { value: new THREE.Color(...hexToRgb(v.bg)) },
      uGrid: { value: new THREE.Color(...hexToRgb(v.grid)) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vW; varying float vDepth;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = (modelMatrix * vec4(position, 1.0)).xy * 0.0 + position.xy;
        vec4 vp = viewMatrix * wp;
        vDepth = -vp.z;
        gl_Position = projectionMatrix * vp;
      }`,
    fragmentShader: /* glsl */ `
      ${DOF_GLSL}
      uniform vec3 uBg, uGrid;
      varying vec2 vW; varying float vDepth;
      float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float gridLine(vec2 p, float s, float wdt) {
        vec2 g = abs(fract(p / s) - 0.5) * s;
        float d = min(g.x, g.y);
        return 1.0 - smoothstep(0.0, wdt, d);
      }
      void main() {
        float w = sliceWeight(vDepth);
        if (w <= 0.0) discard;
        // large soft brightness variation + faint circuit-like grid
        float glow = 0.9 + 0.5 * exp(-dot(vW - vec2(-4.0, 2.0), vW - vec2(-4.0, 2.0)) / 160.0);
        vec3 c = uBg * glow;
        float g1 = gridLine(vW, 1.6, 0.05);
        float g2 = gridLine(vW + 0.4, 6.4, 0.08);
        // grid lines only in some cells, like a faint board
        vec2 cell = floor(vW / 3.2);
        float on = step(0.45, h21(cell));
        c = mix(c, uGrid * 1.6, (g1 * 0.5 * on + g2 * 0.7));
        // tiny specks
        vec2 sc = floor(vW * 6.0);
        float sp = step(0.985, h21(sc + 17.0));
        vec2 f = fract(vW * 6.0) - 0.5;
        c += uGrid * 2.2 * sp * smoothstep(0.22, 0.0, length(f));
        gl_FragColor = vec4(c * w, 1.0);
      }`,
    depthWrite: true,
  });

export const NeuralLayers: React.FC<{ version: NeuralVersion; durationOverride?: number }> = ({ version }) => {
  const create = useCallback<WorldFactory>(
    (gl, w, h) => {
      const post = new PostPipeline(gl, w, h, {
        slices: [0, 4, 10, 20, 36],
        bloomWeights: [0.25, 0.22, 0.18, 0.14, 0.1, 0.06],
        bloomThreshold: 0.2,
        exposure: 1.0,
        vignette: 0.35,
        grain: 0.02,
        loop: NEURAL_LOOP,
      });
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 200);

      // background plane behind the network
      const bg = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), bgMaterial(post.dof, version));
      bg.position.set(14, 0, -9);
      bg.lookAt(-1.6, 3.4, 9.0);
      bg.renderOrder = -1;
      scene.add(bg);

      // links
      const lb = new LineBuilder();
      const linkRgb = hexToRgb(version.link);
      for (const c of NET.curves) lb.add(c.pts, linkRgb, 0.3, c.pulse);
      const lineMat = makeLineMaterial(post.dof, {
        width: 1.9,
        pulseColor: new THREE.Color(...hexToRgb(version.pulse)),
        loop: NEURAL_LOOP,
      });
      lineMat.uniforms.uRes.value.set(w, h);
      lineMat.uniforms.uPxScale.value = post.pxScale;
      scene.add(makeLineMesh(lb.build(), lineMat));

      // nodes
      const geo = new RoundedBoxGeometry(NODE, NODE, 0.14, 2, 0.03);
      const flash = new Float32Array(NET.nodes.length);
      const flashAttr = new THREE.InstancedBufferAttribute(flash, 1);
      geo.setAttribute("iFlash", flashAttr);
      const nodes = new THREE.InstancedMesh(geo, nodeMaterial(post.dof, version), NET.nodes.length);
      const m = new THREE.Matrix4();
      NET.nodes.forEach((n, i) => nodes.setMatrixAt(i, m.makeTranslation(n.x, n.y, n.z)));
      nodes.frustumCulled = false;
      scene.add(nodes);

      const pulsed = NET.curves.filter((c) => c.pulse[2] > 0);
      const target = new THREE.Vector3();

      return {
        render(frame) {
          const th = (TAU * frame) / NEURAL_LOOP;
          // closed camera path, drifting along the layers
          camera.position.set(-0.8 + 1.3 * Math.sin(th), 3.0 + 0.35 * Math.sin(2 * th), 7.2 + 0.6 * Math.cos(th));
          target.set(7.4 + 0.9 * Math.sin(th + 0.6), 0.6 + 0.25 * Math.cos(2 * th), -1.0);
          camera.lookAt(target);
          camera.updateMatrixWorld();
          post.dof.uFocus.value = camera.position.distanceTo(new THREE.Vector3(3.0, 0, 0));
          post.dof.uAperture.value = 30;
          lineMat.uniforms.uFrame.value = frame % NEURAL_LOOP;

          // node flashes: pure function of frame (time since last pulse arrival)
          flash.fill(0);
          for (const c of pulsed) {
            const k = c.pulse[1];
            const s = (((c.pulse[0] + (k * frame) / NEURAL_LOOP) % 1) + 1) % 1;
            const since = (s * NEURAL_LOOP) / k; // frames since the head wrapped (arrived)
            const f = Math.exp(-since / 7);
            if (f > flash[c.to]) flash[c.to] = f;
            const pre = Math.exp(-((1 - s) * NEURAL_LOOP) / k / 3); // light up just before arrival
            if (pre * 0.6 > flash[c.to]) flash[c.to] = pre * 0.6;
          }
          flashAttr.needsUpdate = true;
          post.render(scene, camera, frame);
        },
        dispose() {
          post.dispose();
          geo.dispose();
        },
      };
    },
    [version],
  );
  return <ThreeLook create={create} />;
};
