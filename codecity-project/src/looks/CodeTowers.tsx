import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { ATLAS_COLS, ATLAS_ROWS, makeCodeAtlas, makeLineTexture } from "../kit/code";
import { useFontsReady } from "../lib/fonts";
import { GLSL_LINES, SkyParams } from "../lib/glsl";
import { loopSin, slot, TAU } from "../lib/math";
import { hash01, mulberry32, range } from "../lib/random";
import { SkyDome } from "../lib/Sky";
import { Driver, Stage } from "../lib/Stage";

export type CodeTowersProps = {
  seed: number;
  code: string; // code text colour
  edge: string; // floor edges / light lines
  tower: string; // tower body
  haze: string; // horizon haze
  fill: string; // floor tile glow
};

const PERIOD = 600;
const P = 48; // layout period along z (m), glided once per loop
const COPIES = 6;
const TILE = 1.2; // floor tile size (divides P)
const lin = (hex: string) => new THREE.Color(hex);

const towerVert = /* glsl */ `
attribute vec3 iOffset;
attribute vec3 iSize;
attribute vec4 iParams; // variant, text scale, scroll cycles, brightness
varying vec3 vLocal;
varying vec3 vN;
varying vec3 vSize;
varying vec4 vParams;
varying vec3 vWorld;
varying float vDist;
void main() {
  vec3 lp = position * iSize;
  vLocal = lp;
  vN = normal;
  vSize = iSize;
  vParams = iParams;
  vec4 w = modelMatrix * vec4(lp + iOffset, 1.0);
  vWorld = w.xyz;
  vec4 mv = viewMatrix * w;
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const towerFrag = /* glsl */ `
${GLSL_LINES}
uniform sampler2D uAtlas;
uniform float uT;
uniform vec3 uBody;
uniform float uBodyA;
uniform vec3 uCode;
uniform vec3 uEdge;
uniform vec3 uHaze;
varying vec3 vLocal;
varying vec3 vN;
varying vec3 vSize;
varying vec4 vParams;
varying vec3 vWorld;
varying float vDist;
void main() {
  vec3 an = abs(vN);
  float u, hu;
  if (an.x > 0.5) { u = vLocal.z * sign(vN.x); hu = vSize.z * 0.5; }
  else { u = -vLocal.x * sign(vN.z); hu = vSize.x * 0.5; }
  float v = vLocal.y;
  float variant = vParams.x;
  float scale = vParams.y;
  // Text block: 9 m x 18 m of code per atlas cell at scale 1.
  vec2 tc = vec2((u + hu) / (9.0 * scale), -v / (18.0 * scale) + uT * vParams.z);
  // Faces of the same tower show different parts of the text.
  tc.x += (vN.x + vN.z * 2.0) * 0.37;
  vec2 cell = vec2(mod(variant, ${ATLAS_COLS}.0), floor(variant / ${ATLAS_COLS}.0));
  vec2 auv = (cell + fract(tc)) / vec2(${ATLAS_COLS}.0, ${ATLAS_ROWS}.0);
  auv.y = 1.0 - auv.y;
  vec2 gx = dFdx(tc) / vec2(${ATLAS_COLS}.0, -${ATLAS_ROWS}.0);
  vec2 gy = dFdy(tc) / vec2(${ATLAS_COLS}.0, -${ATLAS_ROWS}.0);
  float code = textureGrad(uAtlas, auv, gx, gy).r;
  // Code fades in toward the base glow and out toward the top.
  float hfade = smoothstep(vSize.y * 0.9, 0.0, v) * 0.85 + 0.15;
  float pxu = max(fwidth(u), 1e-5);
  float pxv = max(fwidth(v), 1e-5);
  float edge = lineAt(hu - abs(u), 0.06, pxu) * 0.8 + lineAt(vSize.y - v, 0.06, pxv) * 0.4;
  float b = vParams.w;
  vec3 emit = uCode * code * b * hfade * 1.3 + uEdge * edge * 0.5;
  // Haze: low parts and distant parts dissolve into the horizon glow.
  float fog = (1.0 - exp(-vDist / 160.0));
  float lowHaze = exp(-max(v, 0.0) / 7.0) * smoothstep(15.0, 80.0, vDist);
  emit *= 1.0 - fog * 0.8;
  emit += uHaze * (lowHaze * 0.7 + fog * 0.04);
  float a = uBodyA * (1.0 - fog * 0.6);
  gl_FragColor = vec4(uBody * a + emit, a);
}`;

const floorVert = /* glsl */ `
attribute vec3 iOffset;
attribute vec3 iSize;
attribute vec2 iParams; // tile id, panel kind
uniform float uSlot;
uniform float uSlotT;
varying vec3 vLocal;
varying vec3 vN;
varying vec3 vSize;
varying vec3 vWorld;
varying float vDist;
varying float vLit;
varying float vKind;
float h11(float n) { return fract(sin(n * 12.9898 + 78.233) * 43758.5453); }
void main() {
  vec3 lp = position * iSize;
  vLocal = lp;
  vN = normal;
  vSize = iSize;
  vKind = iParams.y;
  // Hold schedule: in each slot a different random set of tiles is lit.
  float pick = fract(sin(iParams.x * 0.1731 + uSlot * 17.123) * 43758.5453);
  float env = smoothstep(0.0, 0.3, uSlotT) * smoothstep(1.0, 0.7, uSlotT);
  vLit = step(pick, 0.07) * env;
  vec4 w = modelMatrix * vec4(lp + iOffset, 1.0);
  vWorld = w.xyz;
  vec4 mv = viewMatrix * w;
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const floorFrag = /* glsl */ `
${GLSL_LINES}
uniform vec3 uEdge;
uniform vec3 uFill;
uniform vec3 uHaze;
varying vec3 vLocal;
varying vec3 vN;
varying vec3 vSize;
varying vec3 vWorld;
varying float vDist;
varying float vLit;
varying float vKind;
void main() {
  vec3 c;
  if (vN.y > 0.5) {
    vec2 q = vLocal.xz;
    vec2 h = vSize.xz * 0.5;
    vec2 px = max(fwidth(q), vec2(1e-5));
    float e = max(lineAt(h.x - abs(q.x), 0.02, px.x), lineAt(h.y - abs(q.y), 0.02, px.y));
    // Light panels: some tiles carry an inner glowing rectangle.
    vec2 inr = smoothstep(h * 0.75 + px, h * 0.75 - px, abs(q));
    float panel = inr.x * inr.y * step(0.6, vKind);
    float fill = 0.05 + 0.25 * fract(vKind * 7.31 + 0.13) * step(0.01, vKind);
    c = uFill * (fill * 1.4 + panel * 0.9 * fract(vKind * 3.7)) + uEdge * (e * 0.9 + vLit * 2.0) + uFill * 0.05;
  } else {
    // Sides: dark, with a bright upper rim.
    float rim = smoothstep(0.05, 0.0, vSize.y - vLocal.y);
    c = uEdge * (0.02 + rim * 0.6 + vLit * 0.4);
  }
  float fog = 1.0 - exp(-pow(vDist / 75.0, 1.6));
  c = mix(c, uHaze * 1.2, fog);
  gl_FragColor = vec4(c, 1.0);
}`;

function boxGeo(n: number, attrs: Record<string, [Float32Array, number]>) {
  const base = new THREE.BoxGeometry(1, 1, 1);
  base.translate(0, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute("position", base.getAttribute("position"));
  g.setAttribute("normal", base.getAttribute("normal"));
  for (const [k, [arr, s]] of Object.entries(attrs)) g.setAttribute(k, new THREE.InstancedBufferAttribute(arr, s));
  g.instanceCount = n;
  return g;
}

const Scene: React.FC<CodeTowersProps> = (p) => {
  const world = useRef<THREE.Group>(null);
  const sky = useRef<THREE.Mesh>(null);
  const near = useRef<THREE.Group>(null);

  const skyParams = useMemo<SkyParams>(() => {
    const h = lin(p.haze);
    return {
      top: [0.0, 0.002, 0.006],
      horizon: [h.r * 0.25, h.g * 0.25, h.b * 0.25],
      glow: [h.r * 1.6, h.g * 1.6, h.b * 1.6],
      glowDir: [0, 0, -1],
      glowW: [3.0, 0.09],
    };
  }, [p.haze]);

  const m = useMemo(() => {
    const r = mulberry32(p.seed);
    // Towers: 16 per period, outside a central corridor.
    type T = { x: number; z: number; w: number; d: number; h: number; v: number; s: number; k: number; b: number };
    const towers: T[] = [];
    let tries = 0;
    while (towers.length < 14 && tries++ < 5000) {
      const side = r() < 0.5 ? -1 : 1;
      const w = range(r, 5, 13);
      const d = range(r, 5, 12);
      const x = side * (6 + w / 2 + Math.pow(r(), 1.3) * 55);
      const z = r() * P;
      // Keep footprints apart (also across the period seam).
      const ok = towers.every((t) => {
        const dz = Math.min(Math.abs(t.z - z), P - Math.abs(t.z - z));
        return Math.abs(t.x - x) > (t.w + w) / 2 + 2 || dz > (t.d + d) / 2 + 2;
      });
      if (!ok) continue;
      towers.push({ x, z, w, d, h: range(r, 45, 140), v: Math.floor(r() * 6), s: range(r, 0.8, 1.9), k: 1 + Math.floor(r() * 2), b: range(r, 0.5, 1.2) });
    }
    const all: { o: number[]; s: number[]; p: number[] }[] = [];
    for (let c = -1; c < COPIES - 1; c++) {
      for (const t of towers) all.push({ o: [t.x, 0, -(t.z + c * P)], s: [t.w, t.h, t.d], p: [t.v, t.s, t.k, t.b] });
    }
    // Back to front (camera looks down -z), so the premultiplied glass blends right.
    all.sort((a, b) => a.o[2] - b.o[2]);
    const n = all.length;
    const to = new Float32Array(n * 3), ts = new Float32Array(n * 3), tp = new Float32Array(n * 4);
    all.forEach((t, i) => { to.set(t.o, i * 3); ts.set(t.s, i * 3); tp.set(t.p, i * 4); });
    const towerGeo = boxGeo(n, { iOffset: [to, 3], iSize: [ts, 3], iParams: [tp, 4] });
    const atlas = makeCodeAtlas(p.seed + 11);
    const towerMat = new THREE.ShaderMaterial({
      vertexShader: towerVert,
      fragmentShader: towerFrag,
      uniforms: {
        uAtlas: { value: atlas },
        uT: { value: 0 },
        uBody: { value: lin(p.tower) },
        uBodyA: { value: 0.4 },
        uCode: { value: lin(p.code) },
        uEdge: { value: lin(p.edge) },
        uHaze: { value: lin(p.haze) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });

    // Floor slabs, periodic: tile ids repeat every period.
    const nx = 110, nz = Math.round(P / TILE);
    const fo: number[] = [], fs: number[] = [], fp: number[] = [];
    const fr = mulberry32(p.seed ^ 0xf100);
    const tileH: number[] = [], tileK: number[] = [];
    for (let i = 0; i < nx * nz; i++) {
      tileH.push(range(fr, 0.02, 0.3) * (fr() < 0.12 ? 2.5 : 1));
      tileK.push(fr() < 0.45 ? 0.02 + fr() * 0.98 : 0);
    }
    for (let c = -1; c < COPIES - 1; c++) {
      for (let iz = 0; iz < nz; iz++) {
        for (let ix = 0; ix < nx; ix++) {
          const id = iz * nx + ix;
          const gap = 0.06;
          fo.push((ix - nx / 2 + 0.5) * TILE, -0.5, -((iz + 0.5) * TILE + c * P));
          fs.push(TILE - gap, 0.5 + tileH[id], TILE - gap);
          fp.push(id, tileK[id]);
        }
      }
    }
    const fn = fo.length / 3;
    const floorGeo = boxGeo(fn, { iOffset: [new Float32Array(fo), 3], iSize: [new Float32Array(fs), 3], iParams: [new Float32Array(fp), 2] });
    const floorMat = new THREE.ShaderMaterial({
      vertexShader: floorVert,
      fragmentShader: floorFrag,
      uniforms: { uEdge: { value: lin(p.edge) }, uFill: { value: lin(p.fill) }, uHaze: { value: lin(p.haze) }, uSlot: { value: 0 }, uSlotT: { value: 0 } },
    });

    // Near code lines: three big lines that slide past close to the lens.
    const lineTex = makeLineTexture(p.seed + 5, 3);
    const nearLines = [0, 1, 2].map((i) => {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTex: { value: lineTex }, uRow: { value: i }, uA: { value: 0 }, uC: { value: lin(p.code) } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
        fragmentShader: `uniform sampler2D uTex; uniform float uRow; uniform float uA; uniform vec3 uC; varying vec2 vUv;
          void main(){ float t = texture2D(uTex, vec2(vUv.x, 1.0 - (uRow + 1.0 - vUv.y) / 3.0)).r; gl_FragColor = vec4(uC * t * uA * 2.0, 1.0); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      return mat;
    });

    // Light lines: thin vertical and horizontal strokes that flash.
    const lr = mulberry32(p.seed ^ 0x1717);
    const lightLines = Array.from({ length: 12 }, (_, i) => {
      const vertical = i < 6;
      return {
        vertical,
        x: (lr() * 2 - 1) * (vertical ? 30 : 10),
        z: -(lr() * P),
        len: vertical ? range(lr, 30, 90) : range(lr, 20, 60),
        y: vertical ? 0 : range(lr, 0.15, 0.6),
        phase: Math.floor(lr() * 10),
      };
    });
    const lightMat = new THREE.MeshBasicMaterial({ color: lin(p.edge).multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    return { towerGeo, towerMat, floorGeo, floorMat, nearLines, lightLines, lightMat };
  }, [p.seed, p.code, p.edge, p.tower, p.haze, p.fill]);

  const lightRefs = useRef<(THREE.Mesh | null)[]>([]);

  return (
    <>
      <SkyDome ref={sky} sky={skyParams} radius={600} />
      <group ref={world}>
        <mesh geometry={m.floorGeo} material={m.floorMat} frustumCulled={false} renderOrder={0} />
        <mesh geometry={m.towerGeo} material={m.towerMat} frustumCulled={false} renderOrder={2} />
        {[-1, 0, 1, 2, 3].map((c) =>
          m.lightLines.map((l, i) => (
            <mesh
              key={`${c}-${i}`}
              ref={(el) => {
                lightRefs.current[(c + 1) * 20 + i] = el;
              }}
              material={m.lightMat.clone()}
              position={l.vertical ? [l.x, l.len / 2, l.z - c * P] : [l.x, l.y, l.z - c * P]}
              rotation={l.vertical ? [0, 0, 0] : [-Math.PI / 2, 0, Math.PI / 2]}
              renderOrder={3}
            >
              <planeGeometry args={[0.04, l.len]} />
            </mesh>
          )),
        )}
      </group>
      <group ref={near}>
        {m.nearLines.map((mat, i) => (
          <mesh key={i} material={mat} renderOrder={4}>
            <planeGeometry args={[4.2, 0.26]} />
          </mesh>
        ))}
      </group>
      <Driver
        post={{
          period: PERIOD,
          background: "#000",
          exposure: 1,
          bloom: { intensity: 0.9, threshold: 0.5, smoothing: 0.3, radius: 0.6 },
          dof: { focus: 22, range: 26, bokeh: 2.2 },
          grain: 0.015,
        }}
        update={(frame, cam) => {
          const f = frame % PERIOD;
          const t = f / PERIOD;
          world.current!.position.z = t * P;
          m.towerMat.uniforms.uT.value = t;
          const s = slot(f, PERIOD, 20);
          m.floorMat.uniforms.uSlot.value = s.index;
          m.floorMat.uniforms.uSlotT.value = s.t;
          // Light line flashes: 10 slots of 60 frames.
          const ls = slot(f, PERIOD, 10);
          lightRefs.current.forEach((mesh, k) => {
            if (!mesh) return;
            const i = k % 20;
            const c = Math.floor(k / 20);
            const on = hash01(i, c, ls.index, p.seed) < 0.3 ? 1 : 0;
            const env = Math.sin(Math.PI * ls.t) ** 4;
            (mesh.material as THREE.MeshBasicMaterial).opacity = on * env;
          });
          cam.fov = 58;
          cam.position.set(0.8 * loopSin(f, PERIOD, 1), 2.2 + 0.15 * loopSin(f, PERIOD, 2, 0.7), 0);
          cam.rotation.set(
            (3 + 0.6 * loopSin(f, PERIOD, 1, 1.9)) * (TAU / 360),
            2 * loopSin(f, PERIOD, 1, 0.6) * (TAU / 360),
            0.8 * loopSin(f, PERIOD, 1, 2.4) * (TAU / 360),
            "YXZ",
          );
          cam.updateMatrixWorld();
          sky.current!.position.copy(cam.position);
          // Near lines: each passes once in its own 200-frame slot.
          const ns = slot(f, PERIOD, 3);
          near.current!.position.copy(cam.position);
          near.current!.quaternion.copy(cam.quaternion);
          near.current!.children.forEach((child, i) => {
            const mesh = child as THREE.Mesh;
            const mat = mesh.material as THREE.ShaderMaterial;
            if (i !== ns.index) {
              mat.uniforms.uA.value = 0;
              return;
            }
            const u = ns.t;
            const dir = i % 2 === 0 ? 1 : -1;
            mesh.position.set(dir * (5.5 - 11 * u), [0.5, -0.7, 0.9][i], -2.2 - i * 0.3);
            mat.uniforms.uA.value = Math.sin(Math.PI * u) ** 2 * 0.8;
          });
        }}
      />
    </>
  );
};

export const CodeTowers: React.FC<CodeTowersProps> = (p) => {
  const ready = useFontsReady();
  if (!ready) return null;
  return (
    <Stage fov={58} near={0.2} far={900}>
      <Scene {...p} />
    </Stage>
  );
};
