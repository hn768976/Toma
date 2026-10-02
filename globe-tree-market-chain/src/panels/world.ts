import * as THREE from "three";
import { PanelsVersion } from "../versions";
import { hash01, mulberry32, TAU } from "../lib/random";
import { lin, makePoints, makeSegments, Seg, setDof, syncResolution, toLayer } from "../lib/three/lines";
import { World } from "../lib/three/Stage";

const LOOP = 600;
const D = 3.2; // cell pitch
const S = 2.5; // cell size
const UNIT = 2 * D; // texture repeat = 2 cells
const N_GLIDE = 4; // camera glides exactly 4 cells per loop
const Z_FAR = -7;
const Z_NEAR = 4.5;
const CODES = ["M495", "GT58", "G998", "A320"];

// ---------- the HUD surface texture (one 2-cell repeat unit) ----------
const surfaceTexture = (v: PanelsVersion, ppu: number) => {
  const W = Math.round(UNIT * ppu);
  const H = Math.round((Z_NEAR - Z_FAR) * ppu);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")! as CanvasRenderingContext2D & { letterSpacing: string };
  const rnd = mulberry32(9001);
  const X = (x: number) => x * ppu; // unit x -> px
  const Z = (z: number) => (z - Z_FAR) * ppu; // world z -> px
  g.fillStyle = v.navy;
  g.fillRect(0, 0, W, H);
  // faint base panel grid
  g.strokeStyle = "rgba(90,150,220,0.10)";
  g.lineWidth = Math.max(1, ppu * 0.006);
  for (let x = 0; x < UNIT; x += 0.4) {
    g.beginPath();
    g.moveTo(X(x), 0);
    g.lineTo(X(x), H);
    g.stroke();
  }
  // cells: dot grid + label (borders are drawn as 3D ribbons)
  for (let k = 0; k < 2; k++) {
    const cx = D / 2 + k * D;
    g.fillStyle = "rgba(20,60,110,0.55)";
    g.fillRect(X(cx - S / 2), Z(-S / 2), X(S), S * ppu);
    for (let x = cx - S / 2 + 0.06; x < cx + S / 2; x += 0.07) {
      for (let z = -S / 2 + 0.06; z < S / 2; z += 0.07) {
        const h = hash01(Math.round(x * 100), Math.round(z * 100), k);
        g.fillStyle = `rgba(159,216,255,${0.12 + h * 0.22})`;
        const r = ppu * 0.008;
        g.fillRect(X(x) - r, Z(z) - r, r * 2, r * 2);
      }
    }
    // inner frame
    g.strokeStyle = "rgba(159,216,255,0.25)";
    g.lineWidth = Math.max(1, ppu * 0.005);
    g.strokeRect(X(cx - S / 2 + 0.1), Z(-S / 2 + 0.1), X(S - 0.2), (S - 0.2) * ppu);
    // label
    g.font = `600 ${0.24 * ppu}px Inter`;
    g.letterSpacing = `${0.012 * ppu}px`;
    g.textAlign = "right";
    g.textBaseline = "alphabetic";
    g.fillStyle = "#EAF6FF";
    g.fillText("Blockchain", X(cx + S / 2 - 0.18), Z(S / 2 - 0.2));
    g.textAlign = "left";
    g.font = `400 ${0.085 * ppu}px "JetBrains Mono"`;
    g.fillStyle = "rgba(159,216,255,0.6)";
    g.fillText(`BLK ${String(4096 + k * 7).padStart(6, "0")}`, X(cx - S / 2 + 0.2), Z(-S / 2 + 0.25));
  }
  // chip tiles (front row)
  g.textBaseline = "middle";
  for (let j = 0; j < 4; j++) {
    const x0 = j * (UNIT / 4) + 0.08;
    const w = UNIT / 4 - 0.16;
    const z0 = 1.75;
    const h = 0.7;
    const grd = g.createLinearGradient(0, Z(z0), 0, Z(z0 + h));
    grd.addColorStop(0, "rgba(60,140,220,0.55)");
    grd.addColorStop(1, "rgba(20,70,140,0.35)");
    g.fillStyle = grd;
    g.fillRect(X(x0), Z(z0), X(w), h * ppu);
    g.strokeStyle = "rgba(159,216,255,0.7)";
    g.lineWidth = Math.max(1, ppu * 0.006);
    g.strokeRect(X(x0), Z(z0), X(w), h * ppu);
    g.font = `600 ${0.2 * ppu}px Inter`;
    g.letterSpacing = "0px";
    g.fillStyle = "#EAF6FF";
    g.fillText(CODES[j], X(x0 + 0.1), Z(z0 + 0.3));
    // tiny bar pattern
    for (let b = 0; b < 16; b++) {
      const bh = 0.05 + rnd() * 0.18;
      g.fillStyle = `rgba(159,216,255,${0.35 + rnd() * 0.5})`;
      g.fillRect(X(x0 + 0.72 + b * 0.04), Z(z0 + 0.55 - bh), Math.max(1, ppu * 0.022), bh * ppu);
    }
    for (let d = 0; d < 6; d++) {
      g.fillStyle = `rgba(159,216,255,${0.25 + rnd() * 0.4})`;
      g.fillRect(X(x0 + 0.1 + d * 0.09), Z(z0 + 0.56), Math.max(1, ppu * 0.05), Math.max(1, ppu * 0.025));
    }
  }
  // dense data blocks, far and near
  const blocks = (z0: number, z1: number, density: number, alpha: number) => {
    for (let z = z0; z < z1; z += 0.16) {
      let x = 0;
      while (x < UNIT - 0.05) {
        const w = 0.04 + rnd() * 0.32;
        if (rnd() < density) {
          const a = alpha * (0.3 + rnd() * 0.7);
          g.fillStyle = rnd() < 0.15 ? `rgba(220,240,255,${a})` : `rgba(80,160,240,${a})`;
          g.fillRect(X(x), Z(z), X(Math.min(w, UNIT - x)), 0.09 * ppu);
        }
        x += w + 0.04;
      }
    }
  };
  blocks(Z_FAR + 0.2, -3.4, 0.55, 0.5);
  blocks(2.75, Z_NEAR - 0.1, 0.5, 0.45);
  // mid band of panel outlines far back
  for (let k = 0; k < 4; k++) {
    g.strokeStyle = "rgba(120,190,255,0.35)";
    g.lineWidth = Math.max(1, ppu * 0.006);
    g.strokeRect(X(k * 1.6 + 0.1), Z(-3.2), X(1.4), 1.4 * ppu);
    for (let r = 0; r < 6; r++) {
      g.fillStyle = `rgba(120,190,255,${0.15 + rnd() * 0.3})`;
      g.fillRect(X(k * 1.6 + 0.2), Z(-3.05 + r * 0.2), X(0.4 + rnd() * 0.8), 0.06 * ppu);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 16;
  tex.needsUpdate = true;
  return tex;
};

const surfaceMesh = (tex: THREE.Texture, x0: number, x1: number, zOff = 0) => {
  const geo = new THREE.PlaneGeometry(x1 - x0, Z_NEAR - Z_FAR, 1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, zOff === 0 ? 0 : -0.02, (Z_FAR + Z_NEAR) / 2 + zOff);
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `out vec3 vW; out float vDist; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `precision highp float; uniform sampler2D map; uniform float unit; uniform float zFar; uniform float zNear; uniform vec3 fogC; uniform float zOff; in vec3 vW; in float vDist; out vec4 o;
      void main(){ vec2 uv = vec2(vW.x / unit, 1.0 - (vW.z - zOff - zFar) / (zNear - zFar));
        vec3 c = texture(map, uv).rgb * 1.6;
        float fog = exp(-max(vDist - 7.0, 0.0) * 0.05);
        o = vec4(mix(fogC, c, fog), 1.0); }`,
    uniforms: { map: { value: tex }, unit: { value: UNIT }, zFar: { value: Z_FAR }, zNear: { value: Z_NEAR }, fogC: { value: new THREE.Vector3(0.0005, 0.002, 0.008) }, zOff: { value: zOff } },
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.renderOrder = -5;
  return mesh;
};

// ---------- wireframe network cube ----------
const cubeNetwork = (variant: number, ice: string) => {
  const rnd = mulberry32(500 + variant * 17);
  const h = 0.5;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < 230; i++) {
    const p = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).multiplyScalar(h);
    if (i < 170) {
      // snap to a face
      const ax = Math.floor(rnd() * 3);
      const sgn = rnd() < 0.5 ? -1 : 1;
      p.setComponent(ax, sgn * h);
    }
    pts.push(p);
  }
  const segs: Seg[] = [];
  const cLine = lin(ice, 1.3);
  pts.forEach((p, i) => {
    const near = pts
      .map((q, j) => ({ j, d: p.distanceTo(q) }))
      .filter((e) => e.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 4);
    near.forEach((e) => {
      if (e.j < i && rnd() < 0.5) return;
      const a = 0.25 + rnd() * 0.6;
      segs.push({ a: p.toArray(), b: pts[e.j].toArray(), ca: [...cLine, a] as THREE.Vector4Tuple });
    });
  });
  // outline edges
  const cEdge = lin("#DFF2FF", 1.5);
  const corners = [-h, h];
  for (const a of corners)
    for (const b of corners) {
      segs.push({ a: [-h, a, b], b: [h, a, b], ca: [...cEdge, 1] as THREE.Vector4Tuple });
      segs.push({ a: [a, -h, b], b: [a, h, b], ca: [...cEdge, 1] as THREE.Vector4Tuple });
      segs.push({ a: [a, b, -h], b: [a, b, h], ca: [...cEdge, 1] as THREE.Vector4Tuple });
    }
  const lines = makeSegments(segs, { width: 1.6 });
  const pp = new Float32Array(pts.length * 3);
  const pc = new Float32Array(pts.length * 4);
  const ps = new Float32Array(pts.length);
  const cDot = lin("#FFFFFF", 2.5);
  pts.forEach((p, i) => {
    pp.set(p.toArray(), i * 3);
    pc.set([...cDot, 0.6 + rnd() * 0.4], i * 4);
    ps[i] = 3 + rnd() * 4;
  });
  const dots = makePoints(pp, pc, ps, { size: 1, soft: 0.7 });
  const g = new THREE.Group();
  g.add(lines);
  g.add(dots);
  lines.renderOrder = 10;
  dots.renderOrder = 11;
  return g;
};

const glowDecal = (ice: string) => {
  const geo = new THREE.PlaneGeometry(2.6, 2.6);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `precision highp float; uniform vec3 c; in vec2 vUv; out vec4 o; void main(){ vec2 p = abs(vUv - 0.5) * 2.0; float d = max(p.x, p.y) * 0.6 + length(p) * 0.4; o = vec4(c * exp(-d * d * 5.0) * 0.6, 1.0); }`,
    uniforms: { c: { value: new THREE.Vector3(...lin(ice)) } },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.renderOrder = -2;
  return mesh;
};

export const buildPanelsWorld = (v: PanelsVersion, dpr: number): World => {
  const root = new THREE.Group();
  const over = new THREE.Group(); // overlay layer: cubes + dust, per-vertex defocus
  const ppu = dpr >= 0.9 ? 560 : 300;
  const tex = surfaceTexture(v, ppu);
  const xMin = -12;
  const xMax = 36;
  root.add(surfaceMesh(tex, xMin, xMax));

  // backdrop wall of data blocks (far, blurred by DOF)
  const wall = surfaceMesh(tex, xMin, xMax, -(Z_NEAR - Z_FAR));
  root.add(wall);
  const back = surfaceMesh(tex, xMin, xMax, -2 * (Z_NEAR - Z_FAR));
  back.position.set(0, 0, 0);
  root.add(back);

  const firstCell = Math.floor(xMin / D);
  const lastCell = Math.ceil(xMax / D);
  const borders: Seg[] = [];
  const arrows: { mesh: THREE.Mesh; i: number }[] = [];
  const cubes: { g: THREE.Group; i: number }[] = [];
  const cB = lin(v.ice, 1.4);
  const variants = [cubeNetwork(0, v.ice), cubeNetwork(1, v.ice)];
  for (let i = firstCell; i <= lastCell; i++) {
    const cx = i * D + D / 2;
    const y = 0.004;
    const corners: THREE.Vector3Tuple[] = [
      [cx - S / 2, y, -S / 2],
      [cx + S / 2, y, -S / 2],
      [cx + S / 2, y, S / 2],
      [cx - S / 2, y, S / 2],
    ];
    for (let k = 0; k < 4; k++) borders.push({ a: corners[k], b: corners[(k + 1) % 4], ca: [...cB, 1] as THREE.Vector4Tuple });
    // corner brackets
    // arrows between this cell and the next: "->" above "<-"
    const ax = (i + 1) * D;
    const aw = 0.22;
    const arrowSegs: Seg[] = [];
    const ca: THREE.Vector4Tuple = [...lin("#FFFFFF", 2.0), 1] as THREE.Vector4Tuple;
    const zt = -0.16;
    const zb = 0.16;
    arrowSegs.push({ a: [ax - aw, y, zt], b: [ax + aw, y, zt], ca });
    arrowSegs.push({ a: [ax + aw, y, zt], b: [ax + aw - 0.09, y, zt - 0.08], ca });
    arrowSegs.push({ a: [ax + aw, y, zt], b: [ax + aw - 0.09, y, zt + 0.08], ca });
    arrowSegs.push({ a: [ax + aw, y, zb], b: [ax - aw, y, zb], ca });
    arrowSegs.push({ a: [ax - aw, y, zb], b: [ax - aw + 0.09, y, zb - 0.08], ca });
    arrowSegs.push({ a: [ax - aw, y, zb], b: [ax - aw + 0.09, y, zb + 0.08], ca });
    const am = makeSegments(arrowSegs, { width: 4.5 });
    am.renderOrder = 6;
    root.add(am);
    arrows.push({ mesh: am, i });
    // cube
    const holder = new THREE.Group();
    holder.position.set(cx, 0.95, -0.15);
    const net = variants[((i % 2) + 2) % 2].clone();
    holder.add(net);
    over.add(holder);
    const decal = glowDecal(v.ice);
    decal.position.set(cx, 0.01, -0.15);
    root.add(decal);
    cubes.push({ g: net, i });
  }
  const bm = makeSegments(borders, { width: 3.0 });
  bm.renderOrder = 5;
  root.add(bm);

  // drifting dust in the air (static field; camera motion provides parallax)
  const rnd = mulberry32(31);
  const n = 900;
  const pp = new Float32Array(n * 3);
  const pc = new Float32Array(n * 4);
  const ps = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    pp.set([xMin + rnd() * (xMax - xMin), 0.2 + rnd() * 3.5, Z_FAR + rnd() * (Z_NEAR - Z_FAR)], k * 3);
    pc.set([...lin(v.ice, 1.2), 0.15 + rnd() * 0.5], k * 4);
    ps[k] = 2 + rnd() * 4;
  }
  const dust = makePoints(pp, pc, ps, { size: 1, soft: 0.8, perspective: 6 });
  dust.renderOrder = 12;
  over.add(dust);
  toLayer(over, 1);
  root.add(over);

  // background gradient sky behind the wall
  return {
    root,
    overlay: true,
    grainSeed: (f) => f % LOOP,
    syncRes: (w, h) => syncResolution(root, w, h),
    update: (frame, cam) => {
      const lf = frame % LOOP;
      const t = lf / LOOP;
      cubes.forEach(({ g, i }) => {
        const ph = ((((i % 4) + 4) % 4) * Math.PI) / 2;
        g.rotation.set(0.32, TAU * t + ph, 0.12);
      });
      arrows.forEach(({ mesh, i }) => {
        const ph = ((((i % 4) + 4) % 4) * Math.PI) / 2;
        (mesh.material as THREE.RawShaderMaterial).uniforms.uOpacity.value = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(TAU * 6 * t - ph), 2);
      });
      const cx = -0.4 + N_GLIDE * D * t;
      cam.fov = 36;
      cam.position.set(cx, 3.1, 6.6);
      cam.lookAt(cx + 3.0, 0.3, -1.0);
      const focusPoint = new THREE.Vector3(cx + 2.4, 0.6, -0.15);
      const fd = cam.position.distanceTo(focusPoint);
      setDof(over, fd, 2.6, 40);
      return {
        bloomStrength: 0.8,
        bloomThreshold: 0.55,
        bloomWeights: [0.4, 0.35, 0.25, 0.15, 0.1],
        exposure: 1.0,
        grain: 0.02,
        vignette: 0.35,
        lift: [0.0, 0.002, 0.006],
        dof: { mode: "plane", focusDist: fd - 0.3, focusRange: 4.2, strength: 0.9, planeY: 0 },
      };
    },
  };
};
