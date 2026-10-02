import * as THREE from "three";
import { BuildVersion } from "../versions";
import { clamp, hash01, lerp, mulberry32, smooth, TAU } from "../lib/random";
import { lin, makePoints, setDof, syncResolution, toLayer } from "../lib/three/lines";
import { World } from "../lib/three/Stage";

// ---------- fake glass ----------
const GLASS_VERT = /* glsl */ `
out vec3 vObj; out vec3 vN; out vec3 vV; out vec3 vWorld;
void main(){
  vObj = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const GLASS_FRAG = /* glsl */ `
precision highp float;
uniform vec3 half_; uniform vec3 cPale; uniform vec3 cLit; uniform float colorMix;
uniform float fillY; uniform float flash; uniform float intensity; uniform float seed;
in vec3 vObj; in vec3 vN; in vec3 vV; in vec3 vWorld; out vec4 o;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32 + seed); return fract(p.x * p.y); }
void main(){
  vec3 n = normalize(vN);
  float ndv = abs(dot(n, normalize(vV)));
  float fres = pow(1.0 - ndv, 3.0);
  // distance to the nearest edge of this face (object space)
  vec3 a = abs(vObj);
  vec3 d = half_ - a; // 0 at the face along the normal axis
  vec3 an = abs(normalize(vObj / half_));
  float e;
  if (d.x < d.y && d.x < d.z) e = min(d.y, d.z);
  else if (d.y < d.z) e = min(d.x, d.z);
  else e = min(d.x, d.y);
  float edge = exp(-e / 0.01) * 0.9 + exp(-e / 0.05) * 0.18;
  // faint lines of tiny text and dots on the faces
  vec2 fuv;
  if (d.x < d.y && d.x < d.z) fuv = vObj.zy; else if (d.y < d.z) fuv = vObj.xz; else fuv = vObj.xy;
  vec2 g = fuv * vec2(46.0, 26.0);
  vec2 cell = floor(g);
  float row = step(0.5, h21(vec2(seed, cell.y))) * step(fract(g.y), 0.42);
  float glyph = step(0.35, h21(cell)) * row * step(fract(g.x), 0.72);
  float dots = step(0.985, h21(floor(fuv * 90.0) + 3.0));
  float text = glyph * 0.55 + dots * 1.2;
  float lit = smoothstep(fillY + 0.06, fillY - 0.06, vWorld.y);
  vec3 col = mix(cPale, cLit, colorMix * lit);
  float body = 0.02 + lit * 0.07 * colorMix;
  float k = body + fres * 0.22 + edge + text * (0.18 + 0.3 * lit);
  k *= intensity * 0.6 * (1.0 + lit * colorMix * 0.5);
  vec3 c = col * k + vec3(1.0) * flash * (0.6 * edge + 0.25);
  o = vec4(c, 1.0);
}`;

const makePiece = (size: THREE.Vector3Tuple, v: BuildVersion, seed: number) => {
  const geo = new THREE.BoxGeometry(...size);
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: GLASS_VERT,
    fragmentShader: GLASS_FRAG,
    uniforms: {
      half_: { value: new THREE.Vector3(size[0] / 2, size[1] / 2, size[2] / 2) },
      cPale: { value: new THREE.Vector3(...lin(v.pale)) },
      cLit: { value: new THREE.Vector3(...lin(v.lit)) },
      colorMix: { value: 0 },
      fillY: { value: -1 },
      flash: { value: 0 },
      intensity: { value: 1 },
      seed: { value: seed },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.renderOrder = 5;
  return mesh;
};

type Piece = { mesh: THREE.Mesh; home: THREE.Vector3; from: THREE.Vector3; t0: number; t1: number };

// A block = bottom slab + 4 vertical quarters + top slab.
const makeBlock = (v: BuildVersion, seed: number) => {
  const g = new THREE.Group();
  const gap = 0.025;
  const pieces: Piece[] = [];
  const slabH = 0.34;
  const qH = 2 - 2 * slabH - 2 * gap;
  const add = (size: THREE.Vector3Tuple, home: THREE.Vector3Tuple, from: THREE.Vector3Tuple, t0: number, t1: number, s: number) => {
    const mesh = makePiece(size, v, seed * 10 + s);
    g.add(mesh);
    pieces.push({ mesh, home: new THREE.Vector3(...home), from: new THREE.Vector3(...from), t0, t1 });
  };
  const y0 = 0.04;
  add([2, slabH, 2], [0, y0 + slabH / 2, 0], [0, y0 + slabH / 2 + 3.2, 0], 4, 52, 1);
  const q = 1 - gap / 2;
  const qy = y0 + slabH + gap + qH / 2;
  const quarters: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  quarters.forEach(([sx, sz], i) => {
    const t0 = 36 + i * 15;
    add([q, qH, q], [(sx * (1 + gap / 2)) / 2, qy, (sz * (1 + gap / 2)) / 2], [sx * 1.9, qy + 2.6, sz * 1.9], t0, t0 + 44, 2 + i);
  });
  add([2, slabH, 2], [0, y0 + 2 - slabH / 2, 0], [0, y0 + 2 - slabH / 2 + 3.5, 0], 96, 142, 7);
  // inner core (fills with light)
  const core = makePiece([1.9, 1.9, 1.9], v, seed * 10 + 9);
  core.position.y = y0 + 1;
  (core.material as THREE.ShaderMaterial).uniforms.intensity.value = 0.0;
  g.add(core);
  return { g, pieces, core };
};

const easeOutBack = (t: number) => {
  const c1 = 1.3;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---------- board ----------
const boardTexture = (v: BuildVersion, px: number) => {
  const c = document.createElement("canvas");
  c.width = px;
  c.height = px;
  const g = c.getContext("2d")!;
  const rnd = mulberry32(2024);
  g.fillStyle = v.board;
  g.fillRect(0, 0, px, px);
  const u = px / 64; // grid unit
  // traces
  for (let i = 0; i < 140; i++) {
    let x = Math.floor(rnd() * 64);
    let y = Math.floor(rnd() * 64);
    g.strokeStyle = `rgba(60,130,220,${0.12 + rnd() * 0.3})`;
    g.lineWidth = Math.max(1, u * (rnd() < 0.2 ? 0.28 : 0.14));
    g.beginPath();
    g.moveTo(x * u, y * u);
    const steps = 2 + Math.floor(rnd() * 4);
    for (let s = 0; s < steps; s++) {
      const len = 2 + Math.floor(rnd() * 8);
      const dir = Math.floor(rnd() * 4);
      const diag = rnd() < 0.3;
      if (dir === 0) x += len;
      else if (dir === 1) x -= len;
      else if (dir === 2) y += len;
      else y -= len;
      if (diag) y += dir < 2 ? len * (rnd() < 0.5 ? 1 : -1) : 0;
      g.lineTo(x * u, y * u);
    }
    g.stroke();
    g.fillStyle = "rgba(90,160,240,0.5)";
    g.beginPath();
    g.arc(x * u, y * u, u * 0.3, 0, TAU);
    g.fill();
  }
  // chip outlines
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(rnd() * 58) * u;
    const y = Math.floor(rnd() * 58) * u;
    const w = (3 + Math.floor(rnd() * 5)) * u;
    g.strokeStyle = "rgba(70,140,230,0.28)";
    g.lineWidth = Math.max(1, u * 0.12);
    g.strokeRect(x, y, w, w);
    for (let k = 1; k < w / u; k++) {
      g.fillStyle = "rgba(70,140,230,0.35)";
      g.fillRect(x + k * u - u * 0.1, y - u * 0.5, u * 0.2, u * 0.4);
      g.fillRect(x + k * u - u * 0.1, y + w + u * 0.1, u * 0.2, u * 0.4);
    }
  }
  // fine grid
  g.strokeStyle = "rgba(50,100,180,0.07)";
  g.lineWidth = 1;
  for (let k = 0; k <= 64; k += 2) {
    g.beginPath();
    g.moveTo(k * u, 0);
    g.lineTo(k * u, px);
    g.moveTo(0, k * u);
    g.lineTo(px, k * u);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 16;
  tex.needsUpdate = true;
  return tex;
};

const BOARD_TILE = 9;
const boardMesh = (tex: THREE.Texture, v: BuildVersion) => {
  const geo = new THREE.PlaneGeometry(200, 200);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `out vec3 vW; out float vDist; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `precision highp float;
      uniform sampler2D map; uniform float tile; uniform vec3 cLit; uniform vec3 cRed;
      uniform vec4 glow[5]; uniform float redK;
      in vec3 vW; in float vDist; out vec4 o;
      float h21(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
      void main(){
        vec3 c = texture(map, vW.xz / tile).rgb * 2.6;
        // a few red lights
        vec2 cell = floor(vW.xz / 1.7);
        float r = h21(cell);
        vec2 lp = (cell + vec2(h21(cell + 1.3), h21(cell + 7.1))) * 1.7;
        float ld = length(vW.xz - lp);
        c += cRed * step(0.93, r) * (exp(-ld * 40.0) * 3.0 + exp(-ld * 6.0) * 0.15) * redK;
        for (int i = 0; i < 5; i++) {
          vec2 d = vW.xz - glow[i].xy;
          float dd = dot(d, d);
          c += cLit * glow[i].z * (exp(-dd / (glow[i].w * glow[i].w)) * 0.5 + exp(-dd / (glow[i].w * glow[i].w * 9.0)) * 0.08) * (0.25 + c * 5.0);
        }
        float fog = exp(-max(vDist - 8.0, 0.0) * 0.045);
        o = vec4(c * fog, 1.0);
      }`,
    uniforms: {
      map: { value: tex },
      tile: { value: BOARD_TILE },
      cLit: { value: new THREE.Vector3(...lin(v.lit)) },
      cRed: { value: new THREE.Vector3(...lin(v.red)) },
      glow: { value: Array.from({ length: 5 }, () => new THREE.Vector4()) },
      redK: { value: 1 },
    },
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.renderOrder = -5;
  return mesh;
};

// ---------- glowing flat paths ----------
const PATH_VERT = /* glsl */ `
in float aS; in float aSide; out float vS; out float vSide;
void main(){ vS = aS; vSide = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PATH_FRAG = /* glsl */ `
precision highp float;
uniform vec3 c; uniform float drawn; uniform float total; uniform float pulse; uniform float pulseK; uniform float k;
in float vS; in float vSide; out vec4 o;
void main(){
  if (vS > drawn) discard;
  float core = 1.0 - smoothstep(0.25, 1.0, abs(vSide));
  float head = exp(-max(drawn - vS, 0.0) * 3.0) * step(drawn, total - 0.01) * 4.0;
  float p = fract((vS - pulse) / 2.4);
  float pl = exp(-p * 10.0) * pulseK * 1.5;
  o = vec4(c * core * k * (1.0 + head + pl), 1.0);
}`;

const pathMesh = (pts: THREE.Vector2[], width: number, v: BuildVersion, y = 0.012) => {
  const pos: number[] = [];
  const s: number[] = [];
  const side: number[] = [];
  const idx: number[] = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    if (i > 0) acc += p.distanceTo(prev);
    const dIn = i > 0 ? p.clone().sub(prev).normalize() : next.clone().sub(p).normalize();
    const dOut = i < pts.length - 1 ? next.clone().sub(p).normalize() : dIn.clone();
    const tan = dIn.clone().add(dOut).normalize();
    const nrm = new THREE.Vector2(-tan.y, tan.x);
    const miter = 1 / Math.max(0.5, nrm.dot(new THREE.Vector2(-dIn.y, dIn.x)));
    for (const sd of [-1, 1]) {
      pos.push(p.x + nrm.x * sd * width * 0.5 * miter, y, p.y + nrm.y * sd * width * 0.5 * miter);
      s.push(acc);
      side.push(sd);
    }
    if (i > 0) {
      const b = (i - 1) * 2;
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aS", new THREE.Float32BufferAttribute(s, 1));
  g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
  g.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: PATH_VERT,
    fragmentShader: PATH_FRAG,
    uniforms: {
      c: { value: new THREE.Vector3(...lin(v.lit)) },
      drawn: { value: 0 },
      total: { value: acc },
      pulse: { value: 0 },
      pulseK: { value: 0 },
      k: { value: 1.5 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = 2;
  return { mesh, total: acc };
};

export const buildBuildWorld = (v: BuildVersion, dpr: number): World => {
  const root = new THREE.Group();
  const tex = boardTexture(v, dpr >= 0.9 ? 4096 : 2048);
  const board = boardMesh(tex, v);
  root.add(board);

  const main = makeBlock(v, 1);
  root.add(main.g);

  // neighbours (already complete), zig-zag chain: C - A - main - B - D
  const nPos: [number, number][] = [
    [-7, -4.5],
    [7, -4.5],
    [-13, 0.5],
    [13, 0.5],
  ];
  const neighbours = nPos.map((p, i) => {
    const b = makeBlock(v, 2 + i);
    b.g.position.set(p[0], 0, p[1]);
    b.pieces.forEach((pc) => pc.mesh.position.copy(pc.home));
    root.add(b.g);
    return b;
  });

  const V = (x: number, z: number) => new THREE.Vector2(x, z);
  const mkRoute = (pts: THREE.Vector2[]) => {
    const a = pathMesh(pts, 0.16, v);
    // a thinner companion line, offset
    const off = pts.map((p, i) => {
      const n = pts[Math.min(i + 1, pts.length - 1)].clone().sub(pts[Math.max(i - 1, 0)]).normalize();
      return p.clone().add(new THREE.Vector2(-n.y, n.x).multiplyScalar(0.34));
    });
    const b = pathMesh(off, 0.05, v);
    (b.mesh.material as THREE.ShaderMaterial).uniforms.k.value = 0.8;
    root.add(a.mesh);
    root.add(b.mesh);
    return [a, b];
  };
  const routes = [
    { r: mkRoute([V(-1.15, 0.3), V(-3.6, 0.3), V(-3.6, -4.2), V(-5.85, -4.2)]), t0: 222, t1: 290 },
    { r: mkRoute([V(1.15, -0.3), V(3.6, -0.3), V(3.6, -4.8), V(5.85, -4.8)]), t0: 222, t1: 290 },
    { r: mkRoute([V(-8.15, -4.2), V(-10.2, -4.2), V(-10.2, 0.8), V(-11.85, 0.8)]), t0: 300, t1: 362 },
    { r: mkRoute([V(8.15, -4.8), V(10.2, -4.8), V(10.2, 0.2), V(11.85, 0.2)]), t0: 300, t1: 362 },
  ];
  const litAt = [292, 292, 364, 364];

  // floating dust
  const rnd = mulberry32(5);
  const n = 700;
  const pp = new Float32Array(n * 3);
  const pc = new Float32Array(n * 4);
  const ps = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pp.set([(rnd() * 2 - 1) * 22, 0.2 + rnd() * 5, (rnd() * 2 - 1) * 14 - 3], i * 3);
    pc.set([...lin(i % 3 ? v.pale : v.lit, 0.9), 0.2 + rnd() * 0.5], i * 4);
    ps[i] = 2 + rnd() * 4;
  }
  const dust = makePoints(pp, pc, ps, { size: 1, soft: 0.8, perspective: 6 });
  dust.renderOrder = 8;
  toLayer(dust, 1); // overlay: carries its own per-vertex defocus
  root.add(dust);

  const glowU = (board.material as THREE.ShaderMaterial).uniforms.glow.value as THREE.Vector4[];
  const setBlock = (b: ReturnType<typeof makeBlock>, colorMix: number, fillY: number, intensity: number, flash: number) => {
    b.pieces.forEach((pc) => {
      const u = (pc.mesh.material as THREE.ShaderMaterial).uniforms;
      u.colorMix.value = colorMix;
      u.fillY.value = fillY;
      u.intensity.value = intensity;
      u.flash.value = flash;
    });
    const cu = (b.core.material as THREE.ShaderMaterial).uniforms;
    cu.colorMix.value = colorMix;
    cu.fillY.value = fillY;
    cu.intensity.value = 0.35 * colorMix * intensity;
  };

  return {
    root,
    overlay: true,
    grainSeed: (f) => f,
    syncRes: (w, h) => syncResolution(root, w, h),
    update: (f, cam) => {
      // --- assembly 0-150
      let flash = 0;
      main.pieces.forEach((pc) => {
        const t = clamp((f - pc.t0) / (pc.t1 - pc.t0));
        const e = easeOutBack(t);
        pc.mesh.position.lerpVectors(pc.from, pc.home, Math.min(e, 1.04));
        if (t >= 1) pc.mesh.position.copy(pc.home);
        const vis = smooth(pc.t0 - 6, pc.t0 + 10, f);
        const lf = f >= pc.t1 ? Math.exp(-(f - pc.t1) / 7) : 0;
        flash = Math.max(flash, lf);
        const u = (pc.mesh.material as THREE.ShaderMaterial).uniforms;
        u.intensity.value = vis;
        u.flash.value = lf;
      });
      // --- fill with light 150-240
      const fill = smooth(150, 228, f);
      const colorMix = smooth(165, 240, f);
      const fillY = lerp(-0.1, 2.2, fill);
      main.pieces.forEach((pc) => {
        const u = (pc.mesh.material as THREE.ShaderMaterial).uniforms;
        u.colorMix.value = colorMix;
        u.fillY.value = fillY;
        u.intensity.value *= 1 + 0.15 * colorMix;
      });
      const cu = (main.core.material as THREE.ShaderMaterial).uniforms;
      cu.colorMix.value = colorMix;
      cu.fillY.value = fillY;
      cu.intensity.value = 0.22 * fill;
      const pulseT = (f - 390) / 30;
      glowU[0].set(0, 0, 0.12 * smooth(40, 150, f) + 0.6 * smooth(160, 250, f) + flash * 0.3, lerp(1.6, 2.6, smooth(150, 260, f)));

      // --- chain 210-390
      routes.forEach((rt, i) => {
        const p = smooth(rt.t0, rt.t1, f);
        rt.r.forEach((pm) => {
          const u = (pm.mesh.material as THREE.ShaderMaterial).uniforms;
          u.drawn.value = p * pm.total;
          u.pulse.value = Math.max(0, f - 380) * 0.09 + i * 0.6;
          u.pulseK.value = smooth(385, 405, f);
        });
      });
      neighbours.forEach((b, i) => {
        const lit = smooth(litAt[i], litAt[i] + 26, f);
        const fl = f >= litAt[i] ? Math.exp(-(f - litAt[i]) / 9) : 0;
        setBlock(b, lit, lerp(-0.1, 2.2, lit), 0.18 + 0.95 * lit, fl * 0.5);
        glowU[i + 1].set(nPos[i][0], nPos[i][1], 0.05 + 0.6 * lit, 2.2);
      });
      void pulseT;

      // --- camera
      const tA = f / 240;
      const close = new THREE.Vector3(lerp(3.1, 1.6, tA), lerp(2.3, 2.9, tA), lerp(5.0, 4.6, tA));
      const closeT = new THREE.Vector3(0, 0.95, 0);
      const fT = clamp((f - 390) / 60);
      const far = new THREE.Vector3(lerp(0, 0.6, fT), lerp(11.5, 11.8, fT), lerp(14.5, 14.9, fT));
      const farT = new THREE.Vector3(0, 0, -2.2);
      const b = easeInOut(clamp((f - 210) / 180));
      cam.fov = 40;
      cam.position.lerpVectors(close, far, b);
      const tgt = closeT.clone().lerp(farT, b);
      cam.lookAt(tgt);
      const fd = cam.position.distanceTo(tgt);
      setDof(dust, fd, lerp(2.5, 12, b), 30);
      return {
        bloomStrength: 0.8,
        bloomThreshold: 0.5,
        bloomWeights: [0.4, 0.35, 0.3, 0.2, 0.12],
        exposure: 1.05,
        grain: 0.02,
        vignette: 0.3,
        lift: [0, 0.001, 0.003],
        dof: { mode: "depth", focusDist: fd, focusRange: lerp(3.0, 14, b), strength: lerp(1.0, 0.8, b) },
      };
    },
  };
};
void hash01;
