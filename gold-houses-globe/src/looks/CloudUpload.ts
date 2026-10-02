import * as THREE from "three";
import { mulberry32, TAU } from "../lib/random";
import { hdrColor, ribbonGeometry, worldPointsMaterial } from "../lib/three-util";
import { GlossyReflector, REFLECT_GLSL } from "../lib/reflector";
import type { Look } from "../lib/look";

export type CloudParams = { accent: string; bg: string };

// ---- layout (world units; floor is y = 0) -------------------------------
const CAM = new THREE.Vector3(0, 0.9, 14.5);
const LOOK = new THREE.Vector3(0, 3.4, 0);
const FOV = 35;
const CLOUD_Y = 4.65; // cloud centre
const CLOUD_Z = 0;

const rng = mulberry32(0xc10d);

// fibres: fan out across the floor toward the camera, gather at a base in
// front of the cloud, then rise in a bell-shaped bundle into the arrow.
const N_FIB = 48;
type Fibre = { pts: THREE.Vector3[]; sBend: number; rep: number; speed: number; ph: number; br: number; floor: number };
const fibres: Fibre[] = [];
const bez = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, t: number) => {
  const u = 1 - t;
  return a.clone().multiplyScalar(u * u * u)
    .add(b.clone().multiplyScalar(3 * u * u * t))
    .add(c.clone().multiplyScalar(3 * u * t * t))
    .add(d.clone().multiplyScalar(t * t * t));
};
for (let i = 0; i < N_FIB; i++) {
  const u = (i + rng()) / N_FIB; // 0..1 across
  const side = u - 0.5;
  const inStem = Math.abs(side) < 0.12;
  const xt = inStem ? (side / 0.12) * 0.22 : side * 2.7; // x at the cloud's underside
  const zt = CLOUD_Z - 0.06 - rng() * 0.1;
  const xb = side * 7.0 + (rng() - 0.5) * 0.3; // where the fibre leaves the floor
  const zb = 0.9 + rng() * 0.8;
  const x0 = side * 22 + (rng() - 0.5) * 1.5;
  const z0 = 9.6 + rng() * 1.6;
  const yEnd = inStem ? CLOUD_Y + 0.5 - Math.abs(xt) * 1.1 - rng() * 0.3 : CLOUD_Y - 0.6;
  const yTop = CLOUD_Y - 1.35;
  const pts: THREE.Vector3[] = [];
  const NF = 40;
  for (let k = 0; k <= NF; k++) {
    const t = k / NF;
    const e = t * t * (3 - 2 * t) * 0.35 + t * 0.65;
    pts.push(new THREE.Vector3(x0 + (xb - x0) * e, 0.012, z0 + (zb - z0) * t));
  }
  let floorLen = 0;
  for (let k = 1; k < pts.length; k++) floorLen += pts[k].distanceTo(pts[k - 1]);
  const P0 = new THREE.Vector3(xb, 0.012, zb);
  const dir = new THREE.Vector3(xb - x0, 0, zb - z0).normalize();
  const P1 = P0.clone().add(dir.multiplyScalar(1.1 + rng() * 0.5));
  const P3 = new THREE.Vector3(xt, yTop, zt);
  const P2 = new THREE.Vector3(xt, yTop - 2.3 - rng() * 0.5, zt); // long straight drop before fanning out
  let curveLen = 0;
  let prev = P0;
  for (let k = 1; k <= 30; k++) {
    const p = bez(P0, P1, P2, P3, k / 30);
    curveLen += p.distanceTo(prev);
    prev = p;
    pts.push(p);
  }
  for (let k = 1; k <= 12; k++) pts.push(new THREE.Vector3(xt, yTop + ((yEnd - yTop) * k) / 12, zt));
  const total = floorLen + curveLen + (yEnd - yTop);
  fibres.push({
    pts,
    sBend: floorLen / total,
    rep: 4 + Math.floor(rng() * 4),
    speed: 2 + Math.floor(rng() * 4),
    ph: rng(),
    br: 0.6 + rng() * 0.8,
    floor: 1,
  });
}

// floating squares
const N_SQ = 130;
const squares = Array.from({ length: N_SQ }, () => {
  const near = rng() < 0.03;
  const z = near ? -6 + rng() * 14 : -40 + rng() * 34;
  const spread = (CAM.z - z) * 0.75;
  return {
    x: (rng() - 0.5) * 2 * spread,
    y: 0.25 + Math.pow(rng(), 0.45) * (2 + (CAM.z - z) * 0.55),
    z,
    s: 0.3 + rng() * 0.5,
    b: 0.05 + rng() * 0.12,
    ax: 0.1 + rng() * 0.5, ay: 0.1 + rng() * 0.4,
    kx: 1 + Math.floor(rng() * 2), ky: 1 + Math.floor(rng() * 2), tk: 1 + Math.floor(rng() * 5),
    px: rng() * TAU, py: rng() * TAU, tp: rng() * TAU,
  };
});

const CLOUD_GLSL = /* glsl */ `
float sdCircle(vec2 p, vec2 c, float r) { return length(p - c) - r; }
float sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float sdTri(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
  vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                   vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                   vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
float cloudSD(vec2 p) {
  float d = sdRoundBox(p - vec2(0.05, -0.62), vec2(2.75, 0.62), 0.6);
  d = smin(d, sdCircle(p, vec2(0.12, 0.42), 1.38), 0.15);
  d = smin(d, sdCircle(p, vec2(-1.55, -0.2), 0.92), 0.15);
  d = smin(d, sdCircle(p, vec2(1.62, -0.12), 1.0), 0.15);
  return d;
}
float arrowSD(vec2 p) {
  float stem = sdRoundBox(p - vec2(0.0, -1.0), vec2(0.27, 0.9), 0.0);
  float head = sdTri(p, vec2(0.0, 0.36), vec2(-0.7, -0.36), vec2(0.7, -0.36));
  return min(stem, head);
}
float shapeSD(vec2 p) { return max(cloudSD(p), -arrowSD(p)); }
`;

export const CloudUpload: Look<CloudParams> = {
  assets: [],
  create: ({ width, height, params, period }) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0, 0, 0);
    const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.3, 200);
    const accent = new THREE.Color(params.accent); // linear
    const bg = new THREE.Color(params.bg);

    // ---- background: horizon glow + bright horizon line ----
    const bgMat = new THREE.ShaderMaterial({
      uniforms: { accent: { value: accent }, navy: { value: bg } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 accent; uniform vec3 navy; varying vec3 vW;
        void main() {
          float y = vW.y;
          vec3 c = navy * 0.4;
          c += vec3(0.004, 0.06, 0.2) * exp(-max(y, 0.0) / 20.0);
          c += vec3(0.0, 0.07, 0.2) * exp(-max(y, 0.0) / 7.0);
          c += accent * 0.06 * exp(-abs(y) / 1.5);
          c += accent * 0.03 * exp(-abs(y) / 0.6);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const bgPlane = new THREE.Mesh(new THREE.PlaneGeometry(400, 120), bgMat);
    bgPlane.position.set(0, 50, -70);
    scene.add(bgPlane);

    // ---- floor with blurred reflection ----
    const reflector = new GlossyReflector(width, height, 0.5, 0.006, 2);
    const floorMat = new THREE.ShaderMaterial({
      uniforms: {
        tReflect: { value: reflector.texture },
        textureMatrix: { value: reflector.textureMatrix },
        navy: { value: bg },
        accent: { value: accent },
      },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        ${REFLECT_GLSL}
        uniform vec3 navy; uniform vec3 accent; varying vec3 vW;
        void main() {
          vec3 r = sampleReflection(vW, vec2(0.0));
          float far = smoothstep(-10.0, -70.0, vW.z);
          vec3 c = navy * 1.2 + vec3(0.0, 0.04, 0.13) * (0.5 + 0.5 * far) + accent * 0.05 * pow(far, 6.0);
          c += r * 0.35;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 140), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -50);
    scene.add(floor);

    // ---- cloud ----
    const cloudU = {
      accent: { value: accent },
      uTime: { value: 0 },
      glow: { value: 1 },
    };
    const cloudVert = `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
    const cloudGeo = new THREE.PlaneGeometry(9, 6.4);
    // depth-only body so DOF knows where the cloud is (arrow stays open)
    const cloudDepth = new THREE.Mesh(
      cloudGeo,
      new THREE.ShaderMaterial({
        vertexShader: cloudVert,
        fragmentShader: `${CLOUD_GLSL} varying vec2 vP; void main(){ if (shapeSD(vP) > 0.0) discard; gl_FragColor = vec4(0.0); }`,
        colorWrite: false,
      }),
    );
    const cloudMat = new THREE.ShaderMaterial({
      uniforms: cloudU,
      vertexShader: cloudVert,
      fragmentShader: /* glsl */ `
        ${CLOUD_GLSL}
        uniform vec3 accent; uniform float glow;
        varying vec2 vP;
        float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        void main() {
          float d = shapeSD(vP);
          float aa = fwidth(d) * 0.8;
          float inside = 1.0 - smoothstep(-aa, aa, d);
          // body: soft vertical gradient, brighter towards the rim
          float g = smoothstep(-1.4, 1.8, vP.y);
          vec3 tone = mix(accent, vec3(0.08, 0.45, 1.0), 0.3);
          vec3 pale = mix(tone, vec3(1.0), 0.14);
          vec3 body = mix(pale * 0.62, pale * 0.95, g);
          body += pale * 0.5 * (1.0 - smoothstep(0.0, 0.035, -d)); // thin bright rim
          // two darker translucent HUD panels
          vec2 pl = abs(vP - vec2(-1.45, -0.28)) - vec2(0.55, 0.32);
          vec2 pr = abs(vP - vec2(1.5, -0.22)) - vec2(0.5, 0.42);
          float panel = max(step(max(pl.x, pl.y), 0.0), step(max(pr.x, pr.y), 0.0));
          float pedge = max(1.0 - smoothstep(0.0, 0.015, abs(max(pl.x, pl.y))), 1.0 - smoothstep(0.0, 0.015, abs(max(pr.x, pr.y))));
          body = mix(body, body * 0.72, panel) + pale * 0.25 * pedge;
          // faint rows of tiny "data text"
          vec2 tp = vP * vec2(9.0, 14.0);
          vec2 cell = floor(tp);
          float rowOn = step(0.45, h21(vec2(cell.y, 3.0)));
          float wordLen = 2.0 + floor(h21(vec2(floor(cell.x / 6.0), cell.y)) * 5.0);
          float inWord = step(mod(cell.x, 6.0), wordLen - 1.0);
          float glyph = step(0.25, h21(cell)) * inWord * rowOn;
          vec2 f = fract(tp);
          glyph *= step(0.12, f.x) * step(f.x, 0.88) * step(0.3, f.y) * step(f.y, 0.7);
          float textMask = panel * smoothstep(-0.12, -0.3, d);
          body += mix(accent, vec3(1.0), 0.6) * glyph * textMask * 0.16;
          // halo outside
          float halo = exp(-max(d, 0.0) * 7.0) * 0.04 + exp(-max(d, 0.0) * 24.0) * 0.14;
          vec3 col = body * glow * inside + accent * halo * glow * (1.0 - inside);
          // bevel: the arrow cut shows a dark side wall just inside its edge
          float bev = step(cloudSD(vP), 0.0) * step(-0.075, arrowSD(vP)) * step(arrowSD(vP), 0.0);
          col = mix(col, tone * 0.12 + pale * 0.08 * smoothstep(-0.075, 0.0, arrowSD(vP)), bev);
          gl_FragColor = vec4(col, max(inside, bev));
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    // extrusion: a darker copy offset behind/below reads as thickness
    const sideMat = new THREE.ShaderMaterial({
      uniforms: { accent: { value: accent } },
      vertexShader: cloudVert,
      fragmentShader: `${CLOUD_GLSL} uniform vec3 accent; varying vec2 vP;
        void main(){ float d = shapeSD(vP); if (d > 0.0) discard; gl_FragColor = vec4(accent * 0.45, 1.0); }`,
    });
    const side = new THREE.Mesh(cloudGeo, sideMat);
    side.position.set(0, -0.07, -0.18);
    const cloudGroup = new THREE.Group();
    cloudGroup.add(cloudDepth, cloud);
    cloudGroup.position.set(0, CLOUD_Y, CLOUD_Z);
    cloud.renderOrder = 5;
    scene.add(cloudGroup);

    // ---- fibres ----
    const fibGeo = ribbonGeometry(
      fibres.map((f) => f.pts),
      (p, s) => {
        const f = fibres[p];
        const k = Math.min(1, Math.max(0, (s - f.sBend) / 0.06));
        const near = Math.max(0, 1 - s / Math.max(f.sBend, 1e-3)); // 1 at the camera end
        return (0.06 + 0.1 * near * near) * (1 - k) + 0.034 * k;
      },
      CAM,
    );
    const nv = fibGeo.attributes.position.count;
    const fl = new Float32Array(nv), rep = new Float32Array(nv), spd = new Float32Array(nv), ph = new Float32Array(nv), br = new Float32Array(nv), sb = new Float32Array(nv);
    const pidA = fibGeo.attributes.pid.array as Float32Array;
    for (let i = 0; i < nv; i++) {
      const f = fibres[pidA[i]];
      fl[i] = f.floor; rep[i] = f.rep; spd[i] = f.speed; ph[i] = f.ph; br[i] = f.br; sb[i] = f.sBend;
    }
    fibGeo.setAttribute("rep", new THREE.BufferAttribute(rep, 1));
    fibGeo.setAttribute("fl", new THREE.BufferAttribute(fl, 1));
    fibGeo.setAttribute("spd", new THREE.BufferAttribute(spd, 1));
    fibGeo.setAttribute("ph", new THREE.BufferAttribute(ph, 1));
    fibGeo.setAttribute("br", new THREE.BufferAttribute(br, 1));
    fibGeo.setAttribute("sb", new THREE.BufferAttribute(sb, 1));
    const fibMat = new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, accent: { value: accent } },
      vertexShader: /* glsl */ `
        attribute float rep; attribute float spd; attribute float ph; attribute float br; attribute float sb; attribute float fl;
        varying float vFl; varying vec2 vUv; varying float vRep; varying float vSpd; varying float vPh; varying float vBr; varying float vSb;
        void main() { vFl = fl; vUv = uv; vRep = rep; vSpd = spd; vPh = ph; vBr = br; vSb = sb;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float t; uniform vec3 accent;
        varying float vFl; varying vec2 vUv; varying float vRep; varying float vSpd; varying float vPh; varying float vBr; varying float vSb;
        void main() {
          float s = vUv.x;
          float across = exp(-vUv.y * vUv.y * 2.5);
          // whole-number repeats along the fibre, whole-number cycles per loop
          float q = fract(s * vRep - t * vSpd + vPh);
          float pulse = exp(-pow((q - 0.5) / mix(0.03, 0.02, step(vSb, s)), 2.0)) * mix(7.0, 4.0, step(vSb, s));
          float rise = smoothstep(vSb, vSb + 0.08, s);
          float base = mix(0.22, 0.45, rise);
          pulse *= mix(1.0, 1.3, rise);
          float fade = mix(smoothstep(vSb - 0.06, vSb + 0.02, s), smoothstep(0.0, 0.03, s), vFl) * (1.0 - smoothstep(0.93, 1.0, s));
          vec3 c = accent;
          gl_FragColor = vec4(c * (base + pulse) * vBr * across * fade, 1.0);
        }`,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const fibMesh = new THREE.Mesh(fibGeo, fibMat);
    fibMesh.frustumCulled = false;
    scene.add(fibMesh);

    // ---- squares ----
    const sqPos = new Float32Array(N_SQ * 3), sqSize = new Float32Array(N_SQ), sqCol = new Float32Array(N_SQ * 3);
    const sqGeo = new THREE.BufferGeometry();
    sqGeo.setAttribute("position", new THREE.BufferAttribute(sqPos, 3));
    sqGeo.setAttribute("wsize", new THREE.BufferAttribute(sqSize, 1));
    sqGeo.setAttribute("pcolor", new THREE.BufferAttribute(sqCol, 3));
    const sqMat = worldPointsMaterial(height, FOV, true);
    sqMat.transparent = true; // drawn after the cloud so it never punches holes in it
    const sq = new THREE.Points(sqGeo, sqMat);
    sq.renderOrder = 10;
    sq.frustumCulled = false;
    scene.add(sq);
    const sqColor = hdrColor(params.accent, 1).lerp(new THREE.Color(0.05, 0.3, 1.0), 0.45);
    // one bright glass cube drifting on the right
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshStandardMaterial({ color: accent, emissive: accent.clone().lerp(new THREE.Color(1, 1, 1), 0.2).multiplyScalar(2.2), roughness: 0.4 }),
    );
    scene.add(cube);
    const cubeLight = new THREE.DirectionalLight(0xffffff, 2.5);
    cubeLight.position.set(-2, 4, 6);
    scene.add(cubeLight);

    const update = (frame: number) => {
      const t = (frame % period) / period;
      camera.position.copy(CAM);
      camera.position.x += 0.12 * Math.sin(TAU * t);
      camera.position.y += 0.05 * Math.sin(TAU * 2 * t);
      camera.lookAt(LOOK);
      fibMat.uniforms.t.value = t;
      const breathe = Math.sin(TAU * 2 * t);
      cloudGroup.scale.setScalar(1.13 * (1 + 0.012 * breathe));
      cloudU.glow.value = 1 + 0.06 * breathe;
      cube.position.set(5.6 + 0.2 * Math.sin(TAU * t), 1.95 + 0.12 * Math.sin(TAU * 2 * t), 1.5);
      cube.rotation.set(0.12 + 0.05 * Math.sin(TAU * t), 0.25 + 0.15 * Math.sin(TAU * t), 0.05);
      squares.forEach((s, i) => {
        sqPos[i * 3] = s.x + s.ax * Math.sin(TAU * s.kx * t + s.px);
        sqPos[i * 3 + 1] = s.y + s.ay * Math.sin(TAU * s.ky * t + s.py);
        sqPos[i * 3 + 2] = s.z;
        sqSize[i] = s.s;
        const b = s.b * (0.7 + 0.3 * Math.sin(TAU * s.tk * t + s.tp));
        sqCol[i * 3] = sqColor.r * b; sqCol[i * 3 + 1] = sqColor.g * b; sqCol[i * 3 + 2] = sqColor.b * b;
      });
      sqGeo.attributes.position.needsUpdate = true;
      sqGeo.attributes.wsize.needsUpdate = true;
      sqGeo.attributes.pcolor.needsUpdate = true;
    };

    return {
      scene,
      camera,
      update,
      beforeRender: (gl) => reflector.update(gl, scene, camera, floor),
      post: {
        exposure: 1.0,
        tonemap: "aces",
        bloom: { strength: 1.6, threshold: 0.45, knee: 0.5, radius: 0.7 },
        dof: { focus: 15, range: 30, nearRange: 7, maxBlur: 0.004, maxNearBlur: 0.022 },
        grain: 0.02,
        grainPeriod: period,
        grade: { saturation: 1.2 },
      },
    };
  },
};
