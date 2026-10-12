import * as THREE from "three";
import { circuitTextures, LAYOUTS, PLATE_VARIANTS } from "./circuit";
import { buildRibbons, buildSprites, Polyline, RIBBON_VERT, SPRITE_VERT } from "./geom";
import { mulberry32 } from "./random";

// Shared kit for Looks 4 and 5: circuit plates and fibre bundles.

export type FibrePalette = {
  fibre: string; // fibres, pads and traces
  pulse: string;
  fog: string;
  plate: string;
  fogDensity: number;
  plateEmissive: number;
  fibreGain: number;
  /** Bright bevel edge strength. */
  edge: number;
  /** Ambient light and reflection strength. */
  light: number;
  /** Backdrop gradient (sky above, haze below). */
  bgTop: string;
  bgBottom: string;
  /** Metal collars where bundles meet pads. */
  collars: boolean;
  /** Moving bead dots per fibre, and their radius (world). */
  beads: number;
  beadSize: number;
  /** 0 = beads in the pulse colour, 1 = in the fibre colour. */
  beadTint: number;
  /** Static glowing dots where fibres meet the pads at both ends. */
  endDots: boolean;
  /** Soft glow pool on the plate around each bundle's pad. */
  pool: number;
  /** Dashed light strip along the bevel instead of a solid one. */
  dashedEdge: boolean;
  /** Circuit texture repeats across a plate (smaller, finer detail). */
  circuitRepeat: number;
};

export type PlateSpec = {
  variant: number;
  /** World transform; plate-local x across, y up (thickness), z along. */
  matrix: THREE.Matrix4;
  /** Uniform scale applied to the variant's unit size. */
  size: number;
};

export type BundleSpec = {
  from: THREE.Vector3; // pad centre (world) where fibres leave
  to: THREE.Vector3; // pad centre (world) or far end out of frame
  padR: number; // pad radius (world)
  toR: number; // spread radius at the far end
  count: number;
  seed: number;
  hang: boolean; // true: hangs out of frame and flares wide
  width: number; // fibre width (world)
};

export const THICK = 0.085;

/** Pad centres in world space for a plate (underside or top). */
export const padsOf = (p: PlateSpec, side: -1 | 1) => {
  const L = LAYOUTS[p.variant];
  return L.pads.map((pad) => ({
    pos: new THREE.Vector3(pad.x * p.size, side * (THICK / 2) * p.size, -pad.y * p.size).applyMatrix4(
      p.matrix,
    ),
    r: pad.r * p.size,
  }));
};

const plateGeometry = (variant: number) => {
  const [w, h] = PLATE_VARIANTS[variant];
  const bev = 0.012;
  const shape = new THREE.Shape();
  const x0 = -w / 2 + bev;
  const y0 = -h / 2 + bev;
  shape.moveTo(x0, y0);
  shape.lineTo(-x0, y0);
  shape.lineTo(-x0, -y0);
  shape.lineTo(x0, -y0);
  shape.lineTo(x0, y0);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: THICK - 2 * bev,
    bevelEnabled: true,
    bevelThickness: bev,
    bevelSize: bev,
    bevelSegments: 2,
    curveSegments: 1,
  });
  g.translate(0, 0, -(THICK - 2 * bev) / 2);
  // Shape xy -> plate xz, extrude z -> plate y.
  g.rotateX(-Math.PI / 2);
  // Cap UVs come from shape coordinates; map them to 0..1 over the plate.
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, pos.getX(i) / w + 0.5, -pos.getZ(i) / h + 0.5);
  }
  g.computeVertexNormals();
  return g;
};

const repeated = (t: THREE.Texture, n: number) => {
  const c = t.clone();
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(n, n);
  c.needsUpdate = true;
  return c;
};

const envMapFor = (gl: THREE.WebGLRenderer, P: FibrePalette) => {
  const scene = new THREE.Scene();
  const fog = new THREE.Color(P.fog);
  const fib = new THREE.Color(P.fibre);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(10, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { uFog: { value: fog }, uFib: { value: fib } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uFog; uniform vec3 uFib; varying vec3 vP;
        void main(){
          float t = vP.y * 0.5 + 0.5;
          vec3 c = mix(uFog * 1.6 + uFib * 0.05, uFog * 2.4 + uFib * 0.2, smoothstep(0.2, 1.0, t));
          // A few soft bright bands to give the clearcoat something to reflect.
          c += uFib * 0.9 * smoothstep(0.92, 0.99, sin(vP.x * 4.0 + 0.5) * 0.5 + 0.5) * smoothstep(0.4, 0.8, t);
          c += vec3(1.0) * 0.5 * smoothstep(0.97, 1.0, dot(vP, normalize(vec3(-0.4, 0.8, 0.3))));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  scene.add(sky);
  const pm = new THREE.PMREMGenerator(gl);
  const rt = pm.fromScene(scene, 0.02);
  pm.dispose();
  sky.geometry.dispose();
  (sky.material as THREE.Material).dispose();
  return rt.texture;
};

/** Spline points for one fibre. */
const fibrePoints = (b: BundleSpec, i: number, rng: () => number) => {
  const A = b.from;
  const B = b.to;
  const axis = B.clone().sub(A);
  const len = axis.length();
  const dir = axis.clone().normalize();
  const ref = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const e1 = ref.clone().cross(dir).normalize();
  const e2 = dir.clone().cross(e1).normalize();
  // Plate plane for the leaving end (plates are horizontal).
  const pe1 = new THREE.Vector3(1, 0, 0);
  const pe2 = new THREE.Vector3(0, 0, 1);
  const golden = 2.39996323;
  const th = i * golden + rng() * 0.5;
  const rr = Math.sqrt((i + 0.5) / b.count);
  const ring = (r: number, u1: THREE.Vector3, u2: THREE.Vector3, t = th) =>
    u1.clone().multiplyScalar(Math.cos(t) * r).addScaledVector(u2, Math.sin(t) * r);
  const trunkR = b.padR * 0.5;
  const pts: THREE.Vector3[] = [];
  // Fibres leave from the whole pad face, not one point.
  const P0 = A.clone().add(ring(b.padR * (0.12 + 0.8 * rr), pe1, pe2));
  const down = new THREE.Vector3(0, -1, 0);
  const P1 = A.clone()
    .addScaledVector(down, Math.min(0.3, len * 0.12))
    .add(ring(b.padR * (0.3 + 0.75 * rr), pe1, pe2));
  const midT = b.hang ? 0.3 + rng() * 0.08 : 0.42 + rng() * 0.16;
  const P2 = A.clone()
    .addScaledVector(axis, midT)
    .add(ring(trunkR * Math.sqrt(rng()), e1, e2, th + 0.3));
  let P3: THREE.Vector3;
  let P4: THREE.Vector3;
  if (b.hang) {
    // Flare wide like roots and leave the frame.
    const spread = b.toR * (0.35 + 0.65 * Math.sqrt(rng()));
    const t2 = th + (rng() - 0.5) * 0.4;
    P3 = A.clone().addScaledVector(axis, 0.6).add(ring(spread * 0.6, e1, e2, t2));
    P4 = B.clone().add(ring(spread, e1, e2, t2)).addScaledVector(dir, (rng() - 0.5) * len * 0.2);
  } else {
    P3 = B.clone()
      .addScaledVector(down, -Math.min(0.18, len * 0.08))
      .add(ring(b.toR * (0.45 + 0.55 * rr), pe1, pe2, th + 0.2));
    P4 = B.clone().add(ring(b.toR * (0.35 + 0.6 * rr), pe1, pe2, th + 0.2));
  }
  const curve = new THREE.CatmullRomCurve3([P0, P1, P2, P3, P4], false, "centripetal");
  const n = Math.max(14, Math.min(56, Math.round(len * 14)));
  for (let k = 0; k <= n; k++) pts.push(curve.getPoint(k / n));
  return { pts, len: curve.getLength() };
};

const FIBRE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uPulse;
uniform float uFrame;
uniform float uGain;
uniform float uFog;
uniform float uPulseLen;
varying float vSide;
varying float vU;
varying float vSeed;
varying float vAlpha;
varying float vExtra;
varying float vViewZ;
float pulse(float u, float pos, float len) {
  float d = abs(u - pos);
  d = min(d, 1.0 - d);
  return exp(-d * d / (len * len));
}
void main() {
#ifdef DEPTH_ONLY
  if (abs(vSide) > 0.6) discard;
  gl_FragColor = vec4(0.0);
#else
  float a = 1.0 - smoothstep(0.5, 1.0, abs(vSide));
  float ends = exp(-vU / 0.05) + exp(-(1.0 - vU) / 0.05);
  float base = 0.42 + 0.9 * ends;
  float periods[6] = float[6](100.0, 120.0, 150.0, 200.0, 300.0, 600.0);
  float period = periods[int(floor(fract(vSeed * 13.17) * 5.999))];
  float ph = fract(vSeed * 7.31);
  float t = uFrame / period + ph;
  float len = uPulseLen / max(vExtra, 0.1);
  float p = pulse(vU, fract(t), len) + pulse(vU, fract(t + 0.37), len) * 0.8 + pulse(vU, fract(t + 0.71), len) * 0.6;
  float fog = exp(-vViewZ * vViewZ * uFog * uFog);
  vec3 col = uColor * base + uPulse * p * 1.5;
  gl_FragColor = vec4(col * a * vAlpha * uGain * fog, 1.0);
#endif
}
`;

const BEAD_FRAG = /* glsl */ `
uniform float uFog;
varying vec2 vCorner;
varying vec3 vColor;
varying float vAlpha;
varying float vViewZ;
void main() {
  float r = length(vCorner);
  if (r > 1.0) discard;
  float core = 1.0 - smoothstep(0.55, 1.0, r);
  core += 1.5 * (1.0 - smoothstep(0.0, 0.4, r));
  float fog = exp(-vViewZ * vViewZ * uFog * uFog);
  gl_FragColor = vec4(vColor * core * vAlpha * fog * 2.2, 1.0);
}
`;

const POOL_FRAG = /* glsl */ `
uniform float uFog;
varying vec2 vCorner;
varying vec3 vColor;
varying float vAlpha;
varying float vViewZ;
void main() {
  float r2 = dot(vCorner, vCorner);
  if (r2 > 1.0) discard;
  float g = exp(-r2 * 4.0) - exp(-4.0);
  float fog = exp(-vViewZ * vViewZ * uFog * uFog);
  gl_FragColor = vec4(vColor * g * vAlpha * fog, 1.0);
}
`;

const TRACE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uPulse;
uniform float uFrame;
uniform float uFog;
uniform float uGain;
varying float vSide;
varying float vU;
varying float vSeed;
varying float vAlpha;
varying float vExtra;
varying float vViewZ;
void main() {
  float a = 1.0 - smoothstep(0.5, 1.0, abs(vSide));
  float periods[5] = float[5](60.0, 75.0, 100.0, 120.0, 150.0);
  float period = periods[int(floor(fract(vSeed * 3.71) * 4.999))];
  float pos = fract(uFrame / period + fract(vSeed * 9.13));
  float len = 0.022 / max(vExtra, 0.05);
  float d = vU - pos;
  float p = exp(-d * d / (len * len)) * step(0.0, 1.0 - abs(d) * 3.0);
  float fog = exp(-vViewZ * vViewZ * uFog * uFog);
  vec3 col = uColor * 0.1 + (uPulse * 0.4 + uColor * 0.6) * p * 1.4;
  gl_FragColor = vec4(col * a * vAlpha * fog * uGain, 1.0);
}
`;

export type FibreKit = {
  group: THREE.Group;
  depthGroup: THREE.Group;
  update: (frame: number, w: number, h: number, k: number, cam?: THREE.Camera) => void;
  clearColor: THREE.Color;
  dispose: () => void;
};

export const buildFibreKit = (
  gl: THREE.WebGLRenderer,
  P: FibrePalette,
  plates: PlateSpec[],
  bundles: BundleSpec[],
  scene: THREE.Scene,
): FibreKit => {
  const group = new THREE.Group();
  const depthGroup = new THREE.Group();
  const fogCol = new THREE.Color(P.fog);
  scene.fog = new THREE.FogExp2(fogCol, P.fogDensity);
  const env = envMapFor(gl, P);
  const tex = circuitTextures();
  const fib = new THREE.Color(P.fibre);
  const pulse = new THREE.Color(P.pulse);

  // Plates: one InstancedMesh per variant.
  PLATE_VARIANTS.forEach((_, v) => {
    const list = plates.filter((p) => p.variant === v);
    if (!list.length) return;
    const geo = plateGeometry(v);
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(P.plate),
      roughness: 0.25,
      metalness: 0.35,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMap: env,
      envMapIntensity: P.light,
      emissive: fib,
      emissiveMap: P.circuitRepeat === 1 ? tex[v] : repeated(tex[v], P.circuitRepeat),
      emissiveIntensity: P.plateEmissive,
    });
    // Bright bevel edges: add a rim term where the normal turns sideways.
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uDash = { value: P.dashedEdge ? 1 : 0 };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
        .replace(
          "#include <project_vertex>",
          "#include <project_vertex>\nvWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;",
        );
      sh.uniforms.uEdge = { value: P.edge };
      sh.uniforms.uEdgeCol = { value: fib.clone() };
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uEdge;\nuniform vec3 uEdgeCol;\nuniform float uDash;\nvarying vec3 vWPos;")
        .replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\n{ vec3 nV = normalize(vNormal); float side = 1.0 - abs(dot(nV, normalize((viewMatrix * vec4(0.0,1.0,0.0,0.0)).xyz))); float dash = mix(1.0, step(0.5, fract((vWPos.x + vWPos.z) * 16.0)), uDash); totalEmissiveRadiance += uEdgeCol * uEdge * dash * smoothstep(0.08, 0.3, side) * (1.0 - smoothstep(0.55, 0.85, side)); }",
        );
    };
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((p, i) => {
      const m = p.matrix.clone().multiply(new THREE.Matrix4().makeScale(p.size, p.size, p.size));
      mesh.setMatrixAt(i, m);
    });
    mesh.frustumCulled = false;
    group.add(mesh);
  });

  // Fibres
  const lines: Polyline[] = [];
  const tips: { pos: THREE.Vector3; size: number; color: THREE.Color; seed: number }[] = [];
  bundles.forEach((b) => {
    const rng = mulberry32(b.seed);
    for (let i = 0; i < b.count; i++) {
      const { pts, len } = fibrePoints(b, i, rng);
      lines.push({ points: pts, width: b.width * (0.6 + rng() * 0.9), seed: rng(), extra: len });
      // Glowing tip where a hanging fibre ends.
      if (b.hang) tips.push({ pos: pts[pts.length - 1], size: P.beadSize * 1.2, color: fib, seed: i });
      else if (P.endDots) {
        tips.push({ pos: pts[0], size: P.beadSize * 1.1, color: fib, seed: i });
        tips.push({ pos: pts[pts.length - 1], size: P.beadSize * 1.3, color: fib, seed: i });
      }
    }
  });
  const res = new THREE.Vector2(1, 1);
  const frameU = { value: 0 };
  const minPx = { value: 1 };
  const fogU = { value: P.fogDensity };
  const fibreGeo = buildRibbons(lines);
  const fibreMat = new THREE.ShaderMaterial({
    vertexShader: RIBBON_VERT,
    fragmentShader: FIBRE_FRAG,
    uniforms: {
      uRes: { value: res },
      uMinPx: minPx,
      uColor: { value: fib },
      uPulse: { value: pulse },
      uFrame: frameU,
      uGain: { value: P.fibreGain },
      uFog: fogU,
      uPulseLen: { value: 0.035 },
    },
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    depthWrite: false,
    transparent: true,
  });
  const fibreMesh = new THREE.Mesh(fibreGeo, fibreMat);
  fibreMesh.frustumCulled = false;
  fibreMesh.renderOrder = 5;
  group.add(fibreMesh);
  const fibreDepth = fibreMat.clone();
  fibreDepth.uniforms = fibreMat.uniforms;
  fibreDepth.defines = { DEPTH_ONLY: 1 };
  fibreDepth.blending = THREE.NoBlending;
  fibreDepth.colorWrite = false;
  fibreDepth.depthWrite = true;
  fibreDepth.transparent = false;
  const fd = new THREE.Mesh(fibreGeo, fibreDepth);
  fd.frustumCulled = false;
  depthGroup.add(fd);

  // Bead dots travelling along the fibres. Positions are recomputed from the
  // frame each time (period divides the loop), never accumulated.
  const B = P.beads;
  const beadCol = pulse.clone().lerp(fib, P.beadTint);
  const beadItems = lines.flatMap((l, li) =>
    Array.from({ length: B }, (_, b) => ({ pos: l.points[0], size: P.beadSize, color: beadCol, seed: li * 8 + b })),
  );
  const beadGeo = buildSprites([...beadItems, ...tips]);
  const beadPos = beadGeo.getAttribute("iPos") as THREE.InstancedBufferAttribute;
  const PERIODS6 = [100, 120, 150, 200, 300, 600];
  const beadSched = lines.map((l) => ({
    period: PERIODS6[Math.floor((((l.seed * 13.17) % 1) + 1) % 1 * 5.999)],
    phase: (l.seed * 7.31) % 1,
  }));
  const beadMat = new THREE.ShaderMaterial({
    vertexShader: SPRITE_VERT,
    fragmentShader: BEAD_FRAG,
    uniforms: { uRes: { value: res }, uMinPx: minPx, uSizeMul: { value: 1 }, uFog: fogU },
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    depthWrite: false,
    transparent: true,
  });
  const beadMesh = new THREE.Mesh(beadGeo, beadMat);
  beadMesh.frustumCulled = false;
  beadMesh.renderOrder = 6;
  if (B > 0 || tips.length) group.add(beadMesh);
  const tmp = new THREE.Vector3();
  const placeBeads = (frame: number) => {
    lines.forEach((l, li) => {
      const sc = beadSched[li];
      const pts = l.points;
      for (let b = 0; b < B; b++) {
        const u = (((frame / sc.period + sc.phase + b / B) % 1) + 1) % 1;
        const x = u * (pts.length - 1);
        const i0 = Math.min(pts.length - 2, Math.floor(x));
        tmp.copy(pts[i0]).lerp(pts[i0 + 1], x - i0);
        beadPos.setXYZ(li * B + b, tmp.x, tmp.y, tmp.z);
      }
    });
    beadPos.needsUpdate = true;
  };

  // Glow pools on the plates around each bundle's pad.
  if (P.pool > 0) {
    const pools = bundles.flatMap((b, i) => {
      const c = fib.clone().multiplyScalar(P.pool);
      const out = [{ pos: b.from.clone().add(new THREE.Vector3(0, -0.004, 0)), size: b.padR * 5, color: c, seed: i }];
      if (!b.hang) out.push({ pos: b.to.clone().add(new THREE.Vector3(0, 0.004, 0)), size: b.toR * 4, color: c, seed: i });
      return out;
    });
    const poolMesh = new THREE.Mesh(
      buildSprites(pools),
      new THREE.ShaderMaterial({
        vertexShader: SPRITE_VERT,
        fragmentShader: POOL_FRAG,
        uniforms: { uRes: { value: res }, uMinPx: minPx, uSizeMul: { value: 1 }, uFog: fogU },
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        depthWrite: false,
        transparent: true,
      }),
    );
    poolMesh.frustumCulled = false;
    poolMesh.renderOrder = 3;
    group.add(poolMesh);
  }

  // Backdrop: vertical gradient on a sphere that follows the camera.
  const backdrop = new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { uTop: { value: new THREE.Color(P.bgTop) }, uBottom: { value: new THREE.Color(P.bgBottom) } },
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 w = modelMatrix * vec4(position,1.0); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec3 uTop; uniform vec3 uBottom; varying vec3 vD;
        void main(){ float t = smoothstep(-0.45, 0.6, vD.y); gl_FragColor = vec4(mix(uBottom, uTop, t), 1.0); }`,
    }),
  );
  backdrop.renderOrder = -10;
  backdrop.frustumCulled = false;
  group.add(backdrop);

  // Ferrules: a short glowing collar where each bundle meets its pad(s).
  const collars: { pos: THREE.Vector3; r: number; dir: number }[] = [];
  bundles.forEach((b) => {
    collars.push({ pos: b.from, r: b.padR, dir: -1 });
    if (!b.hang) collars.push({ pos: b.to, r: b.toR, dir: 1 });
  });
  if (collars.length && P.collars) {
    const cg = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true);
    cg.translate(0, 0.5, 0);
    const cm = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(P.plate).lerp(new THREE.Color(0.6, 0.7, 0.8), 0.4),
      metalness: 0.9,
      roughness: 0.22,
      envMap: env,
      envMapIntensity: 2.0,
      emissive: fib,
      emissiveIntensity: 0.12,
      side: THREE.DoubleSide,
    });
    const im = new THREE.InstancedMesh(cg, cm, collars.length);
    collars.forEach((c, i) => {
      const m = new THREE.Matrix4()
        .makeTranslation(c.pos.x, c.pos.y, c.pos.z)
        .multiply(new THREE.Matrix4().makeScale(c.r * 1.12, c.r * 1.1 * c.dir, c.r * 1.12));
      im.setMatrixAt(i, m);
    });
    im.frustumCulled = false;
    group.add(im);
  }

  // Traces with pulses on top and underside of each plate.
  const traces: Polyline[] = [];
  plates.forEach((p, pi) => {
    const L = LAYOUTS[p.variant];
    const rng = mulberry32(7000 + pi);
    ([-1, 1] as const).forEach((side) => {
      L.traces.forEach((t) => {
        if (rng() > 0.55) return;
        const pts = t.map(([x, y]) =>
          new THREE.Vector3(x * p.size, side * (THICK / 2 + 0.0015) * p.size, -y * p.size).applyMatrix4(p.matrix),
        );
        // Densify so the ribbon follows the corners cleanly.
        const dense: THREE.Vector3[] = [];
        for (let s = 0; s < pts.length - 1; s++) {
          for (let k = 0; k < 6; k++) dense.push(pts[s].clone().lerp(pts[s + 1], k / 6));
        }
        dense.push(pts[pts.length - 1]);
        let len = 0;
        for (let s = 0; s < pts.length - 1; s++) len += pts[s].distanceTo(pts[s + 1]);
        traces.push({ points: dense, width: 0.0055 * p.size, seed: rng(), extra: len });
      });
    });
  });
  const traceMat = new THREE.ShaderMaterial({
    vertexShader: RIBBON_VERT,
    fragmentShader: TRACE_FRAG,
    uniforms: {
      uRes: { value: res },
      uMinPx: minPx,
      uColor: { value: fib },
      uPulse: { value: pulse },
      uFrame: frameU,
      uFog: fogU,
      uGain: { value: Math.min(1, P.plateEmissive / 0.6) },
    },
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    depthWrite: false,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const traceMesh = new THREE.Mesh(buildRibbons(traces), traceMat);
  traceMesh.frustumCulled = false;
  traceMesh.renderOrder = 4;
  group.add(traceMesh);

  const light = new THREE.HemisphereLight(
    fogCol.clone().multiplyScalar(2.0),
    fogCol.clone().multiplyScalar(3.0).add(fib.clone().multiplyScalar(0.15)),
    3.0 * P.light,
  );
  group.add(light);
  const key = new THREE.DirectionalLight(0xffffff, 0.6 * P.light);
  key.position.set(-2, 4, 3);
  group.add(key);

  return {
    group,
    depthGroup,
    clearColor: fogCol,
    update: (frame, w, h, k, cam?: THREE.Camera) => {
      res.set(w, h);
      frameU.value = frame;
      minPx.value = Math.max(1, 2.2 * k);
      placeBeads(frame);
      if (cam) backdrop.position.copy(cam.position);
    },
    dispose: () => {
      fibreGeo.dispose();
      env.dispose();
    },
  };
};
