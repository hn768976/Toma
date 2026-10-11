import * as THREE from "three";
import { TAU } from "../lib/ease";
import { Look } from "../lib/LookCanvas";
import { Pipeline } from "../lib/post";
import { mulberry32 } from "../lib/random";

export const LOOP = 600;
const SPACING = 0.6;
const P = 24; // row period in folders
const PERIOD_X = P * SPACING; // 14.4 world units — camera travels exactly this per loop
const FW = 0.92; // folder width
const FH = 0.9; // folder height (body)
const TAB_W = 0.34;
const TAB_H = 0.06;

// ---- seeded per-slot variation (module level) ----
const VAR = (() => {
  const r = mulberry32(0x5f0d3a17);
  return Array.from({ length: P }, () => ({
    h: 1 + (r() * 2 - 1) * 0.05,
    tilt: THREE.MathUtils.degToRad((r() * 2 - 1) * 2),
    tabRight: r() < 0.2,
  }));
})();

const folderShape = (tabRight: boolean) => {
  const s = new THREE.Shape();
  const x0 = -FW / 2;
  const x1 = FW / 2;
  const r = 0.025;
  const tx0 = tabRight ? x1 - 0.06 - TAB_W : x0 + 0.06;
  const tx1 = tx0 + TAB_W;
  s.moveTo(x0 + r, 0);
  s.lineTo(x1 - r, 0);
  s.quadraticCurveTo(x1, 0, x1, r);
  s.lineTo(x1, FH - r);
  s.quadraticCurveTo(x1, FH, x1 - r, FH);
  s.lineTo(tx1, FH);
  s.lineTo(tx1 - 0.05, FH + TAB_H - 0.008);
  s.quadraticCurveTo(tx1 - 0.055, FH + TAB_H, tx1 - 0.07, FH + TAB_H);
  s.lineTo(tx0 + 0.07, FH + TAB_H);
  s.quadraticCurveTo(tx0 + 0.055, FH + TAB_H, tx0 + 0.05, FH + TAB_H - 0.008);
  s.lineTo(tx0, FH);
  s.lineTo(x0 + r, FH);
  s.quadraticCurveTo(x0, FH, x0, FH - r);
  s.lineTo(x0, r);
  s.quadraticCurveTo(x0, 0, x0 + r, 0);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
    curveSegments: 6,
  });
  g.translate(0, 0, -0.011);
  // face normal → −x (towards the camera, which looks along +x), turned 12° further toward it
  g.rotateY(-Math.PI / 2 + THREE.MathUtils.degToRad(22));
  return g;
};

/** Normal map of shallow horizontal grooves (UV = shape coordinates, remapped). */
const grooveNormalMap = () => {
  const W = 256;
  const H = 256;
  const data = new Uint8Array(W * H * 4);
  const grooves = [0.3, 0.44, 0.58, 0.72];
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    let ny = 0;
    for (const g of grooves) {
      const d = (v - g) / 0.012;
      if (Math.abs(d) < 3) ny += -d * Math.exp(-d * d) * 0.9;
    }
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      const m = u > 0.07 && u < 0.93 ? Math.min(1, Math.min(u - 0.07, 0.93 - u) / 0.01) : 0;
      const n = new THREE.Vector3(0, ny * m, 1).normalize();
      const i = (y * W + x) * 4;
      data[i] = Math.round((n.x * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((n.y * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((n.z * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = THREE.NoColorSpace;
  t.repeat.set(1 / FW, 1 / FH);
  t.offset.set(0.5, 0);
  t.needsUpdate = true;
  return t;
};

const BG_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
`;
const BG_FRAG = /* glsl */ `
uniform vec3 cTop; uniform vec3 cMid; uniform vec3 cHorizon;
varying vec2 vUv;
void main() {
  float y = vUv.y;
  vec3 c = mix(cHorizon, cMid, smoothstep(0.35, 0.7, y));
  c = mix(c, cTop, smoothstep(0.7, 1.0, y));
  // brighter toward the left where the flare sits
  c *= 1.0 + 0.35 * exp(-pow(vUv.x / 0.45, 2.0)) * exp(-pow((y - 0.62) / 0.35, 2.0));
  gl_FragColor = vec4(c, 1.0);
}
`;

const FLOOR_VERT = /* glsl */ `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;
const FLOOR_FRAG = /* glsl */ `
uniform vec3 cBase; uniform vec3 cLine; uniform vec3 cDot; uniform vec3 cFog;
uniform float t; uniform vec3 camPos; uniform float periodX;
varying vec3 vW;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float gridLine(vec2 uv, float w) {
  vec2 d = fwidth(uv);
  vec2 dw = clamp(vec2(w), d, vec2(0.5));
  vec2 g = 1.0 - abs(fract(uv) * 2.0 - 1.0);
  vec2 l = smoothstep(dw + d * 1.5, dw - d * 1.5, g) * clamp(vec2(w) / dw, 0.0, 1.0);
  l = mix(l, vec2(w), clamp(d * 2.0 - 1.0, 0.0, 1.0));
  return mix(l.x, 1.0, l.y);
}
void main() {
  vec2 p = vW.xz / 0.3; // grid every 0.3 (divides the row period → periodic)
  float line = gridLine(p, 0.035);
  // glowing dots on a finer lattice, hashed on (x mod period) so the floor repeats every row period
  vec2 q = vW.xz / 0.15;
  vec2 cell = floor(q + 0.5);
  float px = mod(cell.x, periodX / 0.15);
  float h = hash(vec2(px, cell.y));
  float dotOn = step(0.72, h);
  vec2 jit = vec2(hash(vec2(px, cell.y) + 3.1), hash(vec2(px, cell.y) + 7.7)) - 0.5;
  float tw = 0.35 + 0.65 * (0.5 + 0.5 * sin(TAU * (floor(1.0 + h * 3.0) * t + h * 7.0)));
  vec2 dq = (q - cell - jit * 0.6) * 0.15;
  float r = length(dq) / (0.005 + 0.012 * fract(h * 13.7));
  float dotv = dotOn * exp(-r * r) * tw;
  float dist = length(vW.xz - camPos.xz);
  float fade = exp(-dist * 0.05);
  vec3 c = cBase * (1.0 + 1.2 * fade) + cLine * line * 0.7 * fade + cDot * dotv * 3.4 * fade;
  c = mix(cFog, c, clamp(fade * 1.25, 0.0, 1.0));
  gl_FragColor = vec4(c, 0.82);
}
`;

const REFL_VERT = /* glsl */ `
varying vec3 vW; varying vec3 vN;
void main() {
  vec4 p = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  n = mat3(instanceMatrix) * n;
  #endif
  vec4 w = modelMatrix * p;
  vW = w.xyz; vN = normalize(n);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const REFL_FRAG = /* glsl */ `
uniform vec3 cFace; uniform vec3 lightDir;
varying vec3 vW; varying vec3 vN;
void main() {
  float ndl = abs(dot(normalize(vN), lightDir));
  float fade = exp(vW.y * 3.0) * 0.6;
  gl_FragColor = vec4(cFace * (0.35 + 0.65 * ndl) * fade, 1.0);
}
`;

const STREAM_VERT = /* glsl */ `
attribute vec4 seed; // x: phase, y: twinkle rate (int), z: drift kind, w: size
uniform float t; uniform float camX; uniform float periodX; uniform float pxScale; uniform float yRange;
varying float vB;
void main() {
  vec3 p = position;
  // drift: whole periods per loop
  if (seed.z < 0.5) p.x += periodX * t;               // horizontal dashes drift one period
  else p.y = mod(p.y - 0.4 + yRange * t * 2.0, yRange) + 0.4; // vertical dashes fall/rise twice
  float span = periodX * 4.0;
  float x0 = camX - periodX * 1.5;
  p.x = x0 + mod(p.x - x0, span);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, seed.w * pxScale / -mv.z);
  vB = 0.35 + 0.65 * (0.5 + 0.5 * sin(TAU * (seed.y * t + seed.x)));
}
`;
const STREAM_FRAG = /* glsl */ `
uniform vec3 cDot;
varying float vB;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.1, length(d));
  gl_FragColor = vec4(cDot * vB * a, 1.0);
}
`;

const buildStreams = () => {
  const r = mulberry32(0x2468ace1);
  const pos: number[] = [];
  const seed: number[] = [];
  const target = 8000;
  // dashed lines laid out inside one period [0, 14.4) then repeated ×4 along x
  const perTile: [number, number, number, number, number][] = [];
  while (perTile.length < target / 4) {
    const z = -1.6 - r() * 5.5;
    const vertical = r() < 0.45;
    const n = 4 + Math.floor(r() * 9);
    const gap = 0.07 + r() * 0.05;
    const x = r() * PERIOD_X;
    const y = Math.pow(r(), 1.4) * 2.6;
    for (let i = 0; i < n && perTile.length < target / 4; i++) {
      if (r() < 0.15) continue; // dash gaps
      perTile.push(vertical ? [x, y + i * gap, z, 1, r()] : [x + i * gap, y, z, 0, r()]);
    }
  }
  for (let k = 0; k < 4; k++)
    for (const [x, y, z, kind, ph] of perTile) {
      pos.push(x + k * PERIOD_X, y, z);
      seed.push(ph, 1 + Math.floor(ph * 4), kind, 0.011 + 0.012 * ((ph * 7.31) % 1));
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("seed", new THREE.Float32BufferAttribute(seed, 4));
  return g;
};

export const createFolderRow = () => (): Look => {
  const pipe = new Pipeline(4);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 16 / 9, 0.1, 80);
  const DEFINES = { TAU: "6.283185307179586" };

  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: BG_VERT,
      fragmentShader: BG_FRAG,
      depthWrite: false,
      uniforms: {
        cTop: { value: new THREE.Color("#06205E") },
        cMid: { value: new THREE.Color("#0C2E82") },
        cHorizon: { value: new THREE.Color("#163C9E") },
      },
    }),
  );
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  const streams = new THREE.Points(
    buildStreams(),
    new THREE.ShaderMaterial({
      vertexShader: STREAM_VERT,
      fragmentShader: STREAM_FRAG,
      defines: DEFINES,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        t: { value: 0 },
        camX: { value: 0 },
        periodX: { value: PERIOD_X },
        pxScale: { value: 1000 },
        yRange: { value: 4.2 },
        cDot: { value: new THREE.Color("#9AD4FF").multiplyScalar(3.2) },
      },
    }),
  );
  streams.frustumCulled = false;
  streams.renderOrder = -5;
  scene.add(streams);

  const faceColor = new THREE.Color("#C8D8F4");
  const nmap = grooveNormalMap();
  const front = new THREE.MeshStandardMaterial({
    color: faceColor,
    roughness: 0.55,
    metalness: 0,
    normalMap: nmap,
    normalScale: new THREE.Vector2(0.8, 0.8),
  });
  const side = new THREE.MeshStandardMaterial({ color: new THREE.Color("#8FA6D6"), roughness: 0.6 });
  const reflMat = new THREE.ShaderMaterial({
    vertexShader: REFL_VERT,
    fragmentShader: REFL_FRAG,
    side: THREE.DoubleSide,
    uniforms: { cFace: { value: faceColor.clone() }, lightDir: { value: new THREE.Vector3(-0.85, 0.3, 0.4).normalize() } },
  });

  const VISIBLE = 44; // folders drawn around the camera
  const geoL = folderShape(false);
  const geoR = folderShape(true);
  const rowL = new THREE.InstancedMesh(geoL, [front, side], VISIBLE);
  const rowR = new THREE.InstancedMesh(geoR, [front, side], VISIBLE);
  const refL = new THREE.InstancedMesh(geoL, reflMat, VISIBLE);
  const refR = new THREE.InstancedMesh(geoR, reflMat, VISIBLE);
  for (const m of [rowL, rowR, refL, refR]) m.frustumCulled = false;
  scene.add(refL, refR);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 60).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      vertexShader: FLOOR_VERT,
      fragmentShader: FLOOR_FRAG,
      defines: DEFINES,
      transparent: true,
      depthWrite: true,
      uniforms: {
        cBase: { value: new THREE.Color("#06143A") },
        cLine: { value: new THREE.Color("#3A6AD8") },
        cDot: { value: new THREE.Color("#6AB8FF") },
        cFog: { value: new THREE.Color("#12348A") },
        t: { value: 0 },
        camPos: { value: new THREE.Vector3() },
        periodX: { value: PERIOD_X },
      },
    }),
  );
  floor.renderOrder = 1;
  scene.add(floor);
  rowL.renderOrder = 2;
  rowR.renderOrder = 2;
  scene.add(rowL, rowR);

  // distance falloff into saturated blue, as in the reference
  scene.fog = new THREE.Fog(new THREE.Color("#163C9E"), 4.5, 15);
  scene.add(new THREE.HemisphereLight(new THREE.Color("#7A92E0"), new THREE.Color("#0A1A50"), 1.1));
  const key = new THREE.DirectionalLight(new THREE.Color("#C0D0FF"), 2.9);
  key.position.set(-8, 3.5, 3.5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(new THREE.Color("#4A8AFF"), 0.8);
  rim.position.set(4, 2, -5);
  scene.add(rim);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const flip = new THREE.Matrix4().makeScale(1, -1, 1);
  const zAxis = new THREE.Vector3(0, 0, 1);
  const clear = new THREE.Color("#020822");

  return {
    render(gl, frame) {
      const t = (((frame % LOOP) + LOOP) % LOOP) / LOOP; // frame 600 ≡ frame 0 exactly
      const camX = t * PERIOD_X;
      const bob = 0.025 * Math.sin(TAU * t);
      camera.position.set(camX - 3.5, 1.6 + bob, 5.0);
      camera.lookAt(camX + 1.5, 0.42 + bob * 0.5, 0);
      camera.updateMatrixWorld();

      const first = Math.floor(camX / SPACING) - 14;
      let nl = 0;
      let nr = 0;
      for (let k = 0; k < VISIBLE; k++) {
        const i = first + k;
        const v = VAR[((i % P) + P) % P];
        pos.set(i * SPACING, 0, 0);
        q.setFromAxisAngle(zAxis, v.tilt);
        s.set(1, v.h, 1);
        m4.compose(pos, q, s);
        if (v.tabRight) {
          rowR.setMatrixAt(nr, m4);
          refR.setMatrixAt(nr++, m4.clone().premultiply(flip));
        } else {
          rowL.setMatrixAt(nl, m4);
          refL.setMatrixAt(nl++, m4.clone().premultiply(flip));
        }
      }
      rowL.count = refL.count = nl;
      rowR.count = refR.count = nr;
      for (const m of [rowL, rowR, refL, refR]) m.instanceMatrix.needsUpdate = true;

      const fu = (floor.material as THREE.ShaderMaterial).uniforms;
      fu.t.value = t;
      fu.camPos.value.copy(camera.position);
      const su = (streams.material as THREE.ShaderMaterial).uniforms;
      su.t.value = t;
      su.camX.value = camX;

      pipe.begin(gl, clear);
      camera.aspect = pipe.w / pipe.h;
      camera.updateProjectionMatrix();
      su.pxScale.value = (pipe.h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) * 1.0;
      gl.render(scene, camera);
      pipe.finish(gl, {
        camera,
        dof: { focus: 5.6, range: 1.2, aperture: 0.35, maxRadius: 0.006 },
        bloom: { strength: 0.6, threshold: 0.85, knee: 0.4 },
        final: {
          frame,
          period: LOOP,
          grain: 0.02,
          vignette: 0.35,
          flare: { pos: [-0.01, 0.6], color: new THREE.Color("#4A8AFF"), radius: 0.2, intensity: 0.7, streak: 0.5 },
        },
      });
    },
    dispose() {
      pipe.dispose();
    },
  };
};
