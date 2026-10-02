import * as THREE from "three";
import { GlobeVersion } from "../versions";
import { Land, landMask } from "../lib/landmask";
import { hash01, mulberry32, TAU } from "../lib/random";
import { lin, makePoints, makeSegments, quadGeometry, RIBBON_CHUNK, Seg, syncResolution } from "../lib/three/lines";
import { makeTextAtlas } from "../lib/three/text";
import { World } from "../lib/three/Stage";

const LOOP = 600;
const R = 1; // globe radius

const sph = (lon: number, lat: number, r = R): THREE.Vector3Tuple => {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return [r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo)];
};

// ---------- background (screen-space gradient) ----------
const bgMesh = (center: string, edge: string) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const m = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `in vec3 position; out vec2 vUv; void main(){ vUv = position.xy*0.5+0.5; gl_Position = vec4(position.xy, 0.999, 1.0); }`,
    fragmentShader: `precision highp float; uniform vec3 cA; uniform vec3 cB; uniform float aspect; in vec2 vUv; out vec4 o;
      void main(){ vec2 p = (vUv - vec2(0.5, 0.55)) * vec2(aspect, 1.0);
        float d = length(p);
        vec3 c = mix(cA, cB, smoothstep(0.0, 1.25, d));
        c += cA * 0.22 * exp(-pow((vUv.x-0.5)*aspect*3.0, 2.0)) * smoothstep(0.2, 1.0, vUv.y);
        o = vec4(c, 1.0); }`,
    uniforms: { cA: { value: new THREE.Vector3(...lin(center)) }, cB: { value: new THREE.Vector3(...lin(edge)) }, aspect: { value: 16 / 9 } },
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
};

// ---------- light beam + flare (screen space) ----------
const beamMesh = (col: string, accent: string) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const m = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `in vec3 position; out vec2 vUv; void main(){ vUv = position.xy*0.5+0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `precision highp float; uniform vec3 c1; uniform vec3 c2; uniform float aspect; uniform float pulse; in vec2 vUv; out vec4 o;
      void main(){
        vec2 p = vec2((vUv.x - 0.5) * aspect, 1.0 - vUv.y); // p.y = distance from top edge
        float fall = smoothstep(0.62, 0.0, p.y);
        float w = 0.012 + p.y * 0.07;
        float core = exp(-pow(p.x / (w * 0.35), 2.0)) * fall;
        float soft = exp(-pow(p.x / (w * 2.2), 2.0)) * smoothstep(0.75, 0.0, p.y) * 0.35;
        float r = length(p);
        float flare = exp(-r * 40.0) * 3.0 + exp(-r * 9.0) * 0.6;
        float streakH = exp(-abs(p.y) * 900.0) * exp(-abs(p.x) * 7.0) * 1.2;
        float streakV = exp(-abs(p.x) * 300.0) * exp(-p.y * 9.0) * 1.2;
        vec3 c = c1 * (core * 1.4 + soft) + c2 * (flare + streakH + streakV);
        o = vec4(c * pulse, 1.0);
      }`,
    uniforms: { c1: { value: new THREE.Vector3(...lin(col)) }, c2: { value: new THREE.Vector3(...lin(accent)).addScalar(0.35) }, aspect: { value: 16 / 9 }, pulse: { value: 1 } },
    depthTest: false,
    depthWrite: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 50;
  return mesh;
};

// ---------- globe ocean / rim ----------
const oceanMesh = (primary: string, edge: string) => {
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `out vec3 vN; out vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `precision highp float; uniform vec3 cP; uniform vec3 cD; in vec3 vN; in vec3 vV; out vec4 o;
      void main(){ float f = 1.0 - max(dot(normalize(vN), normalize(vV)), 0.0);
        vec3 c = cD + cP * (0.05 + 0.5 * pow(f, 3.0)) + cP * 2.4 * pow(f, 14.0);
        o = vec4(c, 0.82); }`,
    uniforms: { cP: { value: new THREE.Vector3(...lin(primary)) }, cD: { value: new THREE.Vector3(...lin(edge)).multiplyScalar(0.6) } },
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R * 0.995, 128, 64), m);
  mesh.renderOrder = 1;
  return mesh;
};

// atmosphere halo (back-facing shell)
const haloMesh = (accent: string) => {
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `out vec3 vN; out vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `precision highp float; uniform vec3 c; in vec3 vN; in vec3 vV; out vec4 o;
      void main(){ float d = max(dot(normalize(-vN), normalize(vV)), 0.0); float k = pow(1.0 - d, 2.0) * smoothstep(0.0, 0.35, d); o = vec4(c * k * 0.45, 1.0); }`,
    uniforms: { c: { value: new THREE.Vector3(...lin(accent)) } },
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 96, 48), m);
  mesh.renderOrder = 0;
  return mesh;
};

// ---------- radiating streaks (instanced, fully periodic) ----------
const STREAK_VERT = /* glsl */ `
${RIBBON_CHUNK}
in vec3 position;
in vec3 aDir; in vec4 aP; in vec3 aCol; // aP: r0, travel, len, phase
in float aPeriod;
uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix;
uniform float uFrame; uniform float uWidth;
out vec4 vCol; out float vSide; out float vHalfW; out float vT;
void main(){
  float ph = fract(mod(uFrame, aPeriod) / aPeriod + aP.w);
  float head = aP.x + aP.y * ph;
  float tail = max(aP.x, head - aP.z);
  vec3 a = aDir * tail; vec3 b = aDir * head;
  vec4 ca = projectionMatrix * modelViewMatrix * vec4(a, 1.0);
  vec4 cb = projectionMatrix * modelViewMatrix * vec4(b, 1.0);
  float as, hw;
  gl_Position = ribbon(ca, cb, position.x, position.y, uWidth, as, hw);
  float env = smoothstep(0.0, 0.12, ph) * (1.0 - smoothstep(0.7, 1.0, ph));
  vCol = vec4(aCol, env * as);
  vSide = position.y; vHalfW = hw; vT = position.x;
}`;
const STREAK_FRAG = /* glsl */ `
precision highp float;
in vec4 vCol; in float vSide; in float vHalfW; in float vT; out vec4 o;
void main(){
  float px = abs(vSide) * vHalfW;
  float a = clamp(vHalfW - 0.75 - px + 0.5, 0.0, 1.0);
  float along = pow(vT, 2.6) * 0.8 + smoothstep(0.96, 1.0, vT) * 2.5;
  o = vec4(vCol.rgb * vCol.a * a * along, 1.0);
}`;

const streaks = (n: number, primary: string, accent: string) => {
  const rnd = mulberry32(1701);
  const g = quadGeometry();
  const dir = new Float32Array(n * 3);
  const P = new Float32Array(n * 4);
  const C = new Float32Array(n * 3);
  const per = new Float32Array(n);
  const periods = [150, 200, 300, 600];
  for (let i = 0; i < n; i++) {
    // biased towards the screen plane so most streaks read as radiating
    const th = rnd() * TAU;
    const z = (rnd() * 2 - 1) * 0.75;
    const s = Math.sqrt(1 - z * z);
    dir.set([Math.cos(th) * s, Math.sin(th) * s * 0.9, z], i * 3);
    P.set([R * (1.05 + rnd() * 0.4), 2.5 + rnd() * 5.5, 0.6 + rnd() * 1.8, rnd()], i * 4);
    const c = rnd() < 0.55 ? lin(accent, 0.8 + rnd() * 0.8) : lin(primary, 1.0 + rnd());
    C.set(c, i * 3);
    per[i] = periods[Math.floor(rnd() * periods.length)];
  }
  g.setAttribute("aDir", new THREE.InstancedBufferAttribute(dir, 3));
  g.setAttribute("aP", new THREE.InstancedBufferAttribute(P, 4));
  g.setAttribute("aCol", new THREE.InstancedBufferAttribute(C, 3));
  g.setAttribute("aPeriod", new THREE.InstancedBufferAttribute(per, 1));
  g.instanceCount = n;
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: STREAK_VERT,
    fragmentShader: STREAK_FRAG,
    uniforms: {
      uRes: { value: new THREE.Vector2() },
      uPxScale: { value: 1 },
      uFrame: { value: 0 },
      uWidth: { value: 1.5 },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  m.renderOrder = 5;
  return m;
};

// ---------- keyword tags (billboards with per-tag defocus) ----------
const TAG_VERT = /* glsl */ `
in vec3 position; // corner -0.5..0.5
in vec3 aPos; in vec4 aUV; in vec2 aSize; in vec2 aOrbit; // aOrbit: turns per loop, alpha
uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix; uniform mat4 viewMatrix;
uniform float uFrame; uniform float uFocus; uniform float uFocusRange;
out vec2 vUv; out float vA; out float vLod;
void main(){
  float ang = 6.283185307 * aOrbit.x * uFrame / 600.0;
  float c = cos(ang), s = sin(ang);
  vec3 p = vec3(aPos.x * c + aPos.z * s, aPos.y, -aPos.x * s + aPos.z * c);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  mv.xy += position.xy * aSize;
  gl_Position = projectionMatrix * mv;
  vUv = mix(aUV.xy, aUV.zw, position.xy + 0.5);
  float dz = abs(-mv.z - uFocus) / uFocusRange;
  vLod = clamp(dz * 3.2, 0.0, 4.5);
  vA = aOrbit.y * mix(1.0, 0.45, clamp(dz, 0.0, 1.0));
  // dim tags hidden behind the globe
  vec3 gc = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 tp = (modelViewMatrix * vec4(p, 1.0)).xyz;
  vec3 ray = normalize(tp);
  float tc = dot(gc, ray);
  float miss = length(gc - ray * tc);
  float behind = step(tc, length(tp)) * (1.0 - smoothstep(0.92, 1.08, miss));
  vA *= 1.0 - 0.85 * behind;
}`;
const TAG_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D map; in vec2 vUv; in float vA; in float vLod; out vec4 o;
void main(){
  vec4 t = textureLod(map, vUv, vLod + 0.3);
  o = vec4(t.rgb * t.a * vA * 1.25, 1.0);
}`;

export const buildGlobeWorld = (v: GlobeVersion, land: Land): World => {
  const root = new THREE.Group();
  const rnd = mulberry32(42);

  root.add(bgMesh(v.bgCenter, v.bgEdge));

  // tilt + spin group
  const tilt = new THREE.Group();
  tilt.rotation.z = (-14 * Math.PI) / 180;
  tilt.rotation.x = (10 * Math.PI) / 180;
  const spin = new THREE.Group();
  tilt.add(spin);
  root.add(tilt);

  spin.add(oceanMesh(v.primary, v.bgEdge));
  root.add(haloMesh(v.accent));

  // land dots (fibonacci sphere sampled against the Natural Earth mask)
  const mask = landMask(land);
  const N = 70000;
  const pos: number[] = [];
  const col: number[] = [];
  const size: number[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const cLand = lin(v.accent, 1.0);
  const cBright = lin("#FFFFFF", 1.2);
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const x = Math.cos(th) * r;
    const z = Math.sin(th) * r;
    const lat = (Math.asin(y) * 180) / Math.PI;
    const lon = (Math.atan2(x, z) * 180) / Math.PI;
    if (!mask(lon, lat)) continue;
    pos.push(x * R * 1.002, y * R * 1.002, z * R * 1.002);
    const b = hash01(i, 3) < 0.06;
    const c = b ? cBright : cLand;
    col.push(c[0], c[1], c[2], 0.55 + hash01(i, 9) * 0.45);
    size.push(b ? 5 : 3.2);
  }
  const landPts = makePoints(new Float32Array(pos), new Float32Array(col), new Float32Array(size), {
    size: 1,
    soft: 0.7,
    facing: 0.12,
  });
  landPts.renderOrder = 3;
  spin.add(landPts);

  // coastlines
  const coast: Seg[] = [];
  const cc: THREE.Vector4Tuple = [...lin(v.accent, 0.9), 1] as THREE.Vector4Tuple;
  for (const poly of land.polygons) {
    for (const ring of poly) {
      const step = ring.length > 400 ? 3 : ring.length > 60 ? 2 : 1;
      for (let i = 0; i + step < ring.length; i += step) {
        const [lo1, la1] = ring[i];
        const [lo2, la2] = ring[i + step];
        if (Math.abs(lo1 - lo2) > 90) continue;
        coast.push({ a: sph(lo1, la1, R * 1.003), b: sph(lo2, la2, R * 1.003), ca: cc });
      }
    }
  }
  const coastMesh = makeSegments(coast, { width: 2.2, facing: 0.1 });
  coastMesh.renderOrder = 4;
  spin.add(coastMesh);

  // graticule: a few dotted latitude / longitude lines
  const grat: Seg[] = [];
  const gc: THREE.Vector4Tuple = [...lin(v.primary, 0.35), 1] as THREE.Vector4Tuple;
  for (let lat = -60; lat <= 60; lat += 30) {
    for (let lon = -180; lon < 180; lon += 3) grat.push({ a: sph(lon, lat, R * 1.004), b: sph(lon + 1.5, lat, R * 1.004), ca: gc });
  }
  for (let lon = -180; lon < 180; lon += 30) {
    for (let lat = -84; lat < 84; lat += 3) grat.push({ a: sph(lon, lat, R * 1.004), b: sph(lon, lat + 1.5, R * 1.004), ca: gc });
  }
  const gratMesh = makeSegments(grat, { width: 1.6, facing: 0.15 });
  gratMesh.renderOrder = 4;
  spin.add(gratMesh);

  // rings (horizontal, around the globe), whole turns per loop
  const rings: { obj: THREE.Object3D; turns: number }[] = [];
  const ringDefs = [
    { y: 0.0, r: 1.42, dashed: false, turns: 1, k: 1.3 },
    { y: 0.18, r: 1.33, dashed: true, turns: -1, k: 1.0 },
    { y: -0.2, r: 1.36, dashed: false, turns: 2, k: 0.8 },
    { y: 0.42, r: 1.22, dashed: true, turns: 1, k: 0.9 },
    { y: -0.45, r: 1.2, dashed: true, turns: -2, k: 0.9 },
    { y: 0.66, r: 0.98, dashed: false, turns: -1, k: 0.7 },
    { y: -0.68, r: 0.95, dashed: false, turns: 1, k: 0.7 },
    { y: 0.86, r: 0.7, dashed: true, turns: 2, k: 0.6 },
    { y: -0.88, r: 0.66, dashed: true, turns: -1, k: 0.6 },
    { y: 0.08, r: 1.62, dashed: true, turns: 1, k: 0.6 },
    { y: -0.06, r: 1.78, dashed: false, turns: -1, k: 0.35 },
  ];
  const ringGroup = new THREE.Group();
  ringGroup.rotation.z = (-6 * Math.PI) / 180;
  for (const d of ringDefs) {
    const segs: Seg[] = [];
    const n = 360;
    for (let i = 0; i < n; i++) {
      if (d.dashed && i % 6 >= 3) continue;
      const a0 = (i / n) * TAU;
      const a1 = ((i + 1) / n) * TAU;
      // brightness varies along the ring so rotation reads
      const br = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.cos(a0 * 2 + d.y * 7), 2);
      const c: THREE.Vector4Tuple = [...lin(i % 90 < 6 ? "#FFFFFF" : v.accent, d.k * br), 1] as THREE.Vector4Tuple;
      segs.push({ a: [Math.cos(a0) * d.r, 0, Math.sin(a0) * d.r], b: [Math.cos(a1) * d.r, 0, Math.sin(a1) * d.r], ca: c });
    }
    // tick marks
    if (!d.dashed) {
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * TAU;
        const r2 = d.r + (i % 6 === 0 ? 0.06 : 0.025);
        segs.push({
          a: [Math.cos(a) * d.r, 0, Math.sin(a) * d.r],
          b: [Math.cos(a) * r2, 0, Math.sin(a) * r2],
          ca: [...lin(v.accent, d.k * 0.6), 1] as THREE.Vector4Tuple,
        });
      }
    }
    const m = makeSegments(segs, { width: d.dashed ? 2.4 : 2.0 });
    m.renderOrder = 6;
    const holder = new THREE.Group();
    holder.position.y = d.y;
    holder.add(m);
    ringGroup.add(holder);
    rings.push({ obj: m, turns: d.turns });
  }
  root.add(ringGroup);

  // radiating streaks + heads
  const streak = streaks(620, v.primary, v.accent);
  root.add(streak);

  // particles (static field, slowly rotating whole turns)
  const pc = 1600;
  const pp = new Float32Array(pc * 3);
  const pcol = new Float32Array(pc * 4);
  const ps = new Float32Array(pc);
  for (let i = 0; i < pc; i++) {
    const rr = 2 + rnd() * 9;
    const th = rnd() * TAU;
    const y = (rnd() * 2 - 1) * 5;
    pp.set([Math.cos(th) * rr, y, Math.sin(th) * rr - 2], i * 3);
    const c = rnd() < 0.5 ? lin(v.accent, 1.2) : lin(v.primary, 1.5);
    pcol.set([...c, 0.25 + rnd() * 0.75], i * 4);
    ps[i] = 2 + rnd() * 5;
  }
  const particles = makePoints(pp, pcol, ps, { size: 1, soft: 0.8, perspective: 7.5 });
  particles.renderOrder = 2;
  const particleSpin = new THREE.Group();
  particleSpin.add(particles);
  root.add(particleSpin);

  // keyword tags + tiny numbers
  const numbers = ["178.25", "204.36", "019.07", "331.80", "092.14", "+0.381", "7F-2A", "64.002"];
  const atlas = makeTextAtlas(
    [
      ...v.keywords.map((k) => ({ text: k, font: "600 {px} Inter", color: v.tag, letterSpacing: 0.12, marker: v.accent })),
      ...numbers.map((k) => ({ text: k, font: "400 {px} JetBrains Mono", color: v.accent })),
    ],
    96,
    2048,
  );
  const tagCount = 150;
  const numCount = 26;
  const total = tagCount + numCount;
  const tg = quadGeometry();
  tg.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3),
  );
  const aPos = new Float32Array(total * 3);
  const aUV = new Float32Array(total * 4);
  const aSize = new Float32Array(total * 2);
  const aOrbit = new Float32Array(total * 2);
  const trnd = mulberry32(77);
  for (let i = 0; i < total; i++) {
    const isNum = i >= tagCount;
    const ent = isNum ? atlas.entries[v.keywords.length + (i % numbers.length)] : atlas.entries[i % v.keywords.length];
    let p: THREE.Vector3Tuple;
    if (isNum) {
      p = [(trnd() * 2 - 1) * 7, (trnd() * 2 - 1) * 3.6, -3 - trnd() * 4];
    } else {
      // shell around the globe, denser close to it
      const rr = 1.35 + Math.pow(trnd(), 1.6) * 2.6;
      const th = trnd() * TAU;
      const y = (trnd() * 2 - 1) * Math.min(1.5, rr * 0.75);
      const h = Math.sqrt(Math.max(0.05, rr * rr - y * y));
      p = [Math.cos(th) * h, y, Math.sin(th) * h];
    }
    aPos.set(p, i * 3);
    aUV.set([ent.u0, ent.v0, ent.u1, ent.v1], i * 4);
    const hgt = isNum ? 0.055 : (0.075 + trnd() * 0.05) * (i % 7 === 0 ? 1.5 : 1);
    aSize.set([hgt * ent.aspect, hgt], i * 2);
    aOrbit.set([isNum ? 0 : 1, isNum ? 0.6 : 0.75 + trnd() * 0.25], i * 2);
  }
  tg.setAttribute("aPos", new THREE.InstancedBufferAttribute(aPos, 3));
  tg.setAttribute("aUV", new THREE.InstancedBufferAttribute(aUV, 4));
  tg.setAttribute("aSize", new THREE.InstancedBufferAttribute(aSize, 2));
  tg.setAttribute("aOrbit", new THREE.InstancedBufferAttribute(aOrbit, 2));
  tg.instanceCount = total;
  const tagMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: TAG_VERT,
    fragmentShader: TAG_FRAG,
    uniforms: {
      map: { value: atlas.tex },
      uFrame: { value: 0 },
      uFocus: { value: 7.6 },
      uFocusRange: { value: 2.2 },
      viewMatrix: { value: new THREE.Matrix4() },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const tags = new THREE.Mesh(tg, tagMat);
  tags.frustumCulled = false;
  tags.renderOrder = 8;
  const tagGroup = new THREE.Group();
  tagGroup.rotation.z = (-6 * Math.PI) / 180;
  tagGroup.add(tags);
  root.add(tagGroup);

  const beam = beamMesh(v.primary, v.accent);
  root.add(beam);

  return {
    root,
    grainSeed: (f) => f % LOOP,
    update: (frame, cam) => {
      const lf = frame % LOOP;
      const t = lf / LOOP; // 0..1 over the loop
      spin.rotation.y = TAU * t; // exactly one turn
      rings.forEach((r) => (r.obj.rotation.y = TAU * r.turns * t));
      particleSpin.rotation.y = -TAU * t;
      (streak.material as THREE.RawShaderMaterial).uniforms.uFrame.value = lf;
      tagMat.uniforms.uFrame.value = lf;
      (beam.material as THREE.RawShaderMaterial).uniforms.pulse.value = 0.92 + 0.08 * Math.sin(TAU * 3 * t);
      // camera: gentle periodic drift
      cam.fov = 35;
      cam.position.set(Math.sin(TAU * t) * 0.35, 0.55 + Math.sin(TAU * 2 * t) * 0.08, 7.6);
      cam.lookAt(0, 0.05, 0);
      return {
        bloomStrength: 0.75,
        bloomThreshold: 0.45,
        bloomWeights: [0.35, 0.3, 0.25, 0.18, 0.12],
        exposure: v.exposure,
        grain: 0.02,
        vignette: 0.25,
        lift: [0, 0, 0],
        dof: { mode: "radial", center: [0.5, 0.5], inner: 0.45, outer: 1.05, strength: 0.6 },
      };
    },
    syncRes: (w: number, h: number) => syncResolution(root, w, h),
  };
};
