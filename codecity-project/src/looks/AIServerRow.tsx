import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFontsReady } from "../lib/fonts";
import { GLSL_LINES } from "../lib/glsl";
import { loopSin, TAU } from "../lib/math";
import { mulberry32, range } from "../lib/random";
import { Driver, Stage } from "../lib/Stage";

export type AIServerRowProps = {
  seed: number;
  rack: string; // cabinet metal
  glow: string; // chip glass, light lines
  text: string; // "AI" letters
};

const PERIOD = 600;
const S = 2.8; // bay spacing (two cabinets + one chip). The camera tracks one bay per loop.
const CAB_W = 1.34;
const CAB_H = 2.35;
const CAB_D = 1.1;
const BAYS_FROM = -26;
const BAYS_TO = 4;
const lin = (hex: string) => new THREE.Color(hex);

const rackVert = /* glsl */ `
attribute vec3 iOffset;
attribute vec2 iParams; // cabinet design (0/1), height scale
uniform float uMirror;
varying vec3 vLocal;
varying vec3 vN;
varying vec2 vParams;
varying vec3 vWorld;
void main() {
  vec3 size = vec3(${CAB_W.toFixed(3)}, ${CAB_H.toFixed(3)} * iParams.y, ${CAB_D.toFixed(3)});
  vec3 lp = position * size;
  vLocal = lp;
  vN = normal;
  vParams = iParams;
  vec4 w = modelMatrix * vec4(lp + iOffset, 1.0);
  w.y *= uMirror;
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const rackFrag = /* glsl */ `
${GLSL_LINES}
uniform vec3 uRack;
uniform vec3 uGlow;
uniform float uT;
uniform float uDim;
varying vec3 vLocal;
varying vec3 vN;
varying vec2 vParams;
varying vec3 vWorld;
void main() {
  vec3 size = vec3(${CAB_W.toFixed(3)}, ${CAB_H.toFixed(3)} * vParams.y, ${CAB_D.toFixed(3)});
  vec3 c = uRack;
  float design = vParams.x;
  if (vN.z > 0.5) {
    // Front: frame, then stacked units (drive rows, grilles, blanks, LEDs).
    float u = vLocal.x + size.x * 0.5;
    float v = vLocal.y;
    vec2 px = max(vec2(fwidth(u), fwidth(v)), vec2(1e-5));
    float frame = max(lineAt(min(u, size.x - u) - 0.05, 0.012, px.x), lineAt(min(v, size.y - v) - 0.05, 0.012, px.y));
    float inside = step(0.06, u) * step(u, size.x - 0.06) * step(0.08, v) * step(v, size.y - 0.08);
    float bandH = 0.175;
    float bi = floor((v - 0.08) / bandH);
    float bv = fract((v - 0.08) / bandH);
    float type = hash21(vec2(bi * 1.7 + design * 31.0, design * 7.0 + 3.0));
    float bandEdge = gridLines(v - 0.08, bandH, 0.006);
    float pat = 0.0;
    float led = 0.0;
    if (type < 0.4) {
      // Drive row: vertical slots.
      pat = gridLines(u, 0.045, 0.006) * step(0.12, bv) * step(bv, 0.88);
      // Activity LEDs at the left end of each slot.
      float slotI = floor(u / 0.045);
      float blink = step(0.55, fract(hash21(vec2(slotI, bi + design * 50.0)) + uT * floor(1.0 + hash21(vec2(bi, slotI)) * 4.0)));
      vec2 q = vec2(fract(u / 0.045) - 0.5, bv - 0.2);
      led = smoothstep(0.012, 0.0, length(q * vec2(0.045, bandH)) - 0.004) * blink * step(0.7, hash21(vec2(slotI * 3.1, bi)));
    } else if (type < 0.75) {
      // Vent grille: fine horizontal slits.
      pat = gridLines(v, 0.018, 0.004) * step(0.1, bv) * step(bv, 0.9) * step(0.15, u) * step(u, size.x - 0.4) * 0.8;
    } else if (type < 0.9) {
      // Blank panel with a handle line and a status LED.
      pat = lineAt(abs(bv - 0.5) * bandH, 0.006, px.y) * step(size.x - 0.32, u) * step(u, size.x - 0.12);
      vec2 q = vec2(u - 0.14, (bv - 0.5) * bandH);
      led = smoothstep(0.01, 0.0, length(q) - 0.006) * 0.8;
    }
    // Each unit's faceplate has its own shade; a lighter bevel on its top edge.
    float plate = 0.35 + 0.7 * hash21(vec2(bi * 3.7, design * 11.0 + 1.0));
    float bevel = smoothstep(0.85, 1.0, bv) * 1.2;
    c = uRack * (0.45 * plate + bevel * inside + 2.0 * pat * inside) + vec3(0.04, 0.045, 0.05) * frame + uRack * 0.9 * bandEdge * inside;
    c += uGlow * 0.6 * lineAt(size.y - v, 0.006, px.y) + vec3(0.1, 0.25, 0.6) * 0.15 * lineAt(min(u, size.x - u), 0.008, px.x);
    c += uGlow * led * 2.5 * inside;
    // Edge sheen from the glow in front.
    c += uGlow * 0.035 * smoothstep(0.6, 1.8, v);
  } else if (vN.y > 0.5) {
    c = uRack * 0.9 + uGlow * 0.04;
  } else {
    // Sides: panel seams.
    float v = vLocal.y;
    float z = vLocal.z;
    vec2 px = max(vec2(fwidth(z), fwidth(v)), vec2(1e-5));
    c = uRack * 0.6 + vec3(0.03) * gridLines(z + size.z * 0.5, size.z / 3.0, 0.006);
  }
  // Fade far cabinets into black.
  float d = length(vWorld - cameraPosition);
  c *= exp(-max(d - 7.0, 0.0) / 6.5);
  gl_FragColor = vec4(c * uDim, 1.0);
}`;

const chipVert = /* glsl */ `
uniform float uMirror;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  w.y *= uMirror;
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// The chip card: everything except the "AI" letters is a distance field, so
// it stays crisp at any resolution. Plane is 1.7 x 2.9 m; the chip body is a
// 0.9 m rounded square at its centre, with traces running up and down.
const chipFrag = /* glsl */ `
${GLSL_LINES}
uniform sampler2D uText;
uniform vec3 uGlow;
uniform vec3 uTextC;
uniform float uBreath;
uniform float uDim;
varying vec2 vUv;
varying vec3 vWorld;
float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 p = (vUv - 0.5) * vec2(1.7, 2.9);
  float px = max(fwidth(p.x), 1e-5);
  float d = sdRound(p, vec2(0.45), 0.08);
  float body = 1.0 - smoothstep(-px, px, d);
  float outline = lineAt(abs(d), 0.012, px);
  float inner = lineAt(abs(sdRound(p, vec2(0.37), 0.05)), 0.006, px);
  // Pins: short stubs on each side of the chip.
  float pins = 0.0;
  for (int i = 0; i < 5; i++) {
    float o = (float(i) - 2.0) * 0.16;
    pins = max(pins, lineAt(length(vec2(max(abs(p.x) - 0.6, 0.0) + max(0.45 - abs(p.x), 0.0), p.y - o)), 0.011, px));
    pins = max(pins, lineAt(length(vec2(p.x - o, max(abs(p.y) - 0.6, 0.0) + max(0.45 - abs(p.y), 0.0))), 0.011, px));
  }
  // Pads at the pin ends.
  for (int i = 0; i < 5; i++) {
    float o = (float(i) - 2.0) * 0.16;
    pins = max(pins, 1.0 - smoothstep(0.022 - px, 0.022 + px, length(vec2(abs(p.x) - 0.62, p.y - o))));
  }
  // Traces from the top/bottom pins out to the rack top and the floor, with a jog.
  float tr = 0.0;
  for (int i = 0; i < 4; i++) {
    float o = (float(i) - 1.5) * 0.16 + 0.08;
    float jog = (float(i) - 1.5) * 0.08;
    float xUp = p.y < 0.95 ? o : o + jog * smoothstep(0.95, 1.1, p.y);
    tr = max(tr, lineAt(abs(p.x - xUp), 0.008, px) * step(0.6, p.y) * step(p.y, 0.92));
    float xDn = p.y > -0.95 ? o : o - jog * smoothstep(-0.95, -1.1, p.y);
    tr = max(tr, lineAt(abs(p.x - xDn), 0.008, px) * step(p.y, -0.6));
  }
  // Bottom traces turn sideways along the base.
  float baseY = -1.06;
  for (int i = 0; i < 4; i++) {
    float o = (float(i) - 1.5) * 0.16 + 0.08;
    float yy = baseY + float(i) * 0.025;
    tr = max(tr, lineAt(abs(p.y - yy), 0.008, px) * step(o, p.x) * step(p.x, 0.85) * step(p.y, -0.6));
  }
  tr *= step(p.y, 0.93) * step(-1.07, p.y);
  for (int i = 0; i < 5; i++) {
    float o = (float(i) - 2.0) * 0.16;
    pins = max(pins, lineAt(abs(length(vec2(p.x - 0.68, p.y - o)) - 0.03), 0.008, px));
  }
  vec2 tuv = p / 0.95 + 0.5;
  float txt = 0.0;
  if (all(greaterThan(tuv, vec2(0.0))) && all(lessThan(tuv, vec2(1.0)))) txt = texture2D(uText, tuv).r;
  vec3 c = vec3(0.01, 0.05, 0.1) * body + uGlow * (body * 0.15 + outline * 2.4 + inner * 0.8 + pins * 1.6 + tr * 1.3);
  // Letters: bright face with a blue fall-off toward the bottom (extruded look).
  vec3 tcol = mix(vec3(0.35, 0.62, 1.0), uTextC, smoothstep(-0.35, 0.1, p.y));
  c += tcol * txt * 3.2;
  c *= uBreath;
  float dist = length(vWorld - cameraPosition);
  c *= exp(-max(dist - 7.0, 0.0) / 8.0);
  gl_FragColor = vec4(c * uDim, 1.0);
}`;

function makeTextTexture() {
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 1024;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, 1024, 1024);
  g.fillStyle = "#fff";
  g.font = '700 540px "Inter"';
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("AI", 512, 545);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

const Scene: React.FC<AIServerRowProps> = (p) => {
  const row = useRef<THREE.Group>(null);
  const mirror = useRef<THREE.Group>(null);

  const m = useMemo(() => {
    // Cabinets: two per bay, the second a touch taller. Identical every bay,
    // so moving one bay is a perfect loop.
    const base = new THREE.BoxGeometry(1, 1, 1);
    base.translate(0, 0.5, -0.5);
    const off: number[] = [];
    const par: number[] = [];
    for (let b = BAYS_FROM; b <= BAYS_TO; b++) {
      off.push(b * S - CAB_W / 2 - 0.03, 0, 0);
      par.push(0, 1);
      off.push(b * S + CAB_W / 2 + 0.03, 0, 0);
      par.push(1, 1.07);
    }
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute("position", base.getAttribute("position"));
    geo.setAttribute("normal", base.getAttribute("normal"));
    geo.setAttribute("iOffset", new THREE.InstancedBufferAttribute(new Float32Array(off), 3));
    geo.setAttribute("iParams", new THREE.InstancedBufferAttribute(new Float32Array(par), 2));
    geo.instanceCount = off.length / 3;
    const rackMat = (mir: number, dim: number) =>
      new THREE.ShaderMaterial({
        vertexShader: rackVert,
        fragmentShader: rackFrag,
        uniforms: { uRack: { value: lin(p.rack) }, uGlow: { value: lin(p.glow) }, uT: { value: 0 }, uDim: { value: dim }, uMirror: { value: mir } },
        side: mir < 0 ? THREE.BackSide : THREE.FrontSide,
      });
    const text = makeTextTexture();
    const chipMat = (mir: number, dim: number) =>
      new THREE.ShaderMaterial({
        vertexShader: chipVert,
        fragmentShader: chipFrag,
        uniforms: { uText: { value: text }, uGlow: { value: lin(p.glow) }, uTextC: { value: lin(p.text) }, uBreath: { value: 1 }, uDim: { value: dim }, uMirror: { value: mir } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
    const bays = Array.from({ length: BAYS_TO - BAYS_FROM + 1 }, (_, i) => BAYS_FROM + i);

    // ~30 light streaks running along the row, in the camera's frame (so they
    // loop on their own whole cycles while the racks shift one bay).
    const r = mulberry32(p.seed);
    const N = 30;
    const sp = new THREE.PlaneGeometry(1, 1);
    const sg = new THREE.InstancedBufferGeometry();
    sg.index = sp.index;
    sg.setAttribute("position", sp.getAttribute("position"));
    sg.setAttribute("uv", sp.getAttribute("uv"));
    const a = new Float32Array(N * 4);
    const b = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      // Most streaks run at chip height through the chips; a few higher/lower.
      const y = r() < 0.7 ? range(r, 0.95, 1.55) : range(r, 0.3, 2.3);
      const z = r() < 0.75 ? range(r, 0.3, 0.55) : range(r, -0.1, 1.2);
      a.set([y, z, r(), range(r, 2.5, 9)], i * 4);
      b.set([1 + Math.floor(r() * 3), range(r, 0.01, 0.03), range(r, 0.8, 2.0), r()], i * 4);
    }
    sg.setAttribute("aA", new THREE.InstancedBufferAttribute(a, 4));
    sg.setAttribute("aB", new THREE.InstancedBufferAttribute(b, 4));
    sg.instanceCount = N;
    const SPAN = 60;
    const streakMat = (mir: number, dim: number) =>
      new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uC: { value: lin(p.glow) }, uDim: { value: dim }, uMirror: { value: mir } },
        vertexShader: /* glsl */ `
          attribute vec4 aA;
          attribute vec4 aB;
          uniform float uT;
          uniform float uMirror;
          varying vec2 vUv;
          varying float vB;
          varying float vHue;
          void main() {
            vUv = uv;
            vHue = aB.w;
            float x = ${(BAYS_TO * S).toFixed(2)} - mod(aA.z * ${SPAN.toFixed(1)} + aB.x * ${SPAN.toFixed(1)} * uT, ${SPAN.toFixed(1)});
            vec3 p = vec3(x + position.x * aA.w, aA.x + position.y * aB.y, aA.y);
            vec4 w = modelMatrix * vec4(p, 1.0);
            w.y *= uMirror;
            vB = aB.z * exp(-max(length(w.xyz - cameraPosition) - 7.0, 0.0) / 9.0);
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uC;
          uniform float uDim;
          varying vec2 vUv;
          varying float vB;
          varying float vHue;
          void main() {
            float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
            float head = smoothstep(0.0, 0.85, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
            vec3 cc = mix(uC, vec3(0.2, 0.7, 1.0), step(0.7, vHue));
            gl_FragColor = vec4(cc * 2.6 * across * head * vB * uDim, 1.0);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });

    const floorMat = new THREE.ShaderMaterial({
      uniforms: { uGlow: { value: lin(p.glow) } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uGlow;
        varying vec3 vW;
        void main() {
          // Glossy black: mostly lets the mirrored scene through, with a faint
          // teal sheen near the racks.
          float sheen = exp(-abs(vW.z - 0.8) / 2.0) * 0.28;
          vec3 blue = vec3(0.03, 0.1, 0.3);
          gl_FragColor = vec4((uGlow * 0.4 + blue) * sheen, 0.6);
        }`,
      transparent: true,
      depthWrite: true,
    });
    return {
      geo,
      rackM: rackMat(1, 1),
      rackMir: rackMat(-1, 0.6),
      chipM: chipMat(1, 1),
      chipMir: chipMat(-1, 0.55),
      bays,
      sg,
      streakM: streakMat(1, 1),
      streakMir: streakMat(-1, 0.55),
      floorMat,
    };
  }, [p.seed, p.rack, p.glow, p.text]);

  const chipZ = 0.42;
  const chipY = 1.3;
  const chips = (mat: THREE.ShaderMaterial) =>
    m.bays.map((b) => (
      <mesh key={b} material={mat} position={[b * S, chipY, chipZ]} scale={1.2} renderOrder={3}>
        <planeGeometry args={[1.7, 2.9]} />
      </mesh>
    ));

  return (
    <>
      <group ref={mirror}>
        <mesh geometry={m.geo} material={m.rackMir} frustumCulled={false} renderOrder={0} />
        {chips(m.chipMir)}
      </group>
      <mesh geometry={m.sg} material={m.streakMir} frustumCulled={false} renderOrder={0} />
      <mesh material={m.floorMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} renderOrder={1}>
        <planeGeometry args={[200, 200]} />
      </mesh>
      <group ref={row}>
        <mesh geometry={m.geo} material={m.rackM} frustumCulled={false} renderOrder={2} />
        {chips(m.chipM)}
      </group>
      <mesh geometry={m.sg} material={m.streakM} frustumCulled={false} renderOrder={4} />
      <Driver
        post={{
          period: PERIOD,
          background: "#000",
          exposure: 1,
          bloom: { intensity: 1.2, threshold: 0.3, smoothing: 0.3, radius: 0.8, levels: 7 },
          dof: { focus: 6.4, range: 1.8, bokeh: 4.5 },
          grain: 0.015,
        }}
        update={(frame, cam) => {
          const f = frame % PERIOD;
          const t = f / PERIOD;
          // Track along the row: the row shifts +x by one bay per loop.
          const x = t * S;
          row.current!.position.x = x;
          mirror.current!.position.x = x;
          [m.rackM, m.rackMir].forEach((mat) => (mat.uniforms.uT.value = t));
          [m.streakM, m.streakMir].forEach((mat) => (mat.uniforms.uT.value = t));
          // Breathing: whole cycles per loop, phase by bay so it ripples down
          // the row. A bay moves one slot per loop, so the phase advances by
          // exactly one bay's offset: use whole-bay phase steps of 2π.
          const breath = 0.86 + 0.14 * Math.sin(TAU * 3 * t);
          [m.chipM, m.chipMir].forEach((mat) => (mat.uniforms.uBreath.value = breath));
          cam.fov = 40;
          cam.position.set(1.4 + 0.06 * loopSin(f, PERIOD, 1), 1.0 + 0.03 * loopSin(f, PERIOD, 1, 1), 5.4);
          cam.lookAt(-2.6, 1.3, 0.1);
          cam.rotateZ(0.4 * loopSin(f, PERIOD, 1, 2) * (TAU / 360));
        }}
      />
    </>
  );
};

export const AIServerRow: React.FC<AIServerRowProps> = (p) => {
  const ready = useFontsReady();
  if (!ready) return null;
  return (
    <Stage fov={40} near={0.1} far={200}>
      <Scene {...p} />
    </Stage>
  );
};
