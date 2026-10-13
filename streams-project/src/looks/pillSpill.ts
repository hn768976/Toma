import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import pile from "../../data/pill-pile.json";
import { defaultPost } from "../lib/post";
import { mulberry32, TAU } from "../lib/random";
import { ThreeLook } from "../lib/ThreeStage";

// Look 4 — Pill Spill. The pile is a saved, pre-settled layout
// (scripts/settle-pills.mjs → data/pill-pile.json). Plain pills: no imprints.

export type PillSpillProps = {
  background: string;
  tabletA: string;
  tabletB: string;
  capA: string;
  capB: string;
  capC: string;
  tabletRoughness?: number;
  exposure?: number;
};

type Pile = typeof pile;
const P = pile as Pile;

// Rounded tablet ("pillow") geometry: top/bottom faces with a slight dome,
// a rounded edge, optional shallow centre groove across the top face.
const tabletGeometry = (opts: {
  rx: number;
  rz: number;
  thickness: number;
  edge: number;
  dome: number;
  groove: number;
}) => {
  const { rx, rz, thickness, edge, dome, groove } = opts;
  const SEG = 64;
  const FACE = 10; // rings on each face
  const EDGE = 10; // rings around the edge
  const rows: { rho: number; y: number; face: number }[] = [];
  const h = thickness / 2 - edge;
  // top face from centre outwards
  for (let i = 0; i <= FACE; i++) {
    const f = i / FACE;
    rows.push({ rho: f, y: h + edge + dome * (1 - f * f), face: 1 });
  }
  // edge torus: angle from +90° to -90°
  for (let i = 1; i < EDGE; i++) {
    const a = Math.PI / 2 - (i / EDGE) * Math.PI;
    rows.push({ rho: Math.cos(a), y: Math.sin(a) * edge + (i === EDGE / 2 ? 0 : Math.sign(Math.sin(a)) * h), face: 0 });
  }
  for (let i = FACE; i >= 0; i--) {
    const f = i / FACE;
    rows.push({ rho: f, y: -(h + edge + dome * (1 - f * f)), face: -1 });
  }
  const pos: number[] = [];
  for (const r of rows) {
    for (let s = 0; s < SEG; s++) {
      const a = (s / SEG) * TAU;
      const ca = Math.cos(a),
        sa = Math.sin(a);
      let x: number, z: number;
      if (r.face !== 0) {
        x = ca * r.rho * (rx - edge);
        z = sa * r.rho * (rz - edge);
      } else {
        x = ca * (rx - edge + r.rho * edge);
        z = sa * (rz - edge + r.rho * edge);
      }
      let y = r.y;
      if (r.face === 1 && groove > 0) {
        const g = Math.exp(-((x / (0.045 * rx)) ** 2)) * Math.min(1, (1 - Math.abs(z) / rz) * 6);
        y -= groove * g;
      }
      pos.push(x, y, z);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < rows.length - 1; i++)
    for (let s = 0; s < SEG; s++) {
      const a = i * SEG + s,
        b = i * SEG + ((s + 1) % SEG),
        c = (i + 1) * SEG + s,
        d = (i + 1) * SEG + ((s + 1) % SEG);
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

// Two-part capsule: the cap (radius r) overlaps the body (slightly smaller).
// Lathe points run bottom → top so normals face outwards.
const capsuleHalf = (r: number, len: number, cap: boolean) => {
  const half = len / 2 - r;
  const radius = cap ? r : r * 0.94;
  const bottom = cap ? -0.08 * len : -half;
  const pts: THREE.Vector2[] = [];
  if (cap) pts.push(new THREE.Vector2(radius * 0.94, bottom - 0.002));
  pts.push(new THREE.Vector2(radius, bottom));
  const N = 16;
  for (let i = N; i >= 0; i--) {
    const a = (i / N) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.sin(a) * radius + 1e-4, half + Math.cos(a) * radius));
  }
  const g = new THREE.LatheGeometry(pts, 48);
  if (!cap) g.rotateX(Math.PI); // body half points down
  return g;
};

const bottleGeometry = () => {
  const b = P.bottle;
  const outer: THREE.Vector2[] = [];
  for (const [x, r] of b.profile) {
    outer.push(new THREE.Vector2(r, x));
    if (x === 8.25) {
      // moulded screw-thread ridges on the neck
      for (let k = 0; k < 4; k++) {
        const x0 = 8.4 + k * 0.28;
        outer.push(new THREE.Vector2(r, x0), new THREE.Vector2(r + 0.07, x0 + 0.07), new THREE.Vector2(r + 0.07, x0 + 0.12), new THREE.Vector2(r, x0 + 0.19));
      }
    }
  }
  const wall = b.wall;
  const pts: THREE.Vector2[] = [...outer];
  // lip top and inner wall going back down
  const top = b.length;
  pts.push(new THREE.Vector2(b.innerR + 0.06, top));
  pts.push(new THREE.Vector2(b.innerR, top - 0.08));
  pts.push(new THREE.Vector2(b.innerR, 8.1));
  pts.push(new THREE.Vector2(2.9 - wall, 7.4));
  pts.push(new THREE.Vector2(3.0 - wall, 6.6));
  pts.push(new THREE.Vector2(3.0 - wall, 0.6));
  pts.push(new THREE.Vector2(2.6, wall));
  pts.push(new THREE.Vector2(0.001, wall));
  const g = new THREE.LatheGeometry(pts, 96);
  g.computeVertexNormals();
  return g;
};

export const createPillSpill =
  (props: PillSpillProps) =>
  (gl: THREE.WebGLRenderer): ThreeLook => {
    const rng = mulberry32(4242);
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    const bg = new THREE.Color(props.background);
    scene.background = bg.clone();

    const pmrem = new THREE.PMREMGenerator(gl);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.55;

    // matte surface, same colour as the background, curving into a backdrop
    const floorMat = new THREE.MeshStandardMaterial({ color: bg, roughness: 0.92, metalness: 0 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    scene.fog = new THREE.Fog(bg.clone(), 45, 140);

    // lights: big soft key from top-left, soft fill
    // big soft key from the top left (a spot, so the surface falls off
    // naturally across the frame), PCF soft shadows
    const key = new THREE.SpotLight(0xffffff, 3.2 * 3600, 0, 0.42, 1.0, 2);
    key.position.set(-30, 52, 18);
    key.target.position.set(-2, 0, 2);
    key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096);
    key.shadow.radius = 4;
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.02;
    key.shadow.camera.near = 30;
    key.shadow.camera.far = 110;
    scene.add(key, key.target);
    const fill = new THREE.HemisphereLight(0xffffff, bg, 0.5);
    scene.add(fill);

    // ---- bottle ----
    const bottleMat = new THREE.MeshPhysicalMaterial({
      color: 0xf6f6f4,
      roughness: 0.42,
      metalness: 0,
      clearcoat: 0.25,
      clearcoatRoughness: 0.35,
      sheen: 0.3,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(0xffffff),
      side: THREE.DoubleSide,
    });
    const bottle = new THREE.Mesh(bottleGeometry(), bottleMat);
    const b = P.bottle;
    const dir = new THREE.Vector3(...(b.dir as [number, number, number]));
    bottle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    bottle.position.set(...(b.base as [number, number, number]));
    bottle.castShadow = true;
    bottle.receiveShadow = true;
    scene.add(bottle);

    // ---- pills ----
    const d = P.dims;
    const roundGeo = tabletGeometry({
      rx: d.round.radius,
      rz: d.round.radius,
      thickness: d.round.thickness,
      edge: d.round.edge,
      dome: 0.035,
      groove: 0.035,
    });
    const ovalGeo = tabletGeometry({
      rx: d.oval.length / 2,
      rz: d.oval.width / 2,
      thickness: d.oval.thickness,
      edge: d.oval.edge,
      dome: 0.05,
      groove: 0,
    });
    const capGeo = capsuleHalf(d.capsule.radius, d.capsule.length, true);
    const bodyGeo = capsuleHalf(d.capsule.radius, d.capsule.length, false);

    const tabletMat = new THREE.MeshStandardMaterial({
      roughness: props.tabletRoughness ?? 0.48,
      metalness: 0,
    });
    // subtle uneven coating: fixed value noise in object space, offset per
    // instance (from its translation) so no two tablets share the pattern
    tabletMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vNoiseP;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvNoiseP = position * 9.0 + instanceMatrix[3].xyz * 3.1;",
        );
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 vNoiseP;
float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
}`,
        )
        .replace(
          "#include <color_fragment>",
          "#include <color_fragment>\nfloat nz = vnoise(vNoiseP) * 0.6 + vnoise(vNoiseP * 3.7) * 0.4;\ndiffuseColor.rgb *= 0.95 + 0.1 * nz;",
        )
        .replace(
          "#include <roughnessmap_fragment>",
          "#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * (0.8 + 0.45 * nz), 0.05, 1.0);",
        );
    };
    const capsuleMat = new THREE.MeshStandardMaterial({
      roughness: 0.2,
      metalness: 0,
      envMapIntensity: 1.3,
    });

    const lists = { round: [] as typeof P.pills, oval: [] as typeof P.pills, capsule: [] as typeof P.pills };
    for (const p of P.pills) lists[p.t as keyof typeof lists].push(p);

    const mk = (geo: THREE.BufferGeometry, m: THREE.Material, n: number) => {
      const im = new THREE.InstancedMesh(geo, m, n);
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      scene.add(im);
      return im;
    };
    const tA = new THREE.Color(props.tabletA),
      tB = new THREE.Color(props.tabletB);
    const cA = new THREE.Color(props.capA),
      cB = new THREE.Color(props.capB),
      cC = new THREE.Color(props.capC);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const jitter = (c: THREE.Color, amt: number) => {
      const o = c.clone();
      const k = 1 + (rng() - 0.5) * amt;
      o.multiplyScalar(k);
      return o;
    };

    const placeTablets = (geo: THREE.BufferGeometry, list: typeof P.pills) => {
      const im = mk(geo, tabletMat, list.length);
      list.forEach((p, i) => {
        q.set(p.q[0], p.q[1], p.q[2], p.q[3]);
        const sc = p.v % 7 === 0 ? 0.86 : 1 - (p.v % 13) * 0.006;
        m4.compose(new THREE.Vector3(p.p[0], p.p[1], p.p[2]), q, new THREE.Vector3(sc, sc, sc));
        im.setMatrixAt(i, m4);
        const inside = (p as { in?: number }).in === 1;
        const base = inside ? tB.clone().multiplyScalar(0.55) : p.v % 100 < 78 ? tA : tB;
        im.setColorAt(i, jitter(base, 0.12));
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    };
    placeTablets(roundGeo, lists.round);
    placeTablets(ovalGeo, lists.oval);

    const caps = lists.capsule;
    const imCap = mk(capGeo, capsuleMat, caps.length);
    const imBody = mk(bodyGeo, capsuleMat, caps.length);
    caps.forEach((p, i) => {
      q.set(p.q[0], p.q[1], p.q[2], p.q[3]);
      m4.compose(new THREE.Vector3(p.p[0], p.p[1], p.p[2]), q, one);
      imCap.setMatrixAt(i, m4);
      imBody.setMatrixAt(i, m4);
      const k = p.v % 100;
      // two-tone combos: A/B, B/B, A/C
      const [c1, c2] = k < 30 ? [cA, cB] : k < 65 ? [cB, cB] : k < 85 ? [cC, cC] : [cA, cA];
      const j = 1 + (rng() - 0.5) * 0.08;
      imCap.setColorAt(i, c1.clone().multiplyScalar(j));
      imBody.setColorAt(i, c2.clone().multiplyScalar(j));
    });
    [imCap, imBody].forEach((im) => {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    });

    // ---- camera ----
    const camera = new THREE.PerspectiveCamera(24, 16 / 9, 0.5, 400);
    const post = defaultPost();
    post.tonemap = 0;
    post.exposure = props.exposure ?? 0.84;
    post.saturation = 1.12;
    post.vignette = 0.12;
    post.ca = 0.7;
    post.grain = 0.015;
    post.bloom = { strength: 0.08, threshold: 1.1, knee: 0.4, radius: 0.8 };
    post.ssao = { radius: 0.4, intensity: 0.8, power: 1.6 };
    post.dof = { focus: 20, aperture: 0.026, maxCoc: 0.028 };

    const mouth = new THREE.Vector3(...(b.base as [number, number, number])).addScaledVector(dir, b.length);
    const pileCenter = mouth.clone().addScaledVector(dir, 4.0).setY(0.8);
    const side = new THREE.Vector3(dir.z, 0, -dir.x);

    return {
      scene,
      camera,
      post,
      msaa: 2,
      update(frame, size) {
        const t = (((frame % 600) + 600) % 600) / 600;
        camera.aspect = size.w / size.h;
        // closed drift: slow slide + slight orbit
        const slide = Math.sin(TAU * t) * 1.6;
        const orbit = Math.cos(TAU * t) * 0.07;
        const camDist = 16.5;
        const baseDir = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.3 + orbit);
        camera.position
          .copy(pileCenter)
          .addScaledVector(baseDir, camDist)
          .addScaledVector(side, slide)
          .setY(10.5 + Math.sin(TAU * t + 1.0) * 0.2);
        const look = pileCenter.clone().addScaledVector(side, slide * 0.6 - 2.4).addScaledVector(dir, -0.6);
        look.y = 1.2;
        camera.lookAt(look);
        camera.updateMatrixWorld();
        if (post.dof) post.dof.focus = camera.position.distanceTo(pileCenter) * 0.98;
      },
      dispose() {
        envTex.dispose();
        pmrem.dispose();
      },
    };
  };
