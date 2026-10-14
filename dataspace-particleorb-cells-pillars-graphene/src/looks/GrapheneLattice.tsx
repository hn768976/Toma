import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { mulberry32, phaseOf, TAU } from "../lib/random";
import { BG_VERT, CameraPose, ThreeStage } from "../three/ThreeStage";
import { useBufferSize } from "../three/useBuffer";
import type { GraphenePalette } from "../versions";

// ---- Honeycomb lattice ---------------------------------------------------
// Bond length B. Lattice vectors a1 = (sqrt3 B, 0), a2 = (sqrt3/2 B, 3/2 B).
// Two atoms per cell: A at (0,0), B at (0,B). Every A(i,j) bonds to B(i,j),
// B(i,j-1) and B(i+1,j-1) — all at distance exactly B — so every atom has
// three neighbours and every ring is a hexagon. The sheet is periodic in x
// (NX cells), which makes a drift of one cell (= one hexagon) loop exactly.
const B = 1;
const SQ3 = Math.sqrt(3);
const NX = 14;
const NY = 10;
const WIDTH = NX * SQ3 * B;
const ATOM_R = 0.25;
const CORE_R = 0.13;
const BOND_R = 0.026;

type Atom = { x: number; y: number };
const LATTICE = (() => {
  const atoms: Atom[] = [];
  const idx = (i: number, j: number, s: 0 | 1) => (j * NX + (((i % NX) + NX) % NX)) * 2 + s;
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      // rows shear by half a cell; wrap x into [0, WIDTH)
      const x0 = (((i * SQ3 + j * SQ3 * 0.5) * B) % WIDTH + WIDTH) % WIDTH;
      const y0 = j * 1.5 * B;
      atoms.push({ x: x0, y: y0 }); // A
      atoms.push({ x: x0, y: y0 + B }); // B
    }
  }
  const bonds: [number, number][] = [];
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      bonds.push([idx(i, j, 0), idx(i, j, 1)]);
      if (j > 0) {
        bonds.push([idx(i, j, 0), idx(i, j - 1, 1)]);
        bonds.push([idx(i, j, 0), idx(i + 1, j - 1, 1)]);
      }
    }
  }
  return { atoms, bonds };
})();

// Geometry self-check at load: every bond has length B (with x wrap), and
// every interior atom has exactly 3 bonds.
(() => {
  const deg = new Array(LATTICE.atoms.length).fill(0);
  for (const [a, b] of LATTICE.bonds) {
    const A = LATTICE.atoms[a], Bt = LATTICE.atoms[b];
    let dx = Bt.x - A.x;
    dx -= Math.round(dx / WIDTH) * WIDTH;
    const d = Math.hypot(dx, Bt.y - A.y);
    if (Math.abs(d - B) > 1e-6) throw new Error(`Graphene bond length ${d}`);
    deg[a]++; deg[b]++;
  }
  for (let j = 1; j < NY - 1; j++) for (let i = 0; i < NX; i++) for (const s of [0, 1]) {
    if (deg[(j * NX + i) * 2 + s] !== 3) throw new Error("Graphene atom without 3 bonds");
  }
})();

const SHEET_CY = (NY * 1.5 * B) / 2;

/** Sheet surface: lattice coords (x,y) -> world, with drift, bend and ripple. */
const sheetPoint = (x: number, y: number, p: number, out: THREE.Vector3) => {
  const drift = p * SQ3 * B; // exactly one hexagon per loop
  const u = ((x + drift) % WIDTH + WIDTH) % WIDTH - WIDTH / 2;
  const v = y - SHEET_CY;
  const bend = -0.010 * (u * u) - 0.006 * (v * v);
  const ripple = 0.05 * Math.sin(TAU * (u / (WIDTH / 3) + v / 9 - p)) + 0.025 * Math.sin(TAU * (v / 6 - 2 * p) + 1.3);
  return out.set(u, v, bend + ripple);
};

// ---- Background (teal gradient + bokeh + out-of-focus spheres) -----------
const BOKEH = (() => {
  const rnd = mulberry32(2270618552);
  const blobs = Array.from({ length: 12 }, () => ({
    x: rnd(), y: rnd(), r: 0.08 + rnd() * 0.14, a: 0.3 + rnd() * 0.2, ph: rnd(), amp: 0.01 + rnd() * 0.025, cyc: 1 + Math.floor(rnd() * 2),
  }));
  const spheres = Array.from({ length: 20 }, () => ({
    x: rnd(), y: rnd(), r: 0.02 + Math.pow(rnd(), 2) * 0.06, a: 0.25 + rnd() * 0.35, ph: rnd(), amp: 0.01 + rnd() * 0.03, cyc: 1 + Math.floor(rnd() * 2),
  }));
  return { blobs, spheres };
})();

const BG_FRAG = /* glsl */ `
uniform vec3 uA; uniform vec3 uB; uniform vec3 uBokeh; uniform vec3 uSphere;
uniform vec4 uBlobs[12]; uniform vec4 uSpheres[20];
uniform vec2 uRes;
in vec2 vUv;
out vec4 fragColor;
void main(){
  vec2 uv = vUv;
  float asp = uRes.x / uRes.y;
  vec2 q = (uv - vec2(0.55, 0.55)) * vec2(asp, 1.0);
  // brighter teal toward the middle, deep teal at the edges
  vec3 col = mix(uB * 1.1, uA, smoothstep(0.25, 1.2, length(q)));
  // warm diffuse haze right of centre, darker navy-teal corners
  vec2 hq = (uv - vec2(0.6, 0.48)) * vec2(asp, 1.0);
  col = mix(col, uBokeh * 1.1, 0.6 * exp(-dot(hq, hq) / 0.025));
  vec2 hq3 = (uv - vec2(0.5, 0.95)) * vec2(asp, 1.0);
  col = mix(col, uBokeh, 0.35 * exp(-dot(hq3, hq3) / 0.02));
  vec2 hq4 = (uv - vec2(0.25, 0.55)) * vec2(asp, 1.0);
  col = mix(col, uBokeh, 0.22 * exp(-dot(hq4, hq4) / 0.02));
  vec2 hq2 = (uv - vec2(0.88, 0.4)) * vec2(asp, 1.0);
  col = mix(col, uBokeh * vec3(1.0, 0.8, 0.55), 0.45 * exp(-dot(hq2, hq2) / 0.012));
  // mottled, cloudy texture with fine speckle
  float m1 = sin(uv.x * 23.0 + sin(uv.y * 17.0) * 2.0) * sin(uv.y * 19.0 + sin(uv.x * 13.0) * 2.0);
  col *= 1.0 + 0.06 * m1;
  vec2 cell = floor(uv * uRes / (uRes.y / 180.0));
  float sp = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
  
  vec2 vq = (uv - vec2(0.45, 0.6)) * vec2(asp, 1.0);
  col *= 1.0 - 0.3 * smoothstep(0.6, 1.3, length(vq));
  for (int i = 0; i < 12; i++) {
    vec4 b = uBlobs[i];
    vec2 d = (uv - b.xy) * vec2(asp, 1.0);
    float r = length(d) / b.z;
    float disk = exp(-r * r * 2.2);
    col = mix(col, uBokeh, disk * b.w * 0.5);
  }
  for (int i = 0; i < 20; i++) {
    vec4 s = uSpheres[i];
    vec2 d = (uv - s.xy) * vec2(asp, 1.0);
    float r = length(d) / s.z;
    float disk = (1.0 - smoothstep(0.2, 1.0, r)) * 0.6;
    // soft shaded sphere: lighter upper-left, glowing core
    float sh = 0.75 + 0.35 * clamp(-(d.x + d.y) / s.z, -1.0, 1.0);
    vec3 sc = uSphere * sh + uSphere * 0.6 * exp(-r * r * 6.0);
    col = mix(col, sc, disk * s.w * 0.55);
  }
  fragColor = vec4(col, 1.0);
}
`;

const makeEnv = (gl: THREE.WebGLRenderer, palette: GraphenePalette) => {
  // Small procedural environment: teal surround with warm cream panels.
  const scene = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(10, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { uA: { value: new THREE.Color(palette.bgA) }, uB: { value: new THREE.Color(palette.bgB) } },
      vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 uA; uniform vec3 uB; varying vec3 vP; void main(){ float t = normalize(vP).y*0.5+0.5; gl_FragColor = vec4(mix(uA, uB*1.3, t), 1.0); }",
    }),
  );
  scene.add(sky);
  const panel = (c: string, intensity: number, pos: [number, number, number], s: [number, number]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s[0], s[1]), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  panel(palette.bokeh, 6, [-4, 5, 5], [6, 0.6]);
  panel(palette.bokeh, 2.5, [5, 2, 4], [0.6, 4]);
  panel("#ffffff", 3, [0, 7, -2], [6, 2]);
  const pm = new THREE.PMREMGenerator(gl);
  const rt = pm.fromScene(scene, 0.02);
  pm.dispose();
  return rt.texture;
};

const Scene: React.FC<{ palette: GraphenePalette; frame: number }> = ({ palette, frame }) => {
  const { gl, scene } = useThree();
  const { w, h } = useBufferSize();
  const p = phaseOf(frame);

  const objs = useMemo(() => {
    const env = makeEnv(gl, palette);
    const nA = LATTICE.atoms.length, nB = LATTICE.bonds.length;
    const shellMat = new THREE.MeshPhysicalMaterial({
      // dark tinted body: with transmission 0.3 most of what reads is the
      // reflections, the transmitted core and the gold rim
      color: new THREE.Color(palette.atom).multiplyScalar(0.8),
      metalness: 0.0,
      roughness: 0.06,
      transmission: 0.3,
      thickness: 0.25,
      ior: 1.5,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMap: env,
      envMapIntensity: 1.4,
      specularIntensity: 1,
      attenuationColor: new THREE.Color(palette.atom),
      attenuationDistance: 0.18,
      transparent: true,
      opacity: 0.18,
      depthWrite: true,
    });
    // glass edge: opacity and a darker gold tint rise toward the silhouette
    const rimCol = new THREE.Color(palette.atom).lerp(new THREE.Color(palette.core), 0.2).multiplyScalar(0.2);
    shellMat.onBeforeCompile = (sh) => {
      sh.uniforms.uRimCol = { value: rimCol };
      sh.fragmentShader = sh.fragmentShader
        .replace("void main() {", "uniform vec3 uRimCol;\nvoid main() {")
        .replace("#include <dithering_fragment>", `#include <dithering_fragment>
        float frR = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 1.6);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uRimCol * (0.6 + 0.6 * frR), smoothstep(0.25, 0.8, frR) * 0.9);
        // thin bright refractive edge ring
        gl_FragColor.rgb += uRimCol * 6.0 * smoothstep(0.86, 0.97, frR) * (1.0 - smoothstep(0.985, 1.0, frR));
        gl_FragColor.a = mix(gl_FragColor.a, 0.92, frR);`);
    };
    const shells = new THREE.InstancedMesh(new THREE.SphereGeometry(ATOM_R, 40, 28), shellMat, nA);
    // emissive warm core: hot centre fading to the core colour at its edge
    const coreMat = new THREE.ShaderMaterial({
      uniforms: { uCore: { value: new THREE.Color(palette.core) } },
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main(){ vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0); vV = -mv.xyz;
          vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uCore; varying vec3 vN; varying vec3 vV;
        void main(){ float ndv = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
          vec3 hot = uCore / max(uCore.r, max(uCore.g, uCore.b)) * 1.3 + vec3(0.12, 0.12, 0.0);
          vec3 c = mix(uCore * 0.5, mix(uCore * 1.1, hot * 1.15 + vec3(0.25, 0.22, 0.12), 0.6), pow(ndv, 1.2));
          c += vec3(1.0, 0.9, 0.7) * pow(max(dot(reflect(-normalize(vV), normalize(vN)), normalize(vec3(-0.3, 0.6, 0.7))), 0.0), 40.0) * 0.8;
          gl_FragColor = vec4(c, 1.0); }`,
    });
    const cores = new THREE.InstancedMesh(new THREE.SphereGeometry(CORE_R, 24, 16), coreMat, nA);
    const bondMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(palette.bond), metalness: 0, roughness: 0.05, transmission: 0.7, transparent: true, opacity: 0.75, thickness: 0.05, ior: 1.4,
      clearcoat: 1, envMap: env, envMapIntensity: 3.2, emissive: new THREE.Color(palette.bond).multiplyScalar(0.12),
    });
    const bondGeo = new THREE.CylinderGeometry(BOND_R, BOND_R, 1, 12, 1, true);
    const bonds = new THREE.InstancedMesh(bondGeo, bondMat, nB);
    [shells, cores, bonds].forEach((m) => { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); });

    const bgUniforms = {
      uA: { value: new THREE.Color(palette.bgA) }, uB: { value: new THREE.Color(palette.bgB) },
      uBokeh: { value: new THREE.Color(palette.bokeh) },
      uSphere: { value: new THREE.Color(palette.atom).lerp(new THREE.Color(palette.bokeh), 0.5) },
      uBlobs: { value: BOKEH.blobs.map(() => new THREE.Vector4()) },
      uSpheres: { value: BOKEH.spheres.map(() => new THREE.Vector4()) },
      uRes: { value: new THREE.Vector2(1280, 720) },
    };
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: BG_VERT, fragmentShader: BG_FRAG, uniforms: bgUniforms, depthWrite: false,
    }));
    bg.frustumCulled = false; bg.renderOrder = -1;
    const group = new THREE.Group();
    group.add(bonds, shells, cores);
    const key = new THREE.DirectionalLight(0xfff2dd, 2.2);
    key.position.set(-3, 5, 6);
    const fill = new THREE.DirectionalLight(new THREE.Color(palette.bgB), 0.8);
    fill.position.set(4, -2, 3);
    return { shells, cores, bonds, bg, bgUniforms, group, key, fill, env };
  }, [gl, palette]);

  useLayoutEffect(() => {
    scene.environment = null; // per-material env maps only
  }, [scene]);

  useLayoutEffect(() => {
    const pos = LATTICE.atoms.map(() => new THREE.Vector3());
    LATTICE.atoms.forEach((a, i) => sheetPoint(a.x, a.y, p, pos[i]));
    const m = new THREE.Matrix4();
    pos.forEach((v, i) => {
      m.makeTranslation(v.x, v.y, v.z);
      objs.shells.setMatrixAt(i, m);
      objs.cores.setMatrixAt(i, m);
    });
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion();
    const dir = new THREE.Vector3();
    const mid = new THREE.Vector3();
    const scl = new THREE.Vector3();
    LATTICE.bonds.forEach(([a, b], k) => {
      dir.subVectors(pos[b], pos[a]);
      const len = dir.length();
      if (len > 2 * B) {
        // crosses the wrap seam (off-screen): hide
        m.makeScale(0, 0, 0);
      } else {
        dir.normalize();
        q.setFromUnitVectors(up, dir);
        mid.addVectors(pos[a], pos[b]).multiplyScalar(0.5);
        scl.set(1, Math.max(0.001, len - ATOM_R * 1.6), 1);
        m.compose(mid, q, scl);
      }
      objs.bonds.setMatrixAt(k, m);
    });
    objs.shells.instanceMatrix.needsUpdate = true;
    objs.cores.instanceMatrix.needsUpdate = true;
    objs.bonds.instanceMatrix.needsUpdate = true;
    // sheet orientation: tilted away, slow closed tilt of +-5 degrees
    const deg = Math.PI / 180;
    objs.group.rotation.set(-30 * deg + 5 * deg * Math.sin(TAU * p), 12 * deg + 3 * deg * Math.cos(TAU * p), -8 * deg);
    // background drift (whole cycles)
    BOKEH.blobs.forEach((b, i) => {
      const ang = TAU * (b.cyc * p + b.ph);
      objs.bgUniforms.uBlobs.value[i].set(b.x + b.amp * Math.cos(ang), b.y + b.amp * Math.sin(ang), b.r, b.a);
    });
    BOKEH.spheres.forEach((s, i) => {
      const ang = TAU * (s.cyc * p + s.ph);
      objs.bgUniforms.uSpheres.value[i].set(s.x + s.amp * Math.sin(ang), s.y + s.amp * Math.cos(ang) * 0.7, s.r, s.a);
    });
    objs.bgUniforms.uRes.value.set(w, h);
  }, [objs, p, w, h]);

  return (
    <>
      <primitive object={objs.bg} />
      <primitive object={objs.key} />
      <primitive object={objs.fill} />
      <ambientLight intensity={0.25} />
      <primitive object={objs.group} />
    </>
  );
};

export const GrapheneLattice: React.FC<{ palette: GraphenePalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const camera: CameraPose = useMemo(() => ({ fov: 30, position: [0.3, -0.1, 5.4], target: [0.3, 0.2, 0], near: 0.5, far: 60 }), []);
  const post = useMemo(() => ({
    focus: 5.5, range: 1.6, nearRange: 1.0, sharpZone: 0.7, maxBlur: 10, farMax: 1,
    bloomStrength: 0.5, bloomThreshold: 0.6, bloomRadius: 1.3, grain: 0.015, vignette: 0.35,
  }), []);
  return (
    <ThreeStage camera={camera} post={post}>
      <Scene palette={palette} frame={frame} />
    </ThreeStage>
  );
};
