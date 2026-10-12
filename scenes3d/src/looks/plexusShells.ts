import * as THREE from "three";
import { buildRibbons, buildSprites, Polyline, RIBBON_VERT, SPRITE_VERT } from "../kit/geom";
import { LookInstance } from "../kit/post";
import { LOOP, mulberry32 } from "../kit/random";

export type PlexusShellsParams = {
  nodeA: string; // main node colour
  nodeB: string; // accent node colour
  link: string;
  ring: string;
  speck: string;
  accentShare: number;
};

// ---------- layout (module level, seeded) ----------

type Node = { p: THREE.Vector3; size: number; accent: boolean; seed: number };

const shell = (n: number, radius: number, seed: number, accentShare: number): Node[] => {
  const rng = mulberry32(seed);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out: Node[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const th = i * golden;
    const p = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
    p.add(new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(0.11));
    p.normalize().multiplyScalar(radius * (1 + (rng() - 0.5) * 0.04));
    const s = rng();
    out.push({
      p,
      size: 1 + 3 * Math.pow(s, 3.2),
      accent: rng() < accentShare,
      seed: rng(),
    });
  }
  return out;
};

const knnLinks = (nodes: Node[], k: number) => {
  const seen = new Set<string>();
  const out: [number, number][] = [];
  nodes.forEach((a, i) => {
    const d = nodes
      .map((b, j) => ({ j, d: j === i ? Infinity : a.p.distanceToSquared(b.p) }))
      .sort((x, y) => x.d - y.d)
      .slice(0, k);
    d.forEach(({ j }) => {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push([i, j]);
      }
    });
  });
  return out;
};

const OUTER = shell(420, 1, 1101, 0.18);
const INNER = shell(260, 0.5, 2202, 0.18);
const OUTER_LINKS = knnLinks(OUTER, 3);
const INNER_LINKS = knnLinks(INNER, 3);

type Ring = { center: THREE.Vector3; normal: THREE.Vector3; radius: number; count: number };
const RINGS: Ring[] = (() => {
  const rng = mulberry32(3303);
  const out: Ring[] = [];
  for (let i = 0; i < 10; i++) {
    const normal = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
    let radius: number;
    let offset: number;
    if (i < 4) {
      radius = 1; // great circles on the outer shell
      offset = 0;
    } else if (i < 7) {
      // small circles on the outer shell
      offset = 0.3 + rng() * 0.45;
      radius = Math.sqrt(1 - offset * offset);
    } else {
      // circles crossing between the shells
      radius = 0.62 + rng() * 0.28;
      offset = (rng() - 0.5) * 0.3;
    }
    out.push({
      center: normal.clone().multiplyScalar(offset),
      normal,
      radius,
      count: Math.round(radius * 260),
    });
  }
  return out;
})();

const SPECKS = (() => {
  const rng = mulberry32(4404);
  const out: THREE.Vector3[] = [];
  while (out.length < 400) {
    const p = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1);
    const l = p.length();
    if (l > 0.98 || l < 0.15) continue;
    out.push(p);
  }
  return out;
})();

// ---------- shaders ----------

const NODE_FRAG = /* glsl */ `
uniform float uFrame;
uniform float uNear;
uniform float uFar;
uniform float uFarDim;
uniform float uTwinkle;
uniform float uGain;
varying vec2 vCorner;
varying vec3 vColor;
varying float vSeed;
varying float vAlpha;
varying float vViewZ;
varying vec3 vWorld;
void main() {
  float r = length(vCorner);
  if (r > 1.0) discard;
#ifdef DEPTH_ONLY
  if (r > 0.7) discard;
  gl_FragColor = vec4(0.0);
#else
  float core = 1.0 - smoothstep(0.62, 1.0, r);
  core += 0.35 * (1.0 - smoothstep(0.0, 0.45, r));
  float periods[6] = float[6](100.0, 120.0, 150.0, 200.0, 300.0, 600.0);
  float period = periods[int(floor(fract(vSeed * 7.137) * 5.999))];
  float tw = 1.0 + uTwinkle * sin(6.2831853 * (uFrame / period + vSeed));
  float fade = mix(1.0, uFarDim, smoothstep(uNear, uFar, vViewZ));
  gl_FragColor = vec4(vColor * core * tw * fade * vAlpha * uGain, 1.0);
#endif
}
`;

const LINK_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uNear;
uniform float uFar;
uniform float uFarDim;
varying float vSide;
varying float vU;
varying float vSeed;
varying float vAlpha;
varying float vExtra;
varying float vViewZ;
void main() {
#ifdef DEPTH_ONLY
  if (abs(vSide) > 0.6) discard;
  gl_FragColor = vec4(0.0);
#else
  float a = 1.0 - smoothstep(0.55, 1.0, abs(vSide));
  float fade = mix(1.0, uFarDim, smoothstep(uNear, uFar, vViewZ));
  gl_FragColor = vec4(uColor * a * vAlpha * fade * vExtra, 1.0);
#endif
}
`;

const lin = (hex: string, gain = 1) =>
  // Hex strings are sRGB; THREE.Color stores linear.
  new THREE.Color(hex).multiplyScalar(gain);

export const createPlexusShells = (P: PlexusShellsParams): LookInstance => {
  const scene = new THREE.Scene();
  const depthScene = new THREE.Scene();
  const D = 4.25;
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 20);
  camera.position.set(0, 0, D);
  camera.lookAt(0, 0, 0);

  const outer = new THREE.Group();
  const inner = new THREE.Group();
  const outerD = new THREE.Group();
  const innerD = new THREE.Group();
  scene.add(outer, inner);
  depthScene.add(outerD, innerD);

  const res = new THREE.Vector2(1, 1);
  const common = {
    uRes: { value: res },
    uMinPx: { value: 1 },
    uNear: { value: D - 1 },
    uFar: { value: D + 1 },
    uFarDim: { value: 0.32 },
  };
  const frameU = { value: 0 };

  const additive = (frag: string, vert: string, extra: Record<string, THREE.IUniform>) =>
    new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { ...common, ...extra },
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      depthWrite: false,
      depthTest: true,
      transparent: true,
    });
  const depthOnly = (m: THREE.ShaderMaterial) => {
    const d = m.clone();
    d.uniforms = m.uniforms;
    d.defines = { DEPTH_ONLY: 1 };
    d.blending = THREE.NoBlending;
    d.colorWrite = false;
    d.depthWrite = true;
    d.transparent = false;
    return d;
  };

  const colA = lin(P.nodeA, 2.2);
  const colB = lin(P.nodeB, 2.4);
  const nodeSprites = (nodes: Node[], base: number) =>
    buildSprites(
      nodes.map((n) => ({
        pos: n.p,
        size: base * n.size,
        color: n.accent ? colB : colA,
        seed: n.seed,
      })),
    );

  const nodeMat = (gain: number, sizeMul: number) =>
    additive(NODE_FRAG, SPRITE_VERT, {
      uFrame: frameU,
      uTwinkle: { value: 0.3 },
      uGain: { value: gain },
      uSizeMul: { value: sizeMul },
    });

  const linkMat = (color: THREE.Color) => additive(LINK_FRAG, RIBBON_VERT, { uColor: { value: color } });

  const linkLines = (nodes: Node[], links: [number, number][], w: number): Polyline[] =>
    links.map(([a, b], i) => ({ points: [nodes[a].p, nodes[b].p], width: w, seed: i }));

  const add = (
    group: THREE.Group,
    dgroup: THREE.Group | null,
    g: THREE.BufferGeometry,
    m: THREE.ShaderMaterial,
  ) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    group.add(mesh);
    if (dgroup) {
      const dm = new THREE.Mesh(g, depthOnly(m));
      dm.frustumCulled = false;
      dgroup.add(dm);
    }
  };

  // Outer shell
  add(outer, outerD, nodeSprites(OUTER, 0.0052), nodeMat(1, 1));
  add(outer, outerD, buildRibbons(linkLines(OUTER, OUTER_LINKS, 0.0021)), linkMat(lin(P.link, 0.42)));
  // Inner shell (links slightly brighter)
  add(inner, innerD, nodeSprites(INNER, 0.0046), nodeMat(1, 1));
  add(inner, innerD, buildRibbons(linkLines(INNER, INNER_LINKS, 0.0019)), linkMat(lin(P.link, 0.55)));

  // Dotted rings ride with the outer shell
  const ringDots: { pos: THREE.Vector3; size: number; color: THREE.Color; seed: number }[] = [];
  const ringCol = lin(P.ring, 0.3);
  RINGS.forEach((r, ri) => {
    const t1 = new THREE.Vector3(0, 1, 0).cross(r.normal);
    if (t1.lengthSq() < 1e-4) t1.set(1, 0, 0);
    t1.normalize();
    const t2 = r.normal.clone().cross(t1).normalize();
    for (let i = 0; i < r.count; i++) {
      const a = (i / r.count) * Math.PI * 2;
      const p = r.center
        .clone()
        .addScaledVector(t1, Math.cos(a) * r.radius)
        .addScaledVector(t2, Math.sin(a) * r.radius);
      ringDots.push({ pos: p, size: 0.0028, color: ringCol, seed: ri * 1000 + i });
    }
  });
  const ringMat = nodeMat(1, 1);
  ringMat.uniforms.uTwinkle = { value: 0 };
  add(outer, null, buildSprites(ringDots), ringMat);

  // Specks inside the volume
  const speckCol = lin(P.speck, 0.9);
  const speckMat = nodeMat(1, 1);
  speckMat.uniforms.uTwinkle = { value: 0.5 };
  add(
    outer,
    null,
    buildSprites(
      SPECKS.map((p, i) => ({ pos: p, size: 0.0024, color: speckCol, seed: (i * 0.618) % 1 })),
    ),
    speckMat,
  );

  const outerAxis = new THREE.Vector3(0.16, 1, 0.08).normalize();
  const innerAxis = new THREE.Vector3(-0.3, 1, 0.22).normalize();
  const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.22, 0, 0.1));

  return {
    scene,
    camera,
    post: {
      focus: D - 1,
      cocScale: 16,
      maxCoc: 7,
      nearScale: 1,
      bloomStrength: 0.3,
      bloomThreshold: 0.5,
      acesMix: 0.15,
      exposure: 1.0,
      vignette: 0.0,
      grain: 0.015,
      cleanBlack: true,
    },
    update: (frame, w, h, k) => {
      const f = frame % LOOP;
      res.set(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      frameU.value = f;
      const a = (f / LOOP) * Math.PI * 2;
      const qo = new THREE.Quaternion().setFromAxisAngle(outerAxis, a).premultiply(tilt);
      const qi = new THREE.Quaternion().setFromAxisAngle(innerAxis, -a).premultiply(tilt);
      outer.quaternion.copy(qo);
      outerD.quaternion.copy(qo);
      inner.quaternion.copy(qi);
      innerD.quaternion.copy(qi);
      common.uMinPx.value = Math.max(1, 1.6 * k * 2);
    },
    draw: (gl) => {
      gl.render(scene, camera);
      gl.render(depthScene, camera);
    },
    dispose: () => {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    },
  };
};
